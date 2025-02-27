// src/components/WaypointManager/WaypointPanel.jsx
import React, { useState, useEffect } from 'react';
import { formatImageUrl } from '../../services/api';
import './WaypointPanel.css';

const WaypointPanel = ({ waypointData, waypointImages, onLabelUpdate }) => {
  const [newLabel, setNewLabel] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Reset the edit state when waypoint changes
  useEffect(() => {
    if (waypointData) {
      setNewLabel(waypointData.label || '');
      setIsEditing(false);
    }
  }, [waypointData]);
  
  // Handle saving the new label
  const handleSave = () => {
    if (!waypointData || !newLabel.trim()) return;
    
    onLabelUpdate(waypointData.id, newLabel.trim());
    setIsEditing(false);
  };
  
  // Handle canceling the edit
  const handleCancel = () => {
    setNewLabel(waypointData?.label || '');
    setIsEditing(false);
  };
  
  // Format position for display
  const formatPosition = (position) => {
    if (!position) return 'Unknown';
    return `X: ${position[0].toFixed(2)}, Y: ${position[1].toFixed(2)}, Z: ${position[2].toFixed(2)}`;
  };
  
  // If no waypoint is selected
  if (!waypointData) {
    return (
      <div className="waypoint-panel">
        <h2>Waypoint Information</h2>
        <p className="no-selection">No waypoint selected. Click on a waypoint in the map to view details.</p>
      </div>
    );
  }
  
  return (
    <div className="waypoint-panel">
      <h2>Waypoint Information</h2>
      
      <div className="waypoint-id">
        <strong>ID:</strong> {waypointData.id}
      </div>
      
      <div className="waypoint-label">
        <strong>Label:</strong>
        {isEditing ? (
          <div className="label-edit">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Enter location name"
            />
            <div className="edit-buttons">
              <button onClick={handleSave} className="save-button">Save</button>
              <button onClick={handleCancel} className="cancel-button">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="label-display">
            <span>{waypointData.label || '(No label)'}</span>
            <button onClick={() => setIsEditing(true)} className="edit-button">Edit</button>
          </div>
        )}
      </div>
      
      <div className="waypoint-position">
        <strong>Position:</strong> {formatPosition(waypointData.position)}
      </div>
      
      {waypointData.objects && waypointData.objects.length > 0 && (
        <div className="waypoint-objects">
          <strong>Visible Objects:</strong>
          <ul>
            {waypointData.objects.map((obj, index) => (
              <li key={index}>{obj}</li>
            ))}
          </ul>
        </div>
      )}
      
      {waypointData.snapshot_id && (
        <div className="waypoint-snapshot">
          <strong>Snapshot ID:</strong> {waypointData.snapshot_id}
        </div>
      )}
      
      {waypointImages && (
        <div className="waypoint-images">
          <h3>Camera Views</h3>
          <div className="image-container">
            {waypointImages.left && (
              <div className="image-box">
                <h4>Left View</h4>
                <img 
                  src={formatImageUrl(waypointImages.left)} 
                  alt="Left Camera View" 
                  className="camera-image"
                />
              </div>
            )}
            
            {waypointImages.right && (
              <div className="image-box">
                <h4>Right View</h4>
                <img 
                  src={formatImageUrl(waypointImages.right)} 
                  alt="Right Camera View" 
                  className="camera-image"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WaypointPanel;