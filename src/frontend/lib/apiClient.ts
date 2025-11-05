import axios from 'axios';

// Use Vite's magic variable 'import.meta.env.DEV'
// This is 'true' in development (Vite server) and 'false' in production (Electron build)
const API_BASE_URL = (import.meta as any).env?.DEV
    ? '/api' // In DEV, use the Vite proxy (defined in vite.config.ts)
    : 'http://localhost:3001/api'; // In PROD, talk directly to the backend server

/**
 * A pre-configured axios instance for the entire application.
 */
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
});

// We export the constant as well, in case other parts of the
// app need the base URL (e.g., for WebSocket connections)
export { API_BASE_URL };
