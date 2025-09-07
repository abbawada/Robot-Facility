# 🏭 Choreographer - Proactive Flow Engine

A realistic warehouse logistics simulation demonstrating intelligent AMR (Autonomous Mobile Robot) fleet management with congestion-aware pathfinding and dynamic collision avoidance.

## 🎯 Overview

Choreographer is an interactive simulation that showcases how intelligent fleet management systems can proactively avoid congestion while maintaining efficiency through dynamic pathfinding and workspace optimization. It demonstrates real-world warehouse logistics challenges and solutions.

## ✨ Key Features

### 🤖 Intelligent Robot Behavior
- **Proactive Pathfinding**: Robots avoid congested routes before collisions occur
- **Dynamic Collision Avoidance**: Real-time adaptation to other robots' movements
- **Persistent Trajectory Visualization**: See original vs. adapted routes
- **Speed Control**: Automatic speed adjustment based on congestion levels

### 🏗️ Warehouse Environment
- **20 Inventory Racks**: Dense shelving grid with realistic graphics
- **15 Pickup Points**: Distributed throughout the warehouse
- **3 Dropoff Stations**: Clustered for efficient logistics
- **Draggable Obstacles**: Real-time layout optimization
- **No-Go Zone**: Toggleable restricted area for flow optimization

### 📊 Real-time Metrics
- Robot count and fleet status
- Mission time and distance traveled
- Collision avoidances and path deviations
- Efficiency scoring system

## 🚀 Getting Started

### Option 1: Standalone HTML (Recommended)
1. Download the `index.html` file
2. Open it in any modern web browser
3. No installation or setup required!

### Option 2: React Development Version
1. Clone this repository
2. Install dependencies: `npm install`
3. Start development server: `npm start`
4. Open [http://localhost:3000](http://localhost:3000)

## 🎮 How to Use

### Demo Flow
1. **Add Robots**: Click "Add Robot" to scale your fleet (max 10)
2. **Observe Intelligence**: Watch robots proactively avoid congested routes
3. **Optimize Layout**: Drag inventory racks to create better pathways
4. **Toggle No-Go Zone**: See how removing restrictions improves flow
5. **Pause & Analyze**: Use pause to study bottlenecks and plan optimizations

### Interactive Features
- **Fleet Scaling**: Add robots up to 10 to test congestion limits
- **Layout Optimization**: Drag inventory racks in real-time
- **Constraint Management**: Toggle no-go zone to demonstrate flow optimization
- **Visual Analysis**: Multiple path visualization layers for clear understanding

## 🎨 Visual Indicators

| Element | Description |
|---------|-------------|
| 🔵 Blue circles | Active robots (numbered) |
| 🔴 Red circles | Robots avoiding collisions |
| 🟢 Green circles | Completed missions |
| ⬜ Gray shelves | Inventory racks (draggable) |
| 🟢 Green dots | Pickup points |
| 🔵 Blue squares | Dropoff stations |
| 📏 Dotted blue lines | Original planned paths |
| 📏 Solid green lines | Traveled paths |
| 🟠 Orange lines | Collision avoidance deviations |
| 🚫 Red zone | No-go zone (toggleable) |

## 🧠 Technical Architecture

### Proactive Flow Engine
- **Congestion Penalty System**: Evaluates paths based on proximity to other robot routes
- **Multi-Strategy Pathfinding**: Tries multiple approaches around obstacles
- **Path Scoring Algorithm**: Balances congestion avoidance vs. path length
- **Real-time Adaptation**: Recalculates when environment changes

### Robot Intelligence
- **Collision-First Logic**: Prioritizes avoiding other robots over following original paths
- **Dynamic Speed Control**: Adjusts speed based on congestion levels
- **Intelligent Path Recovery**: Returns to original path when collision threat passes
- **State Management**: Clear visual indicators for different robot states

## 🎯 Engineering Demonstrations

### Core Problems Solved
1. **Proactive vs Reactive**: Robots avoid congestion before it happens
2. **Dynamic Adaptation**: Real-time path recalculation on layout changes
3. **Fleet Scaling**: How adding robots creates and solves congestion challenges
4. **Workspace Optimization**: Visual impact of layout changes on efficiency
5. **Constraint Management**: No-go zone as example of rigid vs. flexible rules

### Use Cases
- **Warehouse Design**: Test different layouts for optimal robot flow
- **Fleet Planning**: Determine optimal robot count for given space
- **Training**: Educate teams on AMR coordination principles
- **Research**: Study congestion patterns and optimization strategies

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Graphics**: p5.js for 2D rendering and animation
- **Architecture**: Object-oriented design with modular components
- **Pathfinding**: Custom congestion-aware algorithm
- **State Management**: Centralized simulation state

## 📁 Project Structure

```
AMR simulation/
├── index.html              # Standalone simulation (main file)
├── src/                    # React development version
│   ├── components/         # UI components
│   ├── simulation/         # Core simulation logic
│   └── App.js             # Main application
├── package.json           # Dependencies and scripts
├── README.md              # This file
└── .gitignore            # Git ignore rules
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [p5.js](https://p5js.org/) for graphics and animation
- Inspired by real-world warehouse automation challenges
- Designed for educational and demonstration purposes

## 📞 Support

For questions, issues, or contributions, please open an issue on GitHub or contact the development team.

---

**Ready to optimize your warehouse fleet?** 🚀 Open `index.html` and start your simulation!