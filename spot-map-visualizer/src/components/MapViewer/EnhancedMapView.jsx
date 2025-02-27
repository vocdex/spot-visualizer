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
  
  // Map rendering references
  const waypointsRef = useRef({});
  const mapBoundsRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  
  // Check if a waypoint should be filtered based on objects - with robust error handling
  const isWaypointFiltered = useCallback((waypoint, filteredObjects) => {
    try {
      // Return false if no filter is applied or if the waypoint has no objects
      if (!filteredObjects || !Array.isArray(filteredObjects) || filteredObjects.length === 0) {
        return false;
      }
      
      // Ensure waypoint and waypoint.objects exist and are valid
      if (!waypoint || !waypoint.objects || !Array.isArray(waypoint.objects)) {
        return false;
      }
      
      // Safe check if any objects match
      return waypoint.objects.some(obj => 
        obj && filteredObjects.includes(obj)
      );
    } catch (error) {
      console.error("Error in isWaypointFiltered:", error, waypoint, filteredObjects);
      return false; // Fail safely
    }
  }, []);
  
  // Check if an edge connects filtered waypoints - with robust error handling
  const isEdgeHighlighted = useCallback((edge, filteredObjects, waypoints) => {
    try {
      // Return false if no filter is applied or invalid inputs
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
      return false; // Fail safely
    }
  }, [isWaypointFiltered]);
  
  // Calculate map bounds for proper scaling
  const calculateMapBounds = useCallback((waypoints) => {
    if (!waypoints || waypoints.length === 0) return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    waypoints.forEach(waypoint => {
      minX = Math.min(minX, waypoint.position[0]);
      maxX = Math.max(maxX, waypoint.position[0]);
      minY = Math.min(minY, waypoint.position[1]);
      maxY = Math.max(maxY, waypoint.position[1]);
    });
    
    // Add some padding
    const padX = (maxX - minX) * 0.1;
    const padY = (maxY - minY) * 0.1;
    
    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY
    };
  }, []);
  
  // Handle wheel event for zooming
  const handleWheel = useCallback((e) => {
    // Calculate zoom factor
    const delta = -e.deltaY;
    const zoomFactor = delta > 0 ? 1.1 : 0.9;
    
    // Calculate new scale with limits
    const newScale = Math.max(0.1, Math.min(10, scale * zoomFactor));
    
    // Get mouse position relative to canvas
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Update scale
    setScale(newScale);
    
    // Calculate new world position under mouse (after theoretical zoom)
    // This is approximate and will be refined in the next render
    setOffset(prevOffset => {
      // Calculate offsetX and offsetY to keep the point under the mouse stable
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
    
    // Add wheel event listener with { passive: false } option
    const handleWheelWithPrevent = (e) => {
      e.preventDefault();
      handleWheel(e);
    };
    
    canvas.addEventListener('wheel', handleWheelWithPrevent, { passive: false });
    
    // Clean up
    return () => {
      canvas.removeEventListener('wheel', handleWheelWithPrevent);
    };
  }, [handleWheel]);
  
  // Convert screen coordinates to map coordinates
  const screenToMapCoordinates = useCallback((screenX, screenY) => {
    const canvas = canvasRef.current;
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
  
  // Handle mouse events
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Update dragging if active
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOffset({ x: offset.x + dx, y: offset.y + dy });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    
    // Waypoint hover detection
    const mapCoords = screenToMapCoordinates(mouseX, mouseY);
    let foundWaypoint = null;
    
    for (const [id, wp] of Object.entries(waypointsRef.current)) {
      const distance = Math.sqrt(
        Math.pow(wp.x - mapCoords.x, 2) + 
        Math.pow(wp.y - mapCoords.y, 2)
      );
      
      if (distance <= wp.radius) {
        foundWaypoint = id;
        setTooltipPosition({ x: wp.screenX, y: wp.screenY });
        break;
      }
    }
    
    setHoveredWaypoint(foundWaypoint);
    
    // Update cursor
    canvasRef.current.style.cursor = foundWaypoint ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
  };
  
  const handleMouseUp = (e) => {
    // If it was a short click (not a drag) and on a waypoint, select it
    if (isDragging && hoveredWaypoint) {
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStart.x, 2) + 
        Math.pow(e.clientY - dragStart.y, 2)
      );
      
      if (dragDistance < 5) {  // Consider it a click if moved less than 5px
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
  
  // Render the map
  useEffect(() => {
    try {
      // Validate required refs and data
      if (!mapData || !canvasRef.current || !containerRef.current) return;
      
      // Validate map data structure
      if (!mapData.waypoints || !Array.isArray(mapData.waypoints) || 
          !mapData.edges || !Array.isArray(mapData.edges)) {
        console.error("Invalid map data structure:", mapData);
        return;
      }
      
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
        // Draw edges
        ctx.save();
        ctx.translate(effectiveOffsetX, effectiveOffsetY);
        ctx.scale(effectiveScale, effectiveScale);
        ctx.translate(-(bounds.minX + bounds.maxX) / 2, -(bounds.minY + bounds.maxY) / 2);
        
        // Draw edges with safe checks
        edges.forEach(edge => {
          if (!edge || !edge.from_position || !edge.to_position) return;
          
          try {
            const isHighlighted = isEdgeHighlighted(edge, filteredObjects, waypoints);
            
            ctx.beginPath();
            ctx.moveTo(edge.from_position[0], edge.from_position[1]);
            ctx.lineTo(edge.to_position[0], edge.to_position[1]);
            ctx.strokeStyle = isHighlighted ? 'rgba(0, 150, 0, 0.8)' : 'rgba(150, 150, 150, 0.6)';
            ctx.lineWidth = isHighlighted ? 2 / effectiveScale : 1 / effectiveScale;
            ctx.stroke();
          } catch (edgeError) {
            console.error("Error drawing edge:", edgeError, edge);
          }
        });
        
        // Draw waypoints with safe checks
        waypoints.forEach(waypoint => {
          if (!waypoint || !waypoint.position) return;
          
          try {
            const isFiltered = isWaypointFiltered(waypoint, filteredObjects);
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
              data: waypoint
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
          } catch (waypointError) {
            console.error("Error drawing waypoint:", waypointError, waypoint);
          }
        });
        
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
              
              // Draw label if enabled
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
      }
    } catch (error) {
      console.error("Error in map effect:", error);
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
        // Note: The wheel event is now handled by the useEffect above
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
        </div>
      )}
    </div>
  );
};

export default EnhancedMapView;