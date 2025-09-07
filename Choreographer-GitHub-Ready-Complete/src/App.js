import React, { useState, useEffect, useRef } from 'react';
import p5 from 'p5';
import './App.css';

function App() {
  const canvasRef = useRef(null);
  const p5InstanceRef = useRef(null);
  const [simulationState, setSimulationState] = useState('stopped');
  const [robots, setRobots] = useState([]);
  const [obstacles, setObstacles] = useState([]);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [dropoffPoints, setDropoffPoints] = useState([]);
  const [nextRobotId, setNextRobotId] = useState(1);
  const [draggedObstacle, setDraggedObstacle] = useState({ index: null, offset: { x: 0, y: 0 } });
  const [noGoZone, setNoGoZone] = useState({ x: 400, y: 200, width: 100, height: 100, isActive: true });
  const [startTime, setStartTime] = useState(0);
  const [pausedTime, setPausedTime] = useState(0);
  const [collisionAvoidances, setCollisionAvoidances] = useState(0);
  const [pathDeviations, setPathDeviations] = useState(0);
  const MAX_ROBOTS = 10;

  // Generate 20 smaller obstacles for dense shelving grid
  const generateObstacles = () => {
    const obstacles = [];
    const obstacleSize = 40;
    const spacing = 60;
    
    for (let i = 0; i < 20; i++) {
      const row = Math.floor(i / 5);
      const col = i % 5;
      obstacles.push({
        x: 100 + col * spacing,
        y: 100 + row * spacing,
        width: obstacleSize,
        height: obstacleSize,
        id: `obstacle_${i}`,
        dragging: false
      });
    }
    return obstacles;
  };

  // Generate 15 pickup points near obstacles
  const generatePickupPoints = () => {
    const points = [];
    for (let i = 0; i < 15; i++) {
      points.push({
        x: 50 + (i % 3) * 300 + Math.random() * 50,
        y: 50 + Math.floor(i / 3) * 150 + Math.random() * 50
      });
    }
    return points;
  };

  // Generate 3 dropoff points clustered on one side
  const generateDropoffPoints = () => {
    return [
      { x: 750, y: 100 },
      { x: 750, y: 300 },
      { x: 750, y: 500 }
    ];
  };

  // Proactive Flow Engine - Congestion-aware pathfinding
  const findPath = (start, end, obstacles, allRobots = []) => {
    const startVec = p5.Vector.createVector(start.x, start.y);
    const endVec = p5.Vector.createVector(end.x, end.y);
    
    // Check if direct path is clear
    if (isPathClear(startVec, endVec, obstacles)) {
      const directPath = [startVec, endVec];
      const directPenalty = calculateCongestionPenalty(directPath, allRobots);
      
      if (directPenalty < 0.3) {
        return directPath;
      }
    }
    
    // Generate alternative paths and choose the one with lowest congestion penalty
    const alternativePaths = generateAlternativePaths(startVec, endVec, obstacles);
    
    if (alternativePaths.length === 0) {
      return [startVec, endVec];
    }
    
    // Evaluate each path and choose the best one
    let bestPath = alternativePaths[0];
    let bestScore = Infinity;
    
    for (let path of alternativePaths) {
      const congestionPenalty = calculateCongestionPenalty(path, allRobots);
      const pathLength = calculatePathLength(path);
      const totalScore = congestionPenalty * 100 + pathLength * 0.1;
      
      if (totalScore < bestScore) {
        bestScore = totalScore;
        bestPath = path;
      }
    }
    
    return bestPath;
  };

  // Calculate congestion penalty for a given path
  const calculateCongestionPenalty = (path, allRobots) => {
    let penalty = 0;
    
    for (let robot of allRobots) {
      if (!robot.originalPath || robot.originalPath.length === 0) continue;
      
      for (let i = 0; i < path.length - 1; i++) {
        const segmentStart = path[i];
        const segmentEnd = path[i + 1];
        
        for (let j = 0; j < robot.originalPath.length - 1; j++) {
          const robotSegmentStart = robot.originalPath[j];
          const robotSegmentEnd = robot.originalPath[j + 1];
          
          const distance = getSegmentDistance(segmentStart, segmentEnd, robotSegmentStart, robotSegmentEnd);
          
          if (distance < 50) {
            penalty += (50 - distance) / 50;
          }
        }
      }
    }
    
    return Math.min(penalty, 1.0);
  };

  // Calculate distance between two line segments
  const getSegmentDistance = (p1, p2, p3, p4) => {
    const mid1 = p5.Vector.createVector((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    const mid2 = p5.Vector.createVector((p3.x + p4.x) / 2, (p3.y + p4.y) / 2);
    return p5.Vector.dist(mid1, mid2);
  };

  // Calculate total length of a path
  const calculatePathLength = (path) => {
    let length = 0;
    for (let i = 0; i < path.length - 1; i++) {
      length += p5.Vector.dist(path[i], path[i + 1]);
    }
    return length;
  };

  // Generate alternative paths around obstacles
  const generateAlternativePaths = (start, end, obstacles) => {
    const paths = [];
    const strategies = ['right', 'left', 'top', 'bottom'];
    
    for (let strategy of strategies) {
      const path = createStrategyPath(start, end, obstacles, strategy);
      if (path && isPathClear(start, path[1], obstacles)) {
        paths.push(path);
      }
    }
    
    return paths;
  };

  // Create a path using a specific strategy
  const createStrategyPath = (start, end, obstacles, strategy) => {
    let blockingObstacle = null;
    for (let obstacle of obstacles) {
      if (lineIntersectsRect(start, end, obstacle)) {
        blockingObstacle = obstacle;
        break;
      }
    }
    
    if (!blockingObstacle) {
      return [start, end];
    }
    
    const { x, y, width, height } = blockingObstacle;
    const margin = 25;
    
    let waypoint1, waypoint2;
    
    switch (strategy) {
      case 'right':
        waypoint1 = p5.Vector.createVector(x + width + margin, start.y);
        waypoint2 = p5.Vector.createVector(x + width + margin, end.y);
        break;
      case 'left':
        waypoint1 = p5.Vector.createVector(x - margin, start.y);
        waypoint2 = p5.Vector.createVector(x - margin, end.y);
        break;
      case 'top':
        waypoint1 = p5.Vector.createVector(start.x, y - margin);
        waypoint2 = p5.Vector.createVector(end.x, y - margin);
        break;
      case 'bottom':
        waypoint1 = p5.Vector.createVector(start.x, y + height + margin);
        waypoint2 = p5.Vector.createVector(end.x, y + height + margin);
        break;
    }
    
    if (isPathClear(start, waypoint1, obstacles) && 
        isPathClear(waypoint1, waypoint2, obstacles) && 
        isPathClear(waypoint2, end, obstacles)) {
      return [start, waypoint1, waypoint2, end];
    }
    
    return null;
  };

  // Check if a straight line path is clear of obstacles
  const isPathClear = (start, end, obstacles) => {
    for (let obstacle of obstacles) {
      if (lineIntersectsRect(start, end, obstacle)) {
        return false;
      }
    }
    if (noGoZone.isActive && lineIntersectsRect(start, end, noGoZone)) {
      return false;
    }
    return true;
  };

  // Check if a line intersects with a rectangle
  const lineIntersectsRect = (start, end, rect) => {
    const { x, y, width, height } = rect;
    const edges = [
      { start: p5.Vector.createVector(x, y), end: p5.Vector.createVector(x + width, y) },
      { start: p5.Vector.createVector(x + width, y), end: p5.Vector.createVector(x + width, y + height) },
      { start: p5.Vector.createVector(x + width, y + height), end: p5.Vector.createVector(x, y + height) },
      { start: p5.Vector.createVector(x, y + height), end: p5.Vector.createVector(x, y) }
    ];
    
    for (let edge of edges) {
      if (lineIntersectsLine(start, end, edge.start, edge.end)) {
        return true;
      }
    }
    return false;
  };

  // Check if two line segments intersect
  const lineIntersectsLine = (p1, p2, p3, p4) => {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(denom) < 0.0001) return false;
    
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denom;
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };

  // Robot class with intelligent behavior
  class Robot {
    constructor(id, mission, allRobots = []) {
      this.id = id;
      this.mission = mission;
      this.position = p5.Vector.createVector(mission.start.x, mission.start.y);
      this.originalPath = [];
      this.currentPath = [];
      this.traveledPath = [];
      this.speed = 1.5;
      this.pathIndex = 0;
      this.totalDistance = 0;
      this.radius = 8;
      this.reachedDestination = false;
      this.isAvoidingCollision = false;
      this.avoidanceStartTime = 0;
      this.hasDeviated = false;
      
      // Calculate initial path with congestion awareness
      this.originalPath = findPath(mission.start, mission.end, obstacles, allRobots);
      this.currentPath = [...this.originalPath];
      this.traveledPath = [this.position.copy()];
    }

    update(allRobots, obstacles) {
      if (this.reachedDestination || this.currentPath.length === 0) {
        return;
      }

      // Check for collision avoidance first (primary behavior)
      this.checkForCollisionAvoidance(allRobots);

      // If avoiding collision, slow down
      if (this.isAvoidingCollision) {
        this.speed = 0.5;
      } else {
        this.speed = 1.5;
      }

      if (this.pathIndex >= this.currentPath.length) {
        this.reachedDestination = true;
        return;
      }

      const target = this.currentPath[this.pathIndex];
      const direction = p5.Vector.sub(target, this.position);
      const distance = direction.mag();

      if (distance < this.speed) {
        this.position.set(target);
        this.traveledPath.push(this.position.copy());
        this.pathIndex++;
      } else {
        direction.normalize();
        direction.mult(this.speed);
        const previousPosition = this.position.copy();
        this.position.add(direction);
        
        this.traveledPath.push(this.position.copy());
        this.totalDistance += p5.Vector.dist(previousPosition, this.position);
      }
    }

    checkForCollisionAvoidance(allRobots) {
      let needsAvoidance = false;
      
      for (let otherRobot of allRobots) {
        if (otherRobot.id === this.id) continue;
        
        const distance = p5.Vector.dist(this.position, otherRobot.position);
        const collisionRadius = this.radius + otherRobot.radius + 30;
        
        if (distance < collisionRadius) {
          needsAvoidance = true;
          break;
        }
      }
      
      if (needsAvoidance && !this.isAvoidingCollision) {
        this.isAvoidingCollision = true;
        this.avoidanceStartTime = Date.now();
        setCollisionAvoidances(prev => prev + 1);
        this.createAvoidancePath();
      } else if (!needsAvoidance && this.isAvoidingCollision) {
        this.isAvoidingCollision = false;
        this.returnToOriginalPath();
      }
    }

    createAvoidancePath() {
      if (!this.hasDeviated) {
        this.hasDeviated = true;
        setPathDeviations(prev => prev + 1);
      }
      
      const currentPos = this.position.copy();
      const avoidanceOffset = 40;
      const angle = Math.random() * Math.PI * 2;
      const avoidancePoint = p5.Vector.createVector(
        currentPos.x + Math.cos(angle) * avoidanceOffset,
        currentPos.y + Math.sin(angle) * avoidanceOffset
      );
      
      let closestOriginalIndex = this.pathIndex;
      for (let i = this.pathIndex; i < this.originalPath.length; i++) {
        if (p5.Vector.dist(this.position, this.originalPath[i]) > 80) {
          closestOriginalIndex = i;
          break;
        }
      }
      
      this.currentPath = [
        currentPos,
        avoidancePoint,
        ...this.originalPath.slice(closestOriginalIndex)
      ];
      this.pathIndex = 0;
    }

    returnToOriginalPath() {
      let closestIndex = 0;
      let minDistance = Infinity;
      
      for (let i = 0; i < this.originalPath.length; i++) {
        const distance = p5.Vector.dist(this.position, this.originalPath[i]);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }
      
      this.currentPath = [...this.originalPath.slice(closestIndex)];
      this.pathIndex = 0;
    }

    recalculatePath(obstacles, allRobots = []) {
      this.originalPath = findPath(this.position, this.mission.end, obstacles, allRobots);
      this.currentPath = [...this.originalPath];
      this.pathIndex = 0;
      this.hasDeviated = false;
    }

    draw(p) {
      // Draw original path (faint dotted line)
      if (this.originalPath.length > 1) {
        p.stroke(100, 100, 255, 80);
        p.strokeWeight(1);
        p.drawingContext.setLineDash([5, 5]);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < this.originalPath.length; i++) {
          p.vertex(this.originalPath[i].x, this.originalPath[i].y);
        }
        p.endShape();
        p.drawingContext.setLineDash([]);
      }

      // Draw traveled path (solid bright line)
      if (this.traveledPath.length > 1) {
        p.stroke(0, 200, 0, 150);
        p.strokeWeight(2);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < this.traveledPath.length; i++) {
          p.vertex(this.traveledPath[i].x, this.traveledPath[i].y);
        }
        p.endShape();
      }

      // Draw current path (orange if deviating, blue if normal)
      if (this.currentPath.length > 1) {
        if (this.hasDeviated) {
          p.stroke(255, 165, 0, 150);
          p.strokeWeight(2);
        } else {
          p.stroke(100, 100, 255, 150);
          p.strokeWeight(2);
        }
        p.noFill();
        p.beginShape();
        p.vertex(this.position.x, this.position.y);
        for (let i = this.pathIndex; i < this.currentPath.length; i++) {
          p.vertex(this.currentPath[i].x, this.currentPath[i].y);
        }
        p.endShape();
      }

      // Draw collision detection radius when avoiding
      if (this.isAvoidingCollision) {
        p.fill(255, 100, 100, 20);
        p.noStroke();
        p.ellipse(this.position.x, this.position.y, (this.radius + 30) * 2, (this.radius + 30) * 2);
      }

      // Draw the robot with different colors based on state
      if (this.isAvoidingCollision) {
        p.fill(255, 100, 100);
      } else if (this.reachedDestination) {
        p.fill(0, 255, 0);
      } else {
        p.fill(0, 100, 255);
      }
      
      p.stroke(0, 50, 150);
      p.strokeWeight(2);
      p.ellipse(this.position.x, this.position.y, this.radius * 2, this.radius * 2);

      // Draw robot ID
      p.fill(255);
      p.textAlign(p.CENTER);
      p.textSize(10);
      p.text(this.id, this.position.x, this.position.y + 3);

      // Draw direction indicator
      if (!this.reachedDestination && this.pathIndex < this.currentPath.length) {
        const target = this.currentPath[this.pathIndex];
        const direction = p5.Vector.sub(target, this.position);
        if (direction.mag() > 0) {
          direction.normalize();
          direction.mult(this.radius + 6);
          const arrowEnd = p5.Vector.add(this.position, direction);
          
          p.stroke(255, 255, 0);
          p.strokeWeight(2);
          p.line(this.position.x, this.position.y, arrowEnd.x, arrowEnd.y);
        }
      }

      // Draw avoidance indicator
      if (this.isAvoidingCollision) {
        p.fill(255, 0, 0);
        p.textAlign(p.CENTER);
        p.textSize(8);
        p.text('AVOID', this.position.x, this.position.y - this.radius - 12);
      }
    }

    hasReachedDestination() {
      return this.reachedDestination;
    }

    getDistanceTraveled() {
      return this.totalDistance;
    }
  }

  // Initialize simulation elements
  useEffect(() => {
    setObstacles(generateObstacles());
    setPickupPoints(generatePickupPoints());
    setDropoffPoints(generateDropoffPoints());
  }, []);

  // p5.js setup
  useEffect(() => {
    if (!canvasRef.current) return;

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(1000, 700);
        canvas.parent(canvasRef.current);
        p.background(240);
      };

      p.draw = () => {
        p.background(240);

        // Draw no-go zone if active
        if (noGoZone.isActive) {
          p.fill(255, 0, 0, 50);
          p.stroke(255, 0, 0, 150);
          p.strokeWeight(2);
          p.rect(noGoZone.x, noGoZone.y, noGoZone.width, noGoZone.height);
          p.fill(255, 0, 0);
          p.textAlign(p.CENTER);
          p.textSize(12);
          p.text('NO-GO ZONE', noGoZone.x + noGoZone.width/2, noGoZone.y + noGoZone.height/2);
        }

        // Draw obstacles with shelving graphics
        obstacles.forEach(obstacle => {
          if (obstacle.dragging) {
            p.fill(150, 150, 150);
            p.stroke(100, 100, 100);
          } else {
            p.fill(120, 120, 120);
            p.stroke(80, 80, 80);
          }
          p.strokeWeight(2);
          p.rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
          
          // Draw shelving details
          p.fill(100, 100, 100);
          p.noStroke();
          // Horizontal shelves
          for (let i = 1; i < 3; i++) {
            const shelfY = obstacle.y + (obstacle.height / 3) * i;
            p.rect(obstacle.x + 3, shelfY - 1, obstacle.width - 6, 2);
          }
          // Vertical supports
          for (let i = 1; i < 3; i++) {
            const supportX = obstacle.x + (obstacle.width / 3) * i;
            p.rect(supportX - 1, obstacle.y + 3, 2, obstacle.height - 6);
          }
        });

        // Draw pickup points
        pickupPoints.forEach(point => {
          p.fill(0, 255, 0);
          p.stroke(0, 200, 0);
          p.strokeWeight(2);
          p.ellipse(point.x, point.y, 8, 8);
        });

        // Draw dropoff points
        dropoffPoints.forEach(point => {
          p.fill(0, 100, 255);
          p.stroke(0, 50, 200);
          p.strokeWeight(2);
          p.rect(point.x - 8, point.y - 8, 16, 16);
          p.fill(255);
          p.textAlign(p.CENTER);
          p.textSize(8);
          p.text('DROP', point.x, point.y + 2);
        });

        // Update and draw robots only when running
        if (simulationState === 'running') {
          if (!startTime) {
            setStartTime(Date.now());
          }

          robots.forEach(robot => {
            robot.update(robots, obstacles);
            robot.draw(p);
          });

          // Check if all robots have reached their destination
          const allRobotsFinished = robots.every(robot => robot.hasReachedDestination());
          if (allRobotsFinished && robots.length > 0) {
            setSimulationState('stopped');
          }
        }

        // Draw robots when paused or stopped (for visualization)
        if ((simulationState === 'paused' || simulationState === 'stopped') && robots.length > 0) {
          robots.forEach(robot => {
            robot.draw(p);
          });
        }

        // Draw instructions
        if (simulationState === 'running') {
          p.fill(0, 0, 0, 150);
          p.noStroke();
          p.rect(10, 10, 350, 100);
          p.fill(255);
          p.textAlign(p.LEFT);
          p.textSize(12);
          p.text('Drag inventory racks to optimize layout', 20, 30);
          p.text('Robots proactively avoid congested routes', 20, 45);
          p.text(`Active Robots: ${robots.length}/${MAX_ROBOTS}`, 20, 60);
          p.text('Green dots: Pickup points | Blue squares: Dropoff stations', 20, 75);
          p.text('Dotted lines: Original paths | Orange lines: Avoidance paths', 20, 90);
        }
      };

      // Mouse interaction for dragging obstacles
      p.mousePressed = () => {
        if (simulationState === 'running' || simulationState === 'paused') {
          for (let i = 0; i < obstacles.length; i++) {
            const obstacle = obstacles[i];
            if (p.mouseX >= obstacle.x && p.mouseX <= obstacle.x + obstacle.width &&
                p.mouseY >= obstacle.y && p.mouseY <= obstacle.y + obstacle.height) {
              const newObstacles = [...obstacles];
              newObstacles[i].dragging = true;
              setObstacles(newObstacles);
              setDraggedObstacle({ index: i, offset: { x: p.mouseX - obstacle.x, y: p.mouseY - obstacle.y } });
              break;
            }
          }
        }
      };

      p.mouseDragged = () => {
        if (draggedObstacle.index !== null) {
          const newObstacles = [...obstacles];
          const obstacle = newObstacles[draggedObstacle.index];
          const newX = p.constrain(p.mouseX - draggedObstacle.offset.x, 0, p.width - obstacle.width);
          const newY = p.constrain(p.mouseY - draggedObstacle.offset.y, 0, p.height - obstacle.height);
          
          obstacle.x = newX;
          obstacle.y = newY;
          setObstacles(newObstacles);
          
          // Recalculate paths for all robots
          robots.forEach(robot => {
            robot.recalculatePath(obstacles, robots);
          });
        }
      };

      p.mouseReleased = () => {
        if (draggedObstacle.index !== null) {
          const newObstacles = [...obstacles];
          newObstacles[draggedObstacle.index].dragging = false;
          setObstacles(newObstacles);
          setDraggedObstacle({ index: null, offset: { x: 0, y: 0 } });
        }
      };
    };

    p5InstanceRef.current = new p5(sketch);

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
      }
    };
  }, [simulationState, robots, obstacles, pickupPoints, dropoffPoints, noGoZone, startTime, draggedObstacle]);

  // Control functions
  const addRobot = () => {
    if (robots.length >= MAX_ROBOTS) return;

    // Select random pickup and dropoff points
    const randomPickup = pickupPoints[Math.floor(Math.random() * pickupPoints.length)];
    const randomDropoff = dropoffPoints[Math.floor(Math.random() * dropoffPoints.length)];

    const newRobot = new Robot(nextRobotId, {
      start: randomPickup,
      end: randomDropoff
    }, robots);

    setRobots(prev => [...prev, newRobot]);
    setNextRobotId(prev => prev + 1);
    
    // Start simulation if it was stopped
    if (simulationState === 'stopped') {
      setSimulationState('running');
      setStartTime(Date.now());
    }
  };

  const togglePause = () => {
    if (simulationState === 'running') {
      setSimulationState('paused');
      setPausedTime(Date.now());
    } else if (simulationState === 'paused') {
      setSimulationState('running');
      setStartTime(prev => prev + (Date.now() - pausedTime));
    }
  };

  const resetSimulation = () => {
    setRobots([]);
    setSimulationState('stopped');
    setStartTime(0);
    setPausedTime(0);
    setCollisionAvoidances(0);
    setPathDeviations(0);
    setNextRobotId(1);
    
    // Reset obstacles to original positions
    setObstacles(generateObstacles());
  };

  const toggleNoGoZone = () => {
    setNoGoZone(prev => ({ ...prev, isActive: !prev.isActive }));
    
    // Recalculate paths for all robots when no-go zone changes
    robots.forEach(robot => {
      robot.recalculatePath(obstacles, robots);
    });
  };

  // Calculate metrics
  const getElapsedTime = () => {
    if ((simulationState === 'running' || simulationState === 'paused') && robots.length > 0) {
      return ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    } else if (simulationState === 'stopped' && robots.length > 0) {
      return ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    }
    return '0s';
  };

  const getTotalDistance = () => {
    if (robots.length > 0) {
      const totalDistance = robots.reduce((sum, robot) => sum + robot.getDistanceTraveled(), 0);
      return Math.round(totalDistance) + 'px';
    }
    return '0px';
  };

  const getEfficiencyScore = () => {
    const avoidingRobots = robots.filter(robot => robot.isAvoidingCollision).length;
    const efficiency = Math.max(0, 100 - (avoidingRobots / Math.max(robots.length, 1)) * 60);
    return Math.round(efficiency) + '%';
  };

  return (
    <div className="App">
      <div className="container">
        <h1>🏭 Choreographer - Proactive Flow Engine</h1>
        <p className="subtitle">Intelligent Warehouse Fleet Management with Congestion-Aware Pathfinding</p>
        
        <div className="controls">
          <button 
            className="add-robot-btn"
            onClick={addRobot}
            disabled={robots.length >= MAX_ROBOTS}
          >
            Add Robot ({robots.length}/{MAX_ROBOTS})
          </button>
          <button 
            className="pause-btn"
            onClick={togglePause}
            disabled={robots.length === 0}
          >
            {simulationState === 'running' ? 'Pause' : simulationState === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button className="reset-btn" onClick={resetSimulation}>
            Reset
          </button>
          <button className="no-go-zone-btn" onClick={toggleNoGoZone}>
            Toggle No-Go Zone
          </button>
        </div>
        
        <div className="metrics">
          <div className="metric">
            <span className="metric-label">Robot Count</span>
            <span className="metric-value">{robots.length}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Mission Time</span>
            <span className="metric-value">{getElapsedTime()}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Total Distance</span>
            <span className="metric-value">{getTotalDistance()}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Collision Avoidances</span>
            <span className="metric-value">{collisionAvoidances}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Path Deviations</span>
            <span className="metric-value">{pathDeviations}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Efficiency Score</span>
            <span className="metric-value">{getEfficiencyScore()}</span>
          </div>
        </div>
        
        <div className="canvas-container">
          <div className={`status-indicator status-${simulationState}`}>
            {simulationState.charAt(0).toUpperCase() + simulationState.slice(1)}
          </div>
          <div ref={canvasRef}></div>
        </div>
        
        <div className="info">
          <h3>🎯 Proactive Flow Engine Demo</h3>
          <p>This simulation demonstrates intelligent warehouse logistics with congestion-aware pathfinding and dynamic collision avoidance.</p>
          
          <div className="demo-instructions">
            <h4>🚀 Demo Instructions:</h4>
            <ol>
              <li><strong>Add Robots:</strong> Scale the fleet (max 10) and watch intelligent pathfinding</li>
              <li><strong>Observe Congestion:</strong> See robots proactively avoid crowded routes</li>
              <li><strong>Optimize Layout:</strong> Drag inventory racks to create better pathways</li>
              <li><strong>Toggle No-Go Zone:</strong> See how removing restrictions improves flow</li>
              <li><strong>Pause & Analyze:</strong> Use pause to study bottlenecks and plan optimizations</li>
            </ol>
          </div>
          
          <h4>🎮 Interactive Features:</h4>
          <ul>
            <li><strong>Fleet Scaling:</strong> Add robots up to 10 to test congestion limits</li>
            <li><strong>Proactive Pathfinding:</strong> Robots avoid congested routes before collisions occur</li>
            <li><strong>Draggable Inventory Racks:</strong> Optimize warehouse layout in real-time</li>
            <li><strong>Persistent Path Visualization:</strong> See original vs. adapted routes</li>
            <li><strong>No-Go Zone Management:</strong> Toggle restrictions to demonstrate flow optimization</li>
          </ul>
          
          <h4>🎨 Visual Indicators:</h4>
          <ul>
            <li><strong>Blue circles:</strong> Active robots (numbered)</li>
            <li><strong>Red circles:</strong> Robots avoiding collisions</li>
            <li><strong>Green circles:</strong> Completed missions</li>
            <li><strong>Gray shelves:</strong> Inventory racks (drag to optimize)</li>
            <li><strong>Green dots:</strong> Pickup points</li>
            <li><strong>Blue squares:</strong> Dropoff stations</li>
            <li><strong>Dotted blue lines:</strong> Original planned paths</li>
            <li><strong>Solid green lines:</strong> Traveled paths</li>
            <li><strong>Orange lines:</strong> Collision avoidance deviations</li>
            <li><strong>Red zone:</strong> No-go zone (toggleable)</li>
          </ul>
          
          <div className="fleet-limit">
            <strong>Fleet Limit:</strong> Maximum 10 robots to maintain realistic warehouse constraints
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
