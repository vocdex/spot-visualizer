// src/components/ObjectFilter/ObjectFilterPanel.jsx
import React from 'react';
import './ObjectFilterPanel.css';

const ObjectFilterPanel = ({ allObjects, filteredObjects, onObjectFilter }) => {
  // Handle checkbox change
  const handleObjectToggle = (object) => {
    const updatedObjects = [...filteredObjects];
    
    if (updatedObjects.includes(object)) {
      // Remove the object if it's already filtered
      const index = updatedObjects.indexOf(object);
      updatedObjects.splice(index, 1);
    } else {
      // Add the object to the filter
      updatedObjects.push(object);
    }
    
    onObjectFilter(updatedObjects);
  };
  
  // Clear all filters
  const handleClearFilters = () => {
    onObjectFilter([]);
  };
  
  // If there are no objects
  if (!allObjects || allObjects.length === 0) {
    return (
      <div className="object-filter-panel">
        <h2>Filter by Object</h2>
        <p className="no-objects">No objects found in the environment.</p>
      </div>
    );
  }
  
  return (
    <div className="object-filter-panel">
      <div className="panel-header">
        <h2>Filter by Object</h2>
        {filteredObjects.length > 0 && (
          <button 
            className="clear-filters-button" 
            onClick={handleClearFilters}
          >
            Clear All
          </button>
        )}
      </div>
      
      <div className="filter-description">
        {filteredObjects.length === 0 ? (
          <p>Select objects to highlight waypoints where they are visible.</p>
        ) : (
          <p>
            <strong>{filteredObjects.length}</strong> object{filteredObjects.length !== 1 ? 's' : ''} selected. 
            Waypoints containing these objects are highlighted on the map.
          </p>
        )}
      </div>
      
      <div className="object-list">
        {allObjects.map((object) => (
          <div key={object} className="object-item">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filteredObjects.includes(object)}
                onChange={() => handleObjectToggle(object)}
              />
              <span className="checkbox-custom"></span>
              <span className="object-name">{object}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ObjectFilterPanel;