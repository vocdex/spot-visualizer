# Spot Map Visualizer - Project Guide

## Project Overview

This application helps visualize and interact with Spot robot's GraphNav maps. It consists of:

1. **Flask Backend**: Processes and serves GraphNav map data
2. **React Frontend**: Provides an interactive 2D visualization of the map

## Fixed Issues

We've fixed several issues in the codebase:

1. **Missing Components**: Added Header, Sidebar and fixed EnhancedMapView
2. **React Version**: Updated to a stable version (18.2.0) from the non-existent v19
3. **Component Changes**: Replaced the missing ThreeJSScene with EnhancedMapView for 2D visualization
4. **CSS Layout**: Added proper layout styling for the application
5. **Navigation Controls**: Enhanced map controls and tooltips

## Directory Structure

```
spot-map-visualizer/
├── backend/
│   └── app.py              # Flask server 
├── public/                 # React public assets
└── src/
    ├── App.js              # Main React app
    ├── components/         # React components
    │   ├── Layout/         # UI layout components
    │   │   ├── Header.jsx
    │   │   └── Sidebar.jsx
    │   ├── MapViewer/      # Map visualization
    │   │   └── EnhancedMapView.jsx
    │   ├── ObjectFilter/   # Object filtering components
    │   └── WaypointManager/# Waypoint management
    └── services/           # API services
        └── api.js
```

## Running the Application

### Setup Backend (Flask)

1. Install requirements:
   ```bash
   pip install flask flask-cors opencv-python numpy scipy bosdyn-client pillow
   ```

2. Run the Flask server:
   ```bash
   python app.py --map-path /path/to/map --rag-path /path/to/rag_db --port 5000
   ```

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

The application should be accessible at http://localhost:3000

## Key Features

- **2D Map Visualization**: Interactive canvas-based rendering with pan and zoom
- **Waypoint Selection**: Click on waypoints to view details and camera images
- **Object Filtering**: Filter waypoints by visible objects
- **Waypoint Labeling**: Edit waypoint labels with automatic updates
- **Multiple Views**: Toggle between anchored and non-anchored coordinate frames

## Troubleshooting

### Common Issues

1. **"Failed to load map data" Error**: This typically means one of the following:
   - The Flask backend is not running - start it with `python app.py`
   - The backend is running on a different port - check API_BASE_URL in `src/services/api.js`
   - The map path provided to the Flask app doesn't exist or doesn't contain valid GraphNav data
   - CORS is blocking the request - check browser console for specific errors

2. **CORS Errors**: If you see CORS errors in the browser console:
   - Ensure the Flask server has CORS enabled (it should be with our setup)
   - Try running both frontend and backend on the same host/port
   - Use a CORS browser extension temporarily for testing

3. **Backend Connection**: Make sure the Flask backend is running on port 5000, or update the API_BASE_URL in `src/services/api.js` to match your configuration.

4. **Image Loading**: If waypoint images don't load, check if the waypoint snapshots directory exists in your map path.

### Missing Data

If the map doesn't load or appears empty:

1. Check your GraphNav map path provided to the Flask app
2. Ensure the graph file exists in the map directory
3. Inspect the browser's developer console for errors

## Future Enhancements

As mentioned in the project overview, future enhancements could include:

- Path planning and visualization
- Map editing capabilities
- Mission planning
- Multi-robot support
- Real-time updates with WebSockets