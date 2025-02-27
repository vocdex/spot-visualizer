// src/App.js
import React, { useState, useEffect, Component } from 'react';
import './App.css';
import EnhancedMapView from './components/MapViewer/EnhancedMapView';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import WaypointPanel from './components/WaypointManager/WaypointPanel';
import ObjectFilterPanel from './components/ObjectFilter/ObjectFilterPanel';
import { fetchMap, fetchWaypoint, fetchWaypointImages, fetchObjects, updateWaypointLabel } from './services/api';

// Simple Debug View Component
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

// Error Boundary Component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#ffebee', border: '1px solid #f44336', borderRadius: '4px' }}>
          <h2>Something went wrong</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Show error details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button onClick={() => window.location.reload()} style={{ marginTop: '10px', padding: '8px 16px' }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Debug Panel Component
const DebugPanel = () => {
  const [apiStatus, setApiStatus] = useState('Checking...');
  const [mapData, setMapData] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  
  useEffect(() => {
    // Test direct fetch without using the service
    const testApi = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/map');
        if (!response.ok) {
          setApiStatus(`API Error: ${response.status}`);
          return;
        }
        
        const data = await response.json();
        setApiStatus(`API OK: Found ${data.waypoints?.length || 0} waypoints`);
        setMapData(data);
      } catch (error) {
        setApiStatus(`Fetch Error: ${error.message}`);
      }
    };
    
    testApi();
  }, []);
  
  return (
    <div style={{ 
      padding: '5px 10px', 
      background: mapData ? '#e8f5e9' : '#ffebee', 
      margin: '0 0 5px 0', 
      borderBottom: '1px solid #ddd',
      fontSize: '12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <strong>API:</strong> {apiStatus}
      </div>
      {mapData && (
        <div style={{ display: 'flex', gap: '15px' }}>
          <span><strong>Waypoints:</strong> {mapData.waypoints.length}</span>
          <span><strong>Edges:</strong> {mapData.edges.length}</span>
        </div>
      )}
    </div>
  );
};

function App() {
  // State for map data
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataValid, setDataValid] = useState(true);
  const [useDebugView, setUseDebugView] = useState(false);
  
  // State for UI controls
  const [useAnchoring, setUseAnchoring] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [view3D, setView3D] = useState(false); // Changed default to false since we're using 2D
  
  // State for waypoint selection and filtering
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [selectedWaypointData, setSelectedWaypointData] = useState(null);
  const [waypointImages, setWaypointImages] = useState(null);
  const [allObjects, setAllObjects] = useState([]);
  const [filteredObjects, setFilteredObjects] = useState([]);
  
  // Load initial map data
  useEffect(() => {
    console.log("Fetching map data...");
    setLoading(true);
    fetchMap(useAnchoring)
      .then(data => {
        console.log("Map data received:", data);
        console.log("Waypoints:", data.waypoints ? data.waypoints.length : 'none');
        console.log("Edges:", data.edges ? data.edges.length : 'none');
        setMapData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading map data:', err);
        setError(`Failed to load map data: ${err.message}`);
        setLoading(false);
      });
  }, [useAnchoring]);
  
  // Validate map data
  useEffect(() => {
    // Validate map data structure
    if (mapData) {
      console.log("Validating map data:", mapData);
      
      if (!mapData.waypoints || !Array.isArray(mapData.waypoints)) {
        console.error("Invalid waypoints data:", mapData.waypoints);
        setDataValid(false);
        setError("Invalid waypoints data structure");
        return;
      }
      
      if (!mapData.edges || !Array.isArray(mapData.edges)) {
        console.error("Invalid edges data:", mapData.edges);
        setDataValid(false);
        setError("Invalid edges data structure");
        return;
      }
      
      setDataValid(true);
    }
  }, [mapData]);
  
  // Load all available objects for filtering
  useEffect(() => {
    fetchObjects()
      .then(objects => {
        console.log("Objects received:", objects);
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
        console.log("Selected waypoint data:", data);
        setSelectedWaypointData(data);
      })
      .catch(err => {
        console.error('Error loading waypoint data:', err);
      });
    
    // Fetch waypoint images
    fetchWaypointImages(selectedWaypoint)
      .then(images => {
        console.log("Waypoint images received:", images);
        setWaypointImages(images);
      })
      .catch(err => {
        console.error('Error loading waypoint images:', err);
      });
  }, [selectedWaypoint, useAnchoring]);
  
  // Handle waypoint selection
  const handleWaypointSelect = (waypointId) => {
    console.log("Waypoint selected:", waypointId);
    setSelectedWaypoint(waypointId);
  };
  
  // Handle label update
  const handleLabelUpdate = (waypointId, newLabel) => {
    console.log(`Updating label for waypoint ${waypointId} to "${newLabel}"`);
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
    console.log("Filtering objects:", objects);
    setFilteredObjects(objects);
  };
  
  // Handle toggle of anchoring mode
  const handleAnchoringToggle = () => {
    console.log("Toggling anchoring mode");
    setUseAnchoring(!useAnchoring);
  };
  
  // Handle toggle of label visibility
  const handleLabelToggle = () => {
    console.log("Toggling label visibility");
    setShowLabels(!showLabels);
  };
  
  // Handle toggle of 3D/2D view
  const handleViewToggle = () => {
    console.log("Toggling view mode");
    setView3D(!view3D);
  };

  // Toggle debug view
  const toggleDebugView = () => {
    setUseDebugView(!useDebugView);
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
      
      <DebugPanel />
      
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
          <ErrorBoundary>
            {loading ? (
              <div className="loading">Loading map data...</div>
            ) : error ? (
              <div className="error">
                <p>{error}</p>
                <button 
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    fetchMap(useAnchoring)
                      .then(data => {
                        console.log("Retry successful:", data);
                        setMapData(data);
                        setLoading(false);
                      })
                      .catch(err => {
                        console.error('Error on retry:', err);
                        setError(`Failed to load map data: ${err.message}`);
                        setLoading(false);
                      });
                  }}
                  style={{ marginTop: '10px', padding: '8px 16px' }}
                >
                  Retry
                </button>
              </div>
            ) : !dataValid ? (
              <div className="error">
                <p>Map data structure is invalid</p>
                <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '300px' }}>
                  {JSON.stringify(mapData, null, 2)}
                </pre>
                <button 
                  onClick={() => window.location.reload()} 
                  style={{ marginTop: '10px', padding: '8px 16px' }}
                >
                  Reload Page
                </button>
              </div>
            ) : useDebugView ? (
              <SimpleMapView mapData={mapData} />
            ) : (
              <EnhancedMapView 
                mapData={mapData}
                selectedWaypoint={selectedWaypoint}
                onWaypointSelect={handleWaypointSelect}
                filteredObjects={filteredObjects}
                useAnchoring={useAnchoring}
                showLabels={showLabels}
              />
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default App;