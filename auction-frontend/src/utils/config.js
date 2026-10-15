/**
 * Application Configuration
 * Centralized API & Socket URLs with environment variable support
 */

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
export const SERVER_BASE_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

/**
 * Resolves full URL for an image/picture path
 * @param {string} path 
 * @returns {string|null}
 */
export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SERVER_BASE_URL}${cleanPath}`;
};
