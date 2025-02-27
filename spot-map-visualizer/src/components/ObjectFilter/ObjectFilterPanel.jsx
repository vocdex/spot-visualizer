// src/components/ObjectFilter/ObjectFilterPanel.jsx
import React, { useEffect } from 'react';
import './ObjectFilterPanel.css';

const ObjectFilterPanel = ({ allObjects, filteredObjects, onObjectFilter }) => {
  // Validate inputs on mount and update
  useEffect(() => {
    if (!Array.isArray(allObjects)) {
      console.warn("ObjectFilterPanel: allObjects is not an array", allObjects);
    }
    
    if (!Array.isArray(filteredObjects)) {
      console.warn("ObjectFilterPanel: filteredObjects is not an array", filteredObjects);
      // Fix by setting to empty array
      onObjectFilter([]);
    }
  }, [allObjects, filteredObjects, onObjectFilter]);
  
  // Handle checkbox change with scroll prevention
  const handleObjectToggle = (e, object) => {
    // Prevent default behavior to stop page scrolling
    e.preventDefault();
    
    try {
      console.log(`Toggling object: ${object}`);
      
      // Create a safe copy of filtered objects
      const updatedObjects = Array.isArray(filteredObjects) ? [...filteredObjects] : [];
      
      if (updatedObjects.includes(object)) {
        // Remove the object if it's already filtered
        const index = updatedObjects.indexOf(object);
        updatedObjects.splice(index, 1);
        console.log(`Removed object: ${object}, new filtered list: ${updatedObjects}`);
      } else {
        // Add the object to the filter
        updatedObjects.push(object);
        console.log(`Added object: ${object}, new filtered list: ${updatedObjects}`);
      }
      
      onObjectFilter(updatedObjects);
    } catch (error) {
      console.error("Error toggling object filter:", error);
      // Reset filters on error
      onObjectFilter([]);
    }
  };
  
  // Clear all filters with scroll prevention
  const handleClearFilters = (e) => {
    // Prevent default behavior to stop page scrolling
    e.preventDefault();
    
    console.log("Clearing all filters");
    onObjectFilter([]);
  };
  
  // Create safe versions of the arrays
  const safeAllObjects = Array.isArray(allObjects) ? allObjects : [];
  const safeFilteredObjects = Array.isArray(filteredObjects) ? filteredObjects : [];
  
  // If there are no objects
  if (safeAllObjects.length === 0) {
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
        {safeFilteredObjects.length > 0 && (
          <button 
            className="clear-filters-button" 
            onClick={handleClearFilters}
          >
            Clear All
          </button>
        )}
      </div>
      
      <div className="filter-description">
        {safeFilteredObjects.length === 0 ? (
          <p>Select objects to highlight waypoints where they are visible.</p>
        ) : (
          <p>
            <strong>{safeFilteredObjects.length}</strong> object{safeFilteredObjects.length !== 1 ? 's' : ''} selected. 
            Waypoints containing these objects are highlighted on the map.
          </p>
        )}
      </div>
      
      <div className="object-list">
        {safeAllObjects.map((object) => (
          <div key={object} className="object-item">
            <label 
              className="checkbox-label"
              onClick={(e) => {
                // Stop propagation to prevent any parent elements from receiving the click
                e.stopPropagation();
              }}
            >
              <input
                type="checkbox"
                checked={safeFilteredObjects.includes(object)}
                onChange={(e) => handleObjectToggle(e, object)}
                // Add this to prevent default scrolling behavior on input change
                onClick={(e) => e.stopPropagation()}
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