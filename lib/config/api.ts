/**
 * API Configuration
 */

export const API_BASE_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

export const getApiUrl = (endpoint: string) => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_BASE_URL}${cleanEndpoint}`;
};
