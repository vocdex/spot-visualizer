// src/components/MapViewer/EnhancedMapView.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './EnhancedMapView.css';

const EnhancedMapView = ({
  mapData,
  selectedWaypoint,
  onWaypointSelect,
  filteredObjects = [],
  useAnchoring = false,
  showLabels = true
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // State for interaction
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredWaypoint, setHoveredWaypoint] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [renderError, setRenderError] = useState(null);
  
  // Debug state
  const [debugInfo, setDebugInfo] = useState({});
  
  // Map rendering references
  const waypointsRef = useRef({});
  const mapBoundsRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  
  // Check if a waypoint should be filtered based on objects - with debug info
  const isWaypointFiltered = useCallback((waypoint, filteredObjects) => {
    try {
      // Debug info
      const debugData = {
        waypointId: waypoint?.id || 'unknown',
        hasObjects: Boolean(waypoint?.objects),
        objectsCount: waypoint?.objects?.length || 0,
        filteredCount: filteredObjects?.length || 0,
        waypointObjects: waypoint?.objects || []
      };
      
      // Return false if no filter is applied or if the waypoint has no objects
      if (!filteredObjects || !Array.isArray(filteredObjects) || filteredObjects.length === 0) {
        return false;
      }
      
      // Ensure waypoint and waypoint.objects exist and are valid
      if (!waypoint || !waypoint.objects || !Array.isArray(waypoint.objects)) {
        return false;
      }
      
      // If any filtered object matches any waypoint object
      let matches = [];
      for (const filteredObj of filteredObjects) {
        for (const waypointObj of waypoint.objects) {
          if (filteredObj === waypointObj) {
            matches.push(filteredObj);
          }
        }
      }
      
      debugData.matches = matches;
      
      // Log detailed debug info for potential problem cases
      if (matches.length > 0) {
        console.log(`Waypoint ${waypoint.id} matched objects:`, matches);
      }
      
      return matches.length > 0;
    } catch (error) {
      console.error("Error in isWaypointFiltered:", error, waypoint, filteredObjects);
      setRenderError(`Error in filter: ${error.message}`);
      return false; // Fail safely
    }
  }, []);
  
  // Check if an edge connects filtered waypoints
  const isEdgeHighlighted = useCallback((edge, filteredObjects, waypoints) => {
    try {
      if (!filteredObjects || !Array.isArray(filteredObjects) || filteredObjects.length === 0) {
        return false;
      }
      
      if (!edge || !waypoints || !Array.isArray(waypoints)) {
        return false;
      }
      
      // Find connected waypoints safely
      const fromWaypoint = edge.from_id ? waypoints.find(wp => wp && wp.id === edge.from_id) : null;
      const toWaypoint = edge.to_id ? waypoints.find(wp => wp && wp.id === edge.to_id) : null;
      
      // Check if either waypoint matches the filter
      return (fromWaypoint && isWaypointFiltered(fromWaypoint, filteredObjects)) || 
             (toWaypoint && isWaypointFiltered(toWaypoint, filteredObjects));
    } catch (error) {
      console.error("Error in isEdgeHighlighted:", error, edge, filteredObjects);
      setRenderError(`Error in edge highlight: ${error.message}`);
      return false;
    }
  }, [isWaypointFiltered]);
  
  // Calculate map bounds for proper scaling
  const calculateMapBounds = useCallback((waypoints) => {
    if (!waypoints || waypoints.length === 0) return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    waypoints.forEach(waypoint => {
      if (!waypoint.position || !Array.isArray(waypoint.position) || waypoint.position.length < 2) return;
      
      minX = Math.min(minX, waypoint.position[0]);
      maxX = Math.max(maxX, waypoint.position[0]);
      minY = Math.min(minY, waypoint.position[1]);
      maxY = Math.max(maxY, waypoint.position[1]);
    });
    
    // Check if we have valid bounds
    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    }
    
    // Add some padding
    const padX = Math.max(1, (maxX - minX) * 0.1);
    const padY = Math.max(1, (maxY - minY) * 0.1);
    
    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY
    };
  }, []);
  
  // Handle wheel event for zooming
  const handleWheel = useCallback((e) => {
    const delta = -e.deltaY;
    const zoomFactor = delta > 0 ? 1.1 : 0.9;
    
    const newScale = Math.max(0.1, Math.min(10, scale * zoomFactor));
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setScale(newScale);
    
    setOffset(prevOffset => {
      const dx = (mouseX - (prevOffset.x + canvasRef.current.width / 2)) * (1 - 1/zoomFactor);
      const dy = (mouseY - (prevOffset.y + canvasRef.current.height / 2)) * (1 - 1/zoomFactor);
      
      return {
        x: prevOffset.x + dx,
        y: prevOffset.y + dy
      };
    });
  }, [scale]);
  
  // Set up wheel event with options
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleWheelWithPrevent = (e) => {
      e.preventDefault();
      handleWheel(e);
    };
    
    canvas.addEventListener('wheel', handleWheelWithPrevent, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheelWithPrevent);
    };
  }, [handleWheel]);
  
  // Convert screen coordinates to map coordinates
  const screenToMapCoordinates = useCallback((screenX, screenY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const bounds = mapBoundsRef.current;
    const effectiveScale = scale * Math.min(
      (canvas.width - 100) / (bounds.maxX - bounds.minX),
      (canvas.height - 100) / (bounds.maxY - bounds.minY)
    );
    
    const effectiveOffsetX = offset.x + canvas.width / 2;
    const effectiveOffsetY = offset.y + canvas.height / 2;
    
    const mapX = (screenX - effectiveOffsetX) / effectiveScale + (bounds.minX + bounds.maxX) / 2;
    const mapY = (screenY - effectiveOffsetY) / effectiveScale + (bounds.minY + bounds.maxY) / 2;
    
    return { x: mapX, y: mapY };
  }, [scale, offset]);
  
  // Mouse event handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOffset({ x: offset.x + dx, y: offset.y + dy });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    
    const mapCoords = screenToMapCoordinates(mouseX, mouseY);
    let foundWaypoint = null;
    let minDistance = Infinity;
    
    for (const [id, wp] of Object.entries(waypointsRef.current)) {
      if (!wp || typeof wp.x !== 'number' || typeof wp.y !== 'number') continue;
      
      const distance = Math.sqrt(
        Math.pow(wp.x - mapCoords.x, 2) + 
        Math.pow(wp.y - mapCoords.y, 2)
      );
      
      if (distance <= wp.radius && distance < minDistance) {
        foundWaypoint = id;
        minDistance = distance;
        setTooltipPosition({ x: wp.screenX, y: wp.screenY });
      }
    }
    
    setHoveredWaypoint(foundWaypoint);
    
    if (canvasRef.current) {
      canvasRef.current.style.cursor = foundWaypoint ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
    }
  };
  
  const handleMouseUp = (e) => {
    if (isDragging && hoveredWaypoint) {
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStart.x, 2) + 
        Math.pow(e.clientY - dragStart.y, 2)
      );
      
      if (dragDistance < 5) {
        onWaypointSelect(hoveredWaypoint);
      }
    }
    
    setIsDragging(false);
  };
  
  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredWaypoint(null);
  };
  
  // Reset view to fit all waypoints
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  
  // Update debug info when filtered objects change
  useEffect(() => {
    if (!mapData || !mapData.waypoints) return;
    
    // Count waypoints that match each filter object
    if (filteredObjects && filteredObjects.length > 0) {
      const objectCounts = {};
      let multiMatchCount = 0;
      
      // For each filter object, count how many waypoints match it
      filteredObjects.forEach(obj => {
        objectCounts[obj] = 0;
        
        mapData.waypoints.forEach(waypoint => {
          if (waypoint.objects && waypoint.objects.includes(obj)) {
            objectCounts[obj]++;
          }
        });
      });
      
      // Count waypoints that match multiple filter objects
      mapData.waypoints.forEach(waypoint => {
        if (!waypoint.objects) return;
        
        let matchCount = 0;
        filteredObjects.forEach(obj => {
          if (waypoint.objects.includes(obj)) {
            matchCount++;
          }
        });
        
        if (matchCount > 1) {
          multiMatchCount++;
        }
      });
      
      console.log("Filter debug info:", {
        filteredObjects,
        objectCounts,
        multiMatchCount
      });
      
      setDebugInfo({
        objectCounts,
        multiMatchCount,
        filteredObjects: [...filteredObjects]
      });
    }
  }, [filteredObjects, mapData]);
  
  // Render the map
  useEffect(() => {
    try {
      setRenderError(null);
      
      // Validate required refs and data
      if (!mapData || !canvasRef.current || !containerRef.current) return;
      
      // Validate map data structure
      if (!mapData.waypoints || !Array.isArray(mapData.waypoints) || 
          !mapData.edges || !Array.isArray(mapData.edges)) {
        console.error("Invalid map data structure:", mapData);
        setRenderError("Invalid map data structure");
        return;
      }
      
      console.log(`Rendering map with ${filteredObjects.length} filtered objects:`, filteredObjects);
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const container = containerRef.current;
      
      // Set canvas size to match container
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      // Clear previous drawings
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Extract waypoints and edges
      const { waypoints, edges } = mapData;
      
      // Calculate map bounds
      const bounds = calculateMapBounds(waypoints);
      mapBoundsRef.current = bounds;
      
      // Calculate scaling to fit the map
      const scaleX = (canvas.width - 100) / (bounds.maxX - bounds.minX);
      const scaleY = (canvas.height - 100) / (bounds.maxY - bounds.minY);
      const baseScale = Math.min(scaleX, scaleY);
      
      // Apply user's scale and offset
      const effectiveScale = baseScale * scale;
      const effectiveOffsetX = offset.x + canvas.width / 2;
      const effectiveOffsetY = offset.y + canvas.height / 2;
      
      // Store waypoint positions for interaction
      waypointsRef.current = {};
      
      try {
        // Create a safe copy of the filtered objects array to prevent issues
        const safeFilteredObjects = filteredObjects ? [...filteredObjects] : [];
        
        // Pre-compute filtered waypoints for consistent rendering
        console.log(`Pre-computing filtered waypoints for ${safeFilteredObjects.length} objects`);
        const filteredWaypointIds = new Set();
        const filteredWaypointObjects = new Map();
        
        if (safeFilteredObjects.length > 0) {
          waypoints.forEach(waypoint => {
            try {
              if (isWaypointFiltered(waypoint, safeFilteredObjects)) {
                filteredWaypointIds.add(waypoint.id);
                // Record which objects matched this waypoint
                const matchingObjects = waypoint.objects ? 
                  waypoint.objects.filter(obj => safeFilteredObjects.includes(obj)) : 
                  [];
                filteredWaypointObjects.set(waypoint.id, matchingObjects);
              }
            } catch (wpError) {
              console.error(`Error checking waypoint ${waypoint?.id}:`, wpError);
            }
          });
        }
        
        console.log(`Found ${filteredWaypointIds.size} filtered waypoints`);
        // Log waypoints with multiple matching objects (potential trouble spots)
        filteredWaypointObjects.forEach((objects, waypointId) => {
          if (objects.length > 1) {
            console.log(`Waypoint ${waypointId} matches multiple objects:`, objects);
          }
        });
        
        // Draw edges 
        ctx.save();
        ctx.translate(effectiveOffsetX, effectiveOffsetY);
        ctx.scale(effectiveScale, effectiveScale);
        ctx.translate(-(bounds.minX + bounds.maxX) / 2, -(bounds.minY + bounds.maxY) / 2);
        
        // Start with non-highlighted edges to put them in the background
        edges.forEach(edge => {
          if (!edge || !edge.from_position || !edge.to_position) return;
          
          try {
            const isHighlighted = isEdgeHighlighted(edge, safeFilteredObjects, waypoints);
            
            // Skip highlighted edges on first pass
            if (isHighlighted) return;
            
            ctx.beginPath();
            ctx.moveTo(edge.from_position[0], edge.from_position[1]);
            ctx.lineTo(edge.to_position[0], edge.to_position[1]);
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
            ctx.lineWidth = 1 / effectiveScale;
            ctx.stroke();
          } catch (edgeError) {
            console.error("Error drawing edge:", edgeError, edge);
          }
        });
        
        // Now draw highlighted edges on top
        if (safeFilteredObjects.length > 0) {
          edges.forEach(edge => {
            if (!edge || !edge.from_position || !edge.to_position) return;
            
            try {
              const isHighlighted = isEdgeHighlighted(edge, safeFilteredObjects, waypoints);
              
              // Only draw highlighted edges in this pass
              if (!isHighlighted) return;
              
              ctx.beginPath();
              ctx.moveTo(edge.from_position[0], edge.from_position[1]);
              ctx.lineTo(edge.to_position[0], edge.to_position[1]);
              ctx.strokeStyle = 'rgba(0, 150, 0, 0.8)';
              ctx.lineWidth = 2 / effectiveScale;
              ctx.stroke();
            } catch (edgeError) {
              console.error("Error drawing highlighted edge:", edgeError, edge);
            }
          });
        }
        
        // Draw waypoints
        let drawnWaypoints = 0;
        waypoints.forEach(waypoint => {
          if (!waypoint || !waypoint.position) return;
          
          try {
            const isFiltered = filteredWaypointIds.has(waypoint.id);
            const isSelected = waypoint.id === selectedWaypoint;
            const isHovered = waypoint.id === hoveredWaypoint;
            
            // Calculate position
            const x = waypoint.position[0];
            const y = waypoint.position[1];
            
            // Calculate screen position for tooltips
            const screenX = (x - (bounds.minX + bounds.maxX) / 2) * effectiveScale + effectiveOffsetX;
            const screenY = (y - (bounds.minY + bounds.maxY) / 2) * effectiveScale + effectiveOffsetY;
            
            // Store position for interaction
            waypointsRef.current[waypoint.id] = {
              x, y, 
              screenX, screenY,
              label: waypoint.label,
              radius: 5 / effectiveScale,
              data: waypoint,
              isFiltered
            };
            
            // Draw waypoint circle
            ctx.beginPath();
            ctx.arc(x, y, 5 / effectiveScale, 0, Math.PI * 2);
            
            if (isSelected) {
              ctx.fillStyle = 'red';
              ctx.strokeStyle = 'darkred';
              ctx.lineWidth = 2 / effectiveScale;
            } else if (isFiltered) {
              ctx.fillStyle = 'green';
              ctx.strokeStyle = 'darkgreen';
              ctx.lineWidth = 1.5 / effectiveScale;
            } else {
              ctx.fillStyle = isHovered ? 'rgba(100, 149, 237, 0.9)' : 'rgba(30, 136, 229, 0.7)';
              ctx.strokeStyle = isHovered ? 'rgb(70, 119, 207)' : 'rgb(21, 101, 192)';
              ctx.lineWidth = 1 / effectiveScale;
            }
            
            ctx.fill();
            ctx.stroke();
            
            // Draw label if enabled and not too zoomed out
            if (showLabels && scale > 0.5 && waypoint.label) {
              ctx.font = `${12 / effectiveScale}px Arial`;
              ctx.fillStyle = isSelected ? 'red' : (isFiltered ? 'darkgreen' : 'black');
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(waypoint.label, x, y - 8 / effectiveScale);
            }
            
            drawnWaypoints++;
          } catch (waypointError) {
            console.error("Error drawing waypoint:", waypointError, waypoint);
          }
        });
        
        console.log(`Successfully drawn ${drawnWaypoints} waypoints`);
        
        // Draw world objects (anchors) if available
        if (mapData.objects && Array.isArray(mapData.objects) && mapData.objects.length > 0) {
          mapData.objects.forEach(obj => {
            if (!obj || !obj.position) return;
            
            try {
              ctx.beginPath();
              ctx.rect(
                obj.position[0] - 4 / effectiveScale, 
                obj.position[1] - 4 / effectiveScale, 
                8 / effectiveScale, 
                8 / effectiveScale
              );
              ctx.fillStyle = 'rgba(0, 200, 0, 0.7)';
              ctx.strokeStyle = 'darkgreen';
              ctx.lineWidth = 1 / effectiveScale;
              ctx.fill();
              ctx.stroke();
              
              if (showLabels && scale > 0.5 && obj.id) {
                ctx.font = `${10 / effectiveScale}px Arial`;
                ctx.fillStyle = 'darkgreen';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(obj.id, obj.position[0], obj.position[1] - 6 / effectiveScale);
              }
            } catch (objError) {
              console.error("Error drawing object:", objError, obj);
            }
          });
        }
        
        ctx.restore();
      } catch (renderError) {
        console.error("Error rendering map:", renderError);
        setRenderError(`Render error: ${renderError.message}`);
      }
    } catch (error) {
      console.error("Error in map effect:", error);
      setRenderError(`Map error: ${error.message}`);
    }
  }, [
    mapData, 
    selectedWaypoint, 
    hoveredWaypoint, 
    scale, 
    offset, 
    filteredObjects, 
    useAnchoring, 
    showLabels, 
    isEdgeHighlighted, 
    isWaypointFiltered, 
    calculateMapBounds
  ]);
  
  return (
    <div className="enhanced-map-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="map-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      
      <div className="map-controls">
        <button className="zoom-button" onClick={() => setScale(scale * 1.2)}>+</button>
        <button className="zoom-button" onClick={() => setScale(Math.max(0.1, scale / 1.2))}>−</button>
        <button className="reset-button" onClick={resetView}>Reset View</button>
      </div>
      
      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: 'rgba(30, 136, 229, 0.7)' }}></div>
          <span>Waypoint</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: 'red' }}></div>
          <span>Selected</span>
        </div>
        {filteredObjects.length > 0 && (
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: 'green' }}></div>
            <span>Filtered</span>
          </div>
        )}
      </div>
      
      {/* Debug info panel */}
      {filteredObjects.length > 0 && (
        <div className="debug-panel" style={{
          position: 'absolute',
          top: '15px',
          left: '15px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '12px',
          maxWidth: '300px',
          zIndex: 1000
        }}>
          <h4 style={{ margin: '0 0 5px 0' }}>Filter Debug Info</h4>
          <div>Objects: {filteredObjects.join(', ')}</div>
          {debugInfo.objectCounts && Object.entries(debugInfo.objectCounts).map(([obj, count]) => (
            <div key={obj}>{obj}: {count} waypoints</div>
          ))}
          {debugInfo.multiMatchCount > 0 && (
            <div style={{ fontWeight: 'bold', color: debugInfo.multiMatchCount > 0 ? 'red' : 'inherit' }}>
              Waypoints with multiple matches: {debugInfo.multiMatchCount}
            </div>
          )}
        </div>
      )}
      
      {/* Render error message */}
      {renderError && (
        <div style={{
          position: 'absolute',
          bottom: '15px',
          left: '15px',
          background: 'rgba(255, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '14px',
          maxWidth: '80%',
          zIndex: 1000
        }}>
          Render Error: {renderError}
        </div>
      )}
      
      {hoveredWaypoint && waypointsRef.current[hoveredWaypoint] && (
        <div 
          className="waypoint-tooltip"
          style={{
            left: tooltipPosition.x + 15,
            top: tooltipPosition.y - 15
          }}
        >
          <div><strong>ID:</strong> {hoveredWaypoint}</div>
          {waypointsRef.current[hoveredWaypoint].label && (
            <div><strong>Label:</strong> {waypointsRef.current[hoveredWaypoint].label}</div>
          )}
          {waypointsRef.current[hoveredWaypoint].isFiltered && (
            <div><strong>Filtered:</strong> Yes</div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedMapView;