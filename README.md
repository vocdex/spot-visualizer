# Spot Map Visualizer

This application helps visualize and interact with Spot robot's GraphNav maps. It consists of:

1. **Flask Backend**: Processes and serves GraphNav map data
2. **React Frontend**: Provides an interactive 2D visualization of the map

![Spot Map Visualizer](./spot-map-visualizer/assets/spot_visualizer.gif)


## Running the Application

### Setup Backend (Flask)

1. Install requirements:
   ```python
   pip install flask flask-cors opencv-python numpy scipy bosdyn-client pillow
   ```

2. Run the Flask server:
   ```python
   python app.py --map-path /path/to/map --rag-path /path/to/rag_db --port 5000
   ```
In **map-path**, we expect a folder containing GraphNav map files:
- `graph`
- `edge_snapshots`
- `waypoint_snapshots`
In **rag-path**, we expect a folder containing the RAG database file:
- `index.faiss`
- `index.pkl`
- `metadata_waypoint_id.json` for each waypoint
To build such a database, please refer to the main project repository at [SpottyAI](https://github.com/vocdex/SpottyAI)


### Setup Frontend (React)

1. Navigate to the React app directory:
   ```bash
   cd spot-map-visualizer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```
If there is an error, you might have to set the following:
```bash
export NODE_OPTIONS=--openssl-legacy-provider
```

The application should be accessible at http://localhost:3000

## Key Features

- **2D Map Visualization**: Interactive canvas-based rendering with pan and zoom
- **Waypoint Selection**: Click on waypoints to view details and camera images
- **Object Filtering**: Filter waypoints by visible objects
- **Waypoint Labeling**: Edit waypoint labels with automatic updates
- **Multiple Views**: Toggle between anchored and non-anchored coordinate frames

### Tested On
- Python 3.8.20
- Node v22.13.0
- npm 10.9.2
- React 19.0.0
- MacOS 12.4


## Future Enhancements
It would be great to add the following features:
- Path planning and visualization:
  - A* path planning
  - Path visualization on the map
- Real-time updates with WebSockets and Spot SDK
