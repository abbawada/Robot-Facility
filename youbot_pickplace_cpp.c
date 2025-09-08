#include <webots/Robot.hpp>
#include <webots/Motor.hpp>
#include <webots/PositionSensor.hpp>
#include <webots/GPS.hpp>
#include <webots/InertialUnit.hpp>

#include <cmath>
#include <vector>
#include <string>
#include <iostream>
#include <sstream>
#include <chrono>

// HTTP (libcurl)
#include <curl/curl.h>

using namespace webots;

static inline double now_sec() {
  using clock = std::chrono::steady_clock;
  static const auto t0 = clock::now();
  auto dt = std::chrono::duration<double>(clock::now() - t0).count();
  return dt;
}

static const double DT = 0.032;
static const double TELEMETRY_PERIOD = 0.5; // ~2 Hz

// Arm targets
static const double ARM_HOME[5]  = {0.0, 1.0, -1.8, 1.2, 0.0};
static const double ARM_PREP[5]  = {0.0, 0.9, -1.4, 0.9, 0.0};
static const double ARM_GRASP[5] = {0.0, 1.15, -1.35, 0.6, 0.0};

static const double WHEEL_R = 0.047;
static const double HALF_AXLE = 0.158;

template <typename T> T clamp(T v, T lo, T hi) { return std::max(lo, std::min(hi, v)); }

struct HttpPoster {
  CURL* curl = nullptr;
  std::string url;
  struct curl_slist* headers = nullptr;
  explicit HttpPoster(const std::string& endpoint) : url(endpoint) {
    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();
    headers = curl_slist_append(headers, "Content-Type: application/json");
  }
  ~HttpPoster() {
    if (headers) curl_slist_free_all(headers);
    if (curl) curl_easy_cleanup(curl);
    curl_global_cleanup();
  }
  void post_json(const std::string& json) {
    if (!curl) return;
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, (long)json.size());
    curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, 250L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT_MS, 200L);
    (void)curl_easy_perform(curl);
  }
};

int main(int argc, char **argv) {
  Robot robot;
  const int timestep = (int)robot.getBasicTimeStep();

  std::string robot_id = "R?";
  if (argc >= 2) robot_id = argv[1];

  // Wheels
  const char* wheelNames[4] = {"wheel1","wheel2","wheel3","wheel4"};
  std::vector<Motor*> wheels(4, nullptr);
  for (int i=0;i<4;++i) {
    wheels[i] = robot.getMotor(wheelNames[i]);
    wheels[i]->setPosition(INFINITY);
    wheels[i]->setVelocity(0.0);
  }

  // Arm
  const char* armNames[5] = {"arm1","arm2","arm3","arm4","arm5"};
  std::vector<Motor*> arm(5, nullptr);
  std::vector<PositionSensor*> armS(5, nullptr);
  for (int i=0;i<5;++i) {
    arm[i] = robot.getMotor(armNames[i]);
    arm[i]->setVelocity(1.5);
    armS[i] = robot.getPositionSensor((std::string(armNames[i]) + " sensor").c_str());
    armS[i]->enable(timestep);
  }

  // Gripper
  Motor* fingerL = robot.getMotor("finger1");
  Motor* fingerR = robot.getMotor("finger2");
  const double GRIP_OPEN = 0.023;
  const double GRIP_CLOSED = 0.0;
  fingerL->setVelocity(0.4);
  fingerR->setVelocity(0.4);
  fingerL->setPosition(GRIP_OPEN);
  fingerR->setPosition(GRIP_OPEN);

  GPS* gps = robot.getGPS("gps"); if (gps) gps->enable(timestep);
  InertialUnit* imu = robot.getInertialUnit("inertial unit"); if (imu) imu->enable(timestep);

  auto baseCmd = [&](double vx, double wz) {
    double w = vx / WHEEL_R;
    double w_z = (wz * HALF_AXLE) / WHEEL_R;
    double speeds[4] = { w - w_z, w + w_z, w - w_z, w + w_z };
    for (int i=0;i<4;++i) wheels[i]->setVelocity(speeds[i]);
  };

  auto gotoJoints = [&](const double target[5], double speed=1.5) {
    for (int i=0;i<5;++i) { arm[i]->setVelocity(speed); arm[i]->setPosition(target[i]); }
  };
  auto atJoints = [&](const double target[5], double tol=0.03) {
    for (int i=0;i<5;++i) if (std::fabs(armS[i]->getValue() - target[i]) > tol) return false;
    return true;
  };

  double last_tx = now_sec();
  double last_gps_x = 0.0, last_gps_z = 0.0;
  bool have_prev_gps = false;

  double battery_pct = 100.0;
  double motor_temp_c = 25.0;
  const double ambient_temp_c = 24.0;
  const double payload_kg = 0.5;

  auto zone_id = [](double x, double z)->std::string {
    if (x < 0 && z < 0) return "A";
    if (x < 0 && z >= 0) return "B";
    if (x >= 0 && z >= 0) return "C";
    return "D";
  };

  HttpPoster http("http://127.0.0.1:8000/ingest");

  auto post_telemetry = [&](double ts_sim) {
    double x=0.0, z=0.0, speed_mps=0.0;
    if (gps) {
      const double* v = gps->getValues();
      x = v[0]; z = v[2];
      if (have_prev_gps) {
        double dx = x - last_gps_x, dz = z - last_gps_z;
        speed_mps = std::sqrt(dx*dx + dz*dz) / TELEMETRY_PERIOD;
      }
      last_gps_x = x; last_gps_z = z; have_prev_gps = true;
    }

    double motor_current_a = 0.25 + 0.08 * speed_mps + 0.12 * payload_kg;
    double heat = 0.06 * motor_current_a;
    motor_temp_c += heat - 0.02 * (motor_temp_c - ambient_temp_c);

    double discharge = (0.0025 + 0.0035 * speed_mps + 0.002 * payload_kg) * TELEMETRY_PERIOD;
    battery_pct = std::max(0.0, battery_pct - discharge*100.0);

    double wheel_slip = 0.02*speed_mps;
    double vibration_rms = 0.02 + 0.03*speed_mps;

    std::ostringstream oss;
    oss.setf(std::ios::fixed); oss.precision(3);
    oss << "{"
        << "\"ts\":" << ts_sim << ","
        << "\"robot_id\":\"" << robot_id << "\","
        << "\"x\":" << x << ",\"y\":" << z << ","
        << "\"zone_id\":\"" << zone_id(x,z) << "\","
        << "\"battery_pct\":" << battery_pct << ","
        << "\"motor_temp_c\":" << motor_temp_c << ","
        << "\"motor_current_a\":" << motor_current_a << ","
        << "\"vibration_rms\":" << vibration_rms << ","
        << "\"wheel_slip\":" << wheel_slip << ","
        << "\"speed_mps\":" << speed_mps << ","
        << "\"payload_kg\":" << payload_kg << ","
        << "\"ambient_temp_c\":" << ambient_temp_c
        << "}";

    http.post_json(oss.str());
  };

  enum State { DRIVE_TO_PICK, GO_PREP, GO_GRASP, CLOSE_WAIT, LIFT, DRIVE_TO_PLACE, PLACE_LOWER, PLACE_WAIT, DONE };
  State state = DRIVE_TO_PICK;
  double t_mark = 0.0;

  double target_pick_x = 0.15, target_pick_z = 0.15;
  double target_place_x = 0.0,  target_place_z = 1.10;

  auto reachedTarget = [&](double tx, double tz, double tol=0.06) {
    if (!gps) return true;
    const double* v = gps->getValues();
    double dx = tx - v[0], dz = tz - v[2];
    return std::sqrt(dx*dx + dz*dz) < tol;
  };

  gotoJoints(ARM_HOME, 2.0);

  while (robot.step(timestep) != -1) {
    switch (state) {
      case DRIVE_TO_PICK:
        baseCmd(0.12, 0.0);
        if (reachedTarget(target_pick_x, target_pick_z)) {
          baseCmd(0.0, 0.0);
          fingerL->setPosition(GRIP_OPEN); fingerR->setPosition(GRIP_OPEN);
          gotoJoints(ARM_PREP, 1.8);
          state = GO_PREP;
        }
        break;
      case GO_PREP:
        if (atJoints(ARM_PREP)) { gotoJoints(ARM_GRASP, 1.2); state = GO_GRASP; }
        break;
      case GO_GRASP:
        if (atJoints(ARM_GRASP)) {
          fingerL->setPosition(GRIP_CLOSED); fingerR->setPosition(GRIP_CLOSED);
          t_mark = robot.getTime(); state = CLOSE_WAIT;
        }
        break;
      case CLOSE_WAIT:
        if (robot.getTime() - t_mark > 0.7) { gotoJoints(ARM_PREP, 1.2); state = LIFT; }
        break;
      case LIFT:
        if (atJoints(ARM_PREP)) { state = DRIVE_TO_PLACE; }
        break;
      case DRIVE_TO_PLACE:
        baseCmd(0.12, 0.0);
        if (reachedTarget(target_place_x, target_place_z)) {
          baseCmd(0.0, 0.0);
          gotoJoints(ARM_GRASP, 1.2);
          state = PLACE_LOWER;
        }
        break;
      case PLACE_LOWER:
        if (atJoints(ARM_GRASP)) {
          fingerL->setPosition(GRIP_OPEN); fingerR->setPosition(GRIP_OPEN);
          t_mark = robot.getTime(); state = PLACE_WAIT;
        }
        break;
      case PLACE_WAIT:
        if (robot.getTime() - t_mark > 0.6) { gotoJoints(ARM_HOME, 1.5); state = DONE; }
        break;
      case DONE:
        baseCmd(0.0, 0.0);
        break;
    }

    if (now_sec() - last_tx >= TELEMETRY_PERIOD) {
      last_tx = now_sec();
      post_telemetry(robot.getTime());
    }
  }

  return 0;
}
