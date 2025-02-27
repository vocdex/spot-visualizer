// Create a new file src/components/MapViewer/SimpleMapView.jsx
import React from 'react';

const SimpleMapView = ({ mapData }) => {
  if (!mapData) return <div>No map data available</div>;
  
  return (
    <div style={{ padding: '20px' }}>
      <h3>Simple Map View</h3>
      <p>Waypoints: {mapData.waypoints.length}</p>
      <p>Edges: {mapData.edges.length}</p>
      <div style={{ maxHeight: '300px', overflow: 'auto' }}>
        <h4>Waypoints:</h4>
        <ul>
          {mapData.waypoints.slice(0, 10).map(waypoint => (
            <li key={waypoint.id}>
              ID: {waypoint.id}, Label: {waypoint.label || '(no label)'}
            </li>
          ))}
          {mapData.waypoints.length > 10 && <li>... and {mapData.waypoints.length - 10} more</li>}
        </ul>
      </div>
    </div>
  );
};

export default SimpleMapView;