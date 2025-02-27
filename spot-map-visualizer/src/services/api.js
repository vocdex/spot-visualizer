// src/services/api.js
const API_BASE_URL = 'http://127.0.0.1:5000/api';
/**
 * Fetch the map data from the server
 * @param {boolean} useAnchoring - Whether to use anchoring mode
 * @returns {Promise<Object>} - The map data
 */
export const fetchMap = async (useAnchoring = false) => {
  try {
    console.log(`Fetching map data with useAnchoring=${useAnchoring}`);
    const url = `${API_BASE_URL}/map?use_anchoring=${useAnchoring}`;
    console.log(`Request URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      let errorMessage = `HTTP error! Status: ${response.status}`;
      try {
        // Try to get more detailed error from response
        const errorBody = await response.text();
        console.error(`Error response body: ${errorBody}`);
        errorMessage += `, Details: ${errorBody}`;
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log(`Successfully retrieved map with ${data.waypoints?.length || 0} waypoints`);
    return data;
  } catch (error) {
    console.error('Error fetching map data:', error);
    throw error;
  }
};

/**
 * Fetch all waypoints
 * @returns {Promise<Array>} - Array of waypoint data
 */
export const fetchWaypoints = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/waypoints`);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorBody}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching waypoints:', error);
    throw error;
  }
};

/**
 * Fetch data for a specific waypoint
 * @param {string} waypointId - The ID of the waypoint
 * @param {boolean} useAnchoring - Whether to use anchoring mode
 * @returns {Promise<Object>} - The waypoint data
 */
export const fetchWaypoint = async (waypointId, useAnchoring = false) => {
  try {
    const response = await fetch(`${API_BASE_URL}/waypoint/${waypointId}?use_anchoring=${useAnchoring}`);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorBody}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching waypoint ${waypointId}:`, error);
    throw error;
  }
};

/**
 * Fetch images for a specific waypoint
 * @param {string} waypointId - The ID of the waypoint
 * @returns {Promise<Object>} - Object containing image data
 */
export const fetchWaypointImages = async (waypointId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/waypoint/${waypointId}/images`);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorBody}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching images for waypoint ${waypointId}:`, error);
    throw error;
  }
};

/**
 * Fetch all objects in the environment
 * @returns {Promise<Array>} - Array of object names
 */
export const fetchObjects = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/objects`);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorBody}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching objects:', error);
    throw error;
  }
};

/**
 * Update the label for a waypoint
 * @param {string} waypointId - The ID of the waypoint
 * @param {string} newLabel - The new label for the waypoint
 * @returns {Promise<Object>} - The response data
 */
export const updateWaypointLabel = async (waypointId, newLabel) => {
  try {
    const response = await fetch(`${API_BASE_URL}/waypoint/${waypointId}/label`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ label: newLabel }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorBody}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error updating label for waypoint ${waypointId}:`, error);
    throw error;
  }
};

/**
 * Helper function to format base64 image data
 * @param {string} base64String - Base64 encoded image string
 * @returns {string} - Formatted data URL for image
 */
export const formatImageUrl = (base64String) => {
  if (!base64String) return null;
  return `data:image/jpeg;base64,${base64String}`;
};