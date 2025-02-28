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
  
  // Define colors for better maintenance
  const colors = {
    filtered: {
      fill: '#FF6B00',     // Bright orange
      stroke: '#FF3D00',   // Darker orange
      glow: 'rgba(255, 107, 0, 0.2)',
      edge: 'rgba(255, 107, 0, 0.8)'
    },
    selected: {
      fill: 'red',
      stroke: 'darkred'
    },
    normal: {
      fill: 'rgba(30, 136, 229, 0.7)',
      fillHover: 'rgba(100, 149, 237, 0.9)',
      stroke: 'rgb(21, 101, 192)',
      strokeHover: 'rgb(70, 119, 207)'
    },
    edge: {
      normal: 'rgba(150, 150, 150, 0.6)'
    }
  };
  
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
      
      // Check if any of the filtered objects are in this waypoint's objects
      // Using a more explicit loop for clarity and better debugging
      for (const filteredObj of filteredObjects) {
        if (waypoint.objects.includes(filteredObj)) {
          return true;
        }
      }
      
      return false;
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
      if (!waypoint.position || !Array.isArray(waypoint.position) || waypoint.position.length < 2) return;
      
      minX = Math.min(minX, waypoint.position[0]);
      maxX = Math.max(maxX, waypoint.position[0]);
      minY = Math.min(minY, waypoint.position[1]);
      maxY = Math.max(maxY, waypoint.position[1]);
    });
    
    // Check if we have valid bounds (could happen if all waypoints had invalid positions)
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
  
  // Handle mouse events
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    
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
    let minDistance = Infinity;
    
    // Find the closest waypoint that's within its clickable radius
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
    
    // Update cursor
    if (canvasRef.current) {
      canvasRef.current.style.cursor = foundWaypoint ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
    }
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
        
        // First, draw non-highlighted edges
        edges.forEach(edge => {
          if (!edge || !edge.from_position || !edge.to_position) return;
          
          try {
            const isHighlighted = isEdgeHighlighted(edge, filteredObjects, waypoints);
            
            // Skip highlighted edges on first pass
            if (isHighlighted) return;
            
            ctx.beginPath();
            ctx.moveTo(edge.from_position[0], edge.from_position[1]);
            ctx.lineTo(edge.to_position[0], edge.to_position[1]);
            ctx.strokeStyle = colors.edge.normal;
            ctx.lineWidth = 1 / effectiveScale;
            ctx.stroke();
          } catch (edgeError) {
            console.error("Error drawing edge:", edgeError, edge);
          }
        });
        
        // Then draw highlighted edges on top
        edges.forEach(edge => {
          if (!edge || !edge.from_position || !edge.to_position) return;
          
          try {
            const isHighlighted = isEdgeHighlighted(edge, filteredObjects, waypoints);
            
            // Skip non-highlighted edges on second pass
            if (!isHighlighted) return;
            
            ctx.beginPath();
            ctx.moveTo(edge.from_position[0], edge.from_position[1]);
            ctx.lineTo(edge.to_position[0], edge.to_position[1]);
            ctx.strokeStyle = colors.filtered.edge;
            ctx.lineWidth = 2 / effectiveScale;
            ctx.stroke();
          } catch (edgeError) {
            console.error("Error drawing highlighted edge:", edgeError, edge);
          }
        });
        
        // Pre-calculate filtered waypoints for consistent rendering
        const filteredWaypointIds = new Set();
        if (filteredObjects && filteredObjects.length > 0) {
          waypoints.forEach(waypoint => {
            if (isWaypointFiltered(waypoint, filteredObjects)) {
              filteredWaypointIds.add(waypoint.id);
            }
          });
        }
        
        // First draw regular waypoints (non-filtered, non-selected)
        waypoints.forEach(waypoint => {
          if (!waypoint || !waypoint.position) return;
          
          try {
            const isFiltered = filteredWaypointIds.has(waypoint.id);
            const isSelected = waypoint.id === selectedWaypoint;
            
            // Skip filtered and selected waypoints on first pass
            if (isFiltered || isSelected) return;
            
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
            
            ctx.fillStyle = isHovered ? colors.normal.fillHover : colors.normal.fill;
            ctx.strokeStyle = isHovered ? colors.normal.strokeHover : colors.normal.stroke;
            ctx.lineWidth = 1 / effectiveScale;
            
            ctx.fill();
            ctx.stroke();
            
            // Draw label if enabled and not too zoomed out
            if (showLabels && scale > 0.5 && waypoint.label) {
              ctx.font = `${12 / effectiveScale}px Arial`;
              ctx.fillStyle = 'black';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(waypoint.label, x, y - 8 / effectiveScale);
            }
          } catch (waypointError) {
            console.error("Error drawing waypoint:", waypointError, waypoint);
          }
        });
        
        // Then draw filtered waypoints
        waypoints.forEach(waypoint => {
          if (!waypoint || !waypoint.position) return;
          
          try {
            const isFiltered = filteredWaypointIds.has(waypoint.id);
            const isSelected = waypoint.id === selectedWaypoint;
            
            // Skip non-filtered on second pass (draw selected in final pass)
            if (!isFiltered || isSelected) return;
            
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
            
            // Draw glow effect for filtered waypoints
            ctx.beginPath();
            ctx.arc(x, y, 10 / effectiveScale, 0, Math.PI * 2);
            ctx.fillStyle = colors.filtered.glow;
            ctx.fill();
            
            // Draw waypoint circle
            ctx.beginPath();
            ctx.arc(x, y, 5 / effectiveScale, 0, Math.PI * 2);
            
            ctx.fillStyle = colors.filtered.fill;
            ctx.strokeStyle = colors.filtered.stroke;
            ctx.lineWidth = 2 / effectiveScale;
            
            ctx.fill();
            ctx.stroke();
            
            // Draw pulsing ring animation for filtered waypoints
            if (isHovered) {
              const time = Date.now() % 2000 / 2000; // 0 to 1 over 2 seconds
              const pulseSize = (7 + 3 * Math.sin(time * Math.PI * 2)) / effectiveScale;
              
              ctx.beginPath();
              ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
              ctx.strokeStyle = colors.filtered.fill;
              ctx.lineWidth = 2 / effectiveScale;
              ctx.stroke();
            }
            
            // Draw label if enabled and not too zoomed out
            if (showLabels && scale > 0.5 && waypoint.label) {
              ctx.font = `${12 / effectiveScale}px Arial`;
              ctx.fillStyle = isHovered ? colors.filtered.stroke : colors.filtered.fill;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(waypoint.label, x, y - 8 / effectiveScale);
            }
          } catch (waypointError) {
            console.error("Error drawing filtered waypoint:", waypointError, waypoint);
          }
        });
        
        // Finally draw selected waypoint (top layer)
        waypoints.forEach(waypoint => {
          if (!waypoint || !waypoint.position) return;
          
          try {
            const isSelected = waypoint.id === selectedWaypoint;
            
            // Skip non-selected on final pass
            if (!isSelected) return;
            
            const isFiltered = filteredWaypointIds.has(waypoint.id);
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
            
            // Draw selection effect
            ctx.beginPath();
            ctx.arc(x, y, 12 / effectiveScale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
            ctx.fill();
            
            // Draw waypoint circle
            ctx.beginPath();
            ctx.arc(x, y, 5 / effectiveScale, 0, Math.PI * 2);
            
            ctx.fillStyle = colors.selected.fill;
            ctx.strokeStyle = colors.selected.stroke;
            ctx.lineWidth = 2 / effectiveScale;
            
            ctx.fill();
            ctx.stroke();
            
            // Draw label if enabled and not too zoomed out
            if (showLabels && scale > 0.5 && waypoint.label) {
              ctx.font = `${12 / effectiveScale}px Arial`;
              ctx.fillStyle = colors.selected.fill;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(waypoint.label, x, y - 8 / effectiveScale);
            }
          } catch (waypointError) {
            console.error("Error drawing selected waypoint:", waypointError, waypoint);
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
    calculateMapBounds,
    colors
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
          <div className="legend-color" style={{ backgroundColor: colors.normal.fill }}></div>
          <span>Waypoint</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: colors.selected.fill }}></div>
          <span>Selected</span>
        </div>
        {filteredObjects.length > 0 && (
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: colors.filtered.fill }}></div>
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
          {waypointsRef.current[hoveredWaypoint].isFiltered && (
            <div className="filtered-tag">Filtered</div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedMapView;