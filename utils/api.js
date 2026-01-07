/**
 * API configuration and utilities
 */

import Constants from 'expo-constants';

/**
 * Backend API base URL
 * Configure this based on environment
 */
export const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 
  (__DEV__ ? 'http://localhost:8000' : null);

/**
 * API endpoints
 */
export const ENDPOINTS = {
  WHITEBOARD_INIT: '/whiteboard/init',
  WHITEBOARD_SAVE: '/whiteboard/save',
  WHITEBOARD_GET: '/whiteboard/get',
};

/**
 * Make an API request with error handling
 * 
 * @param {string} endpoint - The API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - The response data
 */
export const apiRequest = async (endpoint, options = {}) => {
  if (!API_BASE_URL) {
    throw new Error('API base URL not configured');
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
};

/**
 * Initialize a whiteboard from transcript
 * 
 * @param {string} lectureId - The lecture ID
 * @param {string} text - The transcript or summary text
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The whiteboard data
 */
export const initWhiteboard = async (lectureId, text, userId = 'default') => {
  return apiRequest(ENDPOINTS.WHITEBOARD_INIT, {
    method: 'POST',
    body: JSON.stringify({
      lecture_id: lectureId,
      text,
      user_id: userId,
    }),
  });
};

/**
 * Save whiteboard changes
 * 
 * @param {string} lectureId - The lecture ID
 * @param {Object} snapshot - The tldraw snapshot
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The save response
 */
export const saveWhiteboard = async (lectureId, snapshot, userId = 'default') => {
  return apiRequest(ENDPOINTS.WHITEBOARD_SAVE, {
    method: 'POST',
    body: JSON.stringify({
      lecture_id: lectureId,
      tldraw_snapshot: snapshot,
      user_id: userId,
    }),
  });
};

/**
 * Get whiteboard data
 * 
 * @param {string} lectureId - The lecture ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The whiteboard data
 */
export const getWhiteboard = async (lectureId, userId = 'default') => {
  return apiRequest(`${ENDPOINTS.WHITEBOARD_GET}/${lectureId}?user_id=${userId}`, {
    method: 'GET',
  });
};

/**
 * Check if the backend is available
 * 
 * @returns {Promise<boolean>} - True if backend is reachable
 */
export const checkBackendHealth = async () => {
  if (!API_BASE_URL) return false;
  
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      timeout: 5000,
    });
    return response.ok;
  } catch {
    return false;
  }
};

