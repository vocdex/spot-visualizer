// src/components/ObjectFilter/ObjectFilterPanel.jsx
import React, { useEffect, useState } from 'react';
import './ObjectFilterPanel.css';

const ObjectFilterPanel = ({ allObjects, filteredObjects, onObjectFilter }) => {
  // Track whether a click is being processed to prevent double-clicks
  const [processingClick, setProcessingClick] = useState(false);
  
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
  
  // Handle checkbox change with safer click handling
  const handleObjectToggle = (event, object) => {
    // Completely prevent default behavior and stop propagation
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Prevent rapid clicking
    if (processingClick) return;
    
    try {
      // Lock to prevent multiple concurrent updates
      setProcessingClick(true);
      
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
      
      // Ensure a safe update
      setTimeout(() => {
        onObjectFilter(updatedObjects);
        // Release the lock with a short delay to prevent rapid clicking
        setTimeout(() => setProcessingClick(false), 100);
      }, 10);
      
    } catch (error) {
      console.error("Error toggling object filter:", error);
      // Reset filters on error
      onObjectFilter([]);
      setProcessingClick(false);
    }
  };
  
  // Clear all filters with enhanced safety
  const handleClearFilters = (event) => {
    // Completely prevent default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Prevent during active processing
    if (processingClick) return;
    
    setProcessingClick(true);
    console.log("Clearing all filters");
    
    // Use timeout to ensure clean state updates
    setTimeout(() => {
      onObjectFilter([]);
      setTimeout(() => setProcessingClick(false), 100);
    }, 10);
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
            disabled={processingClick}
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
            <div 
              className="checkbox-label"
              onClick={(e) => handleObjectToggle(e, object)}
              style={{ cursor: processingClick ? 'wait' : 'pointer' }}
            >
              {/* Hide the actual checkbox to prevent browser defaults */}
              <input
                type="checkbox"
                checked={safeFilteredObjects.includes(object)}
                onChange={() => {}} // Empty handler since we handle in the div onClick
                style={{ opacity: 0, position: 'absolute' }}
              />
              <span 
                className="checkbox-custom" 
                style={{ 
                  backgroundColor: safeFilteredObjects.includes(object) ? '#2196f3' : 'white',
                  borderColor: safeFilteredObjects.includes(object) ? '#2196f3' : '#ccc'
                }}
              ></span>
              <span className="object-name">{object}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ObjectFilterPanel;