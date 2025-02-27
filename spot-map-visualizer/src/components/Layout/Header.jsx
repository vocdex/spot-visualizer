// src/components/Layout/Header.jsx
import React from 'react';
import './Header.css';

const Header = ({ 
  useAnchoring, 
  onAnchoringToggle, 
  showLabels, 
  onLabelToggle, 
  view3D, 
  onViewToggle 
}) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <h1>Spot Map Visualizer</h1>
      </div>
      
      <div className="header-controls">
        <div className="control-item">
          <label>
            <input
              type="checkbox"
              checked={useAnchoring}
              onChange={onAnchoringToggle}
            />
            Use Anchoring
          </label>
        </div>
        
        <div className="control-item">
          <label>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={onLabelToggle}
            />
            Show Labels
          </label>
        </div>
        
        <div className="control-item">
          <label>
            <input
              type="checkbox"
              checked={!view3D}
              onChange={onViewToggle}
            />
            2D View
          </label>
        </div>
      </div>
    </header>
  );
};

export default Header;