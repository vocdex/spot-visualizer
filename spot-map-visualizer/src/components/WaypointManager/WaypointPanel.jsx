// src/components/WaypointManager/WaypointPanel.jsx
import React, { useState, useEffect } from 'react';
import { formatImageUrl } from '../../services/api';
import './WaypointPanel.css';

const WaypointPanel = ({ waypointData, waypointImages, onLabelUpdate }) => {
  const [newLabel, setNewLabel] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null);

  // Reset the edit state when waypoint changes
  useEffect(() => {
    if (waypointData) {
      setNewLabel(waypointData.label || '');
      setIsEditing(false);
      setExpandedImage(null);
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

  // Handle image click to expand
  const handleImageClick = (type) => {
    setExpandedImage(expandedImage === type ? null : type);
  };

  // Close expanded image
  const closeExpandedImage = () => {
    setExpandedImage(null);
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

      {/* Camera view images - now at the top with thumbnails */}
      {waypointImages && (
        <div className="waypoint-images">
          <h3>Camera Views</h3>
          <div className="image-thumbnails">
            {waypointImages.left && (
              <div
                className={`image-thumbnail ${expandedImage === 'left' ? 'selected' : ''}`}
                onClick={() => handleImageClick('left')}
              >
                <img
                  src={formatImageUrl(waypointImages.left)}
                  alt="Left View"
                />
                <span>Left View</span>
              </div>
            )}

            {waypointImages.right && (
              <div
                className={`image-thumbnail ${expandedImage === 'right' ? 'selected' : ''}`}
                onClick={() => handleImageClick('right')}
              >
                <img
                  src={formatImageUrl(waypointImages.right)}
                  alt="Right View"
                />
                <span>Right View</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expanded image modal */}
      {expandedImage && waypointImages && waypointImages[expandedImage] && (
        <div className="expanded-image-overlay" onClick={closeExpandedImage}>
          <div className="expanded-image-container" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closeExpandedImage}>×</button>
            <h3>{expandedImage === 'left' ? 'Left View' : 'Right View'}</h3>
            <img
              src={formatImageUrl(waypointImages[expandedImage])}
              alt={`${expandedImage} View`}
              className="expanded-image"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WaypointPanel;
