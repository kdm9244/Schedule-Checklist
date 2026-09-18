// Override for a deployed API or an isolated local test server.
export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000').replace(/\/$/, '')
