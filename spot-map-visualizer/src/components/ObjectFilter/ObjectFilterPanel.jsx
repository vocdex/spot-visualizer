// src/components/ObjectFilter/ObjectFilterPanel.jsx
import React, { useEffect, useState, useRef } from 'react';
import './ObjectFilterPanel.css';

const ObjectFilterPanel = ({ allObjects, filteredObjects, onObjectFilter }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [processingClick, setProcessingClick] = useState(false);
  const dropdownRef = useRef(null);
  
  // Filter objects based on search term
  const filteredSearchResults = allObjects.filter(object => 
    object.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Validate inputs on mount and update
  useEffect(() => {
    if (!Array.isArray(allObjects)) {
      console.warn("ObjectFilterPanel: allObjects is not an array", allObjects);
    }
    
    if (!Array.isArray(filteredObjects)) {
      console.warn("ObjectFilterPanel: filteredObjects is not an array", filteredObjects);
      onObjectFilter([]);
    }
  }, [allObjects, filteredObjects, onObjectFilter]);
  
  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Toggle object selection
  const handleObjectToggle = (event, object) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (processingClick) return;
    
    try {
      setProcessingClick(true);
      
      const updatedObjects = Array.isArray(filteredObjects) ? [...filteredObjects] : [];
      
      if (updatedObjects.includes(object)) {
        const index = updatedObjects.indexOf(object);
        updatedObjects.splice(index, 1);
      } else {
        updatedObjects.push(object);
      }
      
      setTimeout(() => {
        onObjectFilter(updatedObjects);
        setTimeout(() => setProcessingClick(false), 100);
      }, 10);
      
    } catch (error) {
      console.error("Error toggling object filter:", error);
      onObjectFilter([]);
      setProcessingClick(false);
    }
  };
  
  // Clear all filters
  const handleClearFilters = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (processingClick) return;
    
    setProcessingClick(true);
    setSearchTerm('');
    
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
        <p className="no-objects">No objects found in the environment.</p>
      </div>
    );
  }
  
  return (
    <div className="object-filter-panel">
      <div className="panel-header">
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
          null
        ) : (
          <p>
            <strong>{safeFilteredObjects.length}</strong> object{safeFilteredObjects.length !== 1 ? 's' : ''} selected. 
            Waypoints containing these objects are highlighted on the map.
          </p>
        )}
      </div>
      
      {/* Selected objects display */}
      {safeFilteredObjects.length > 0 && (
        <div className="selected-objects">
          {safeFilteredObjects.map(object => (
            <div key={object} className="selected-object-tag">
              <span>{object}</span>
              <button 
                className="remove-object" 
                onClick={(e) => handleObjectToggle(e, object)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Searchable dropdown */}
      <div className="searchable-dropdown" ref={dropdownRef}>
        <div 
          className="dropdown-header"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <input
            type="text"
            placeholder="Search for objects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => {
              e.stopPropagation();
              setIsDropdownOpen(true);
            }}
          />
          <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
        </div>
        
        {isDropdownOpen && (
          <div className="dropdown-content">
            {filteredSearchResults.length === 0 ? (
              <div className="no-results">No matching objects found</div>
            ) : (
              filteredSearchResults.map(object => (
                <div 
                  key={object} 
                  className={`dropdown-item ${safeFilteredObjects.includes(object) ? 'selected' : ''}`}
                  onClick={(e) => handleObjectToggle(e, object)}
                >
                  <span className="checkbox-custom">
                    {safeFilteredObjects.includes(object) && '✓'}
                  </span>
                  <span className="object-name">{object}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ObjectFilterPanel;