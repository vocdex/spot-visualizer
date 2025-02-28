// src/components/Layout/Header.jsx
import React from 'react';
import './Header.css';

const Header = ({
  useAnchoring,
  onAnchoringToggle,
  showLabels,
  onLabelToggle
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
      </div>
    </header>
  );
};

export default Header;
