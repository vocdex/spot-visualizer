// src/App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import ThreeJSScene from './components/MapViewer/ThreeJSScene';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import WaypointPanel from './components/WaypointManager/WaypointPanel';
import ObjectFilterPanel from './components/ObjectFilter/ObjectFilterPanel';
import { fetchMap, fetchWaypoint, fetchWaypointImages, fetchObjects, updateWaypointLabel } from './services/api';

function App() {
  // State for map data
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for UI controls
  const [useAnchoring, setUseAnchoring] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [view3D, setView3D] = useState(true);
  
  // State for waypoint selection and filtering
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [selectedWaypointData, setSelectedWaypointData] = useState(null);
  const [waypointImages, setWaypointImages] = useState(null);
  const [allObjects, setAllObjects] = useState([]);
  const [filteredObjects, setFilteredObjects] = useState([]);
  
  // Load initial map data
  useEffect(() => {
    setLoading(true);
    fetchMap(useAnchoring)
      .then(data => {
        setMapData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading map data:', err);
        setError('Failed to load map data');
        setLoading(false);
      });
  }, [useAnchoring]);
  
  // Load all available objects for filtering
  useEffect(() => {
    fetchObjects()
      .then(objects => {
        setAllObjects(objects);
      })
      .catch(err => {
        console.error('Error loading objects:', err);
      });
  }, []);
  
  // When a waypoint is selected, fetch its details
  useEffect(() => {
    if (!selectedWaypoint) {
      setSelectedWaypointData(null);
      setWaypointImages(null);
      return;
    }
    
    // Fetch waypoint data
    fetchWaypoint(selectedWaypoint, useAnchoring)
      .then(data => {
        setSelectedWaypointData(data);
      })
      .catch(err => {
        console.error('Error loading waypoint data:', err);
      });
    
    // Fetch waypoint images
    fetchWaypointImages(selectedWaypoint)
      .then(images => {
        setWaypointImages(images);
      })
      .catch(err => {
        console.error('Error loading waypoint images:', err);
      });
  }, [selectedWaypoint, useAnchoring]);
  
  // Handle waypoint selection
  const handleWaypointSelect = (waypointId) => {
    setSelectedWaypoint(waypointId);
  };
  
  // Handle label update
  const handleLabelUpdate = (waypointId, newLabel) => {
    updateWaypointLabel(waypointId, newLabel)
      .then(() => {
        // Update the local data
        if (selectedWaypointData) {
          setSelectedWaypointData(prev => ({
            ...prev,
            label: newLabel
          }));
        }
        
        // Refresh map data
        return fetchMap(useAnchoring);
      })
      .then(updatedMapData => {
        setMapData(updatedMapData);
      })
      .catch(err => {
        console.error('Error updating label:', err);
      });
  };
  
  // Handle object filtering
  const handleObjectFilter = (objects) => {
    setFilteredObjects(objects);
  };
  
  // Handle toggle of anchoring mode
  const handleAnchoringToggle = () => {
    setUseAnchoring(!useAnchoring);
  };
  
  // Handle toggle of label visibility
  const handleLabelToggle = () => {
    setShowLabels(!showLabels);
  };
  
  // Handle toggle of 3D/2D view
  const handleViewToggle = () => {
    setView3D(!view3D);
  };
  
  return (
    <div className="app">
      <Header 
        useAnchoring={useAnchoring} 
        onAnchoringToggle={handleAnchoringToggle}
        showLabels={showLabels}
        onLabelToggle={handleLabelToggle}
        view3D={view3D}
        onViewToggle={handleViewToggle}
      />
      
      <div className="main-content">
        <Sidebar>
          <ObjectFilterPanel 
            allObjects={allObjects}
            filteredObjects={filteredObjects}
            onObjectFilter={handleObjectFilter}
          />
          
          <WaypointPanel 
            waypointData={selectedWaypointData}
            waypointImages={waypointImages}
            onLabelUpdate={handleLabelUpdate}
          />
        </Sidebar>
        
        <div className="map-container">
          {loading ? (
            <div className="loading">Loading map data...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <ThreeJSScene 
              mapData={mapData}
              selectedWaypoint={selectedWaypoint}
              onWaypointSelect={handleWaypointSelect}
              filteredObjects={filteredObjects}
              useAnchoring={useAnchoring}
              showLabels={showLabels}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;