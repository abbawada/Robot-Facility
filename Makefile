CXX = clang++
CXXFLAGS = -std=c++17 -O2 -I"$(WEBOTS_HOME)/include/controller/c"

LIBS = -L"$(WEBOTS_HOME)/lib/controller" -lController -lcurl

TARGET = youbot_pickplace_cpp
SRC = youbot_pickplace_cpp.c
SRC = youbot_pickplace_cpp.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(SRC) $(LIBS)

clean:
	rm -f $(TARGET)
