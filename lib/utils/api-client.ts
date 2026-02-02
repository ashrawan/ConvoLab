/**
 * API Client for Backend Communication
 */

import { API_BASE_URL } from '../config/api';

export const apiClient = {
    /**
     * GET request
     */
    get: async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'ngrok-skip-browser-warning': 'true',
                ...options.headers,
            },
            ...options
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * POST request
     */
    post: async  <T = any>(endpoint: string, data: any, options: RequestInit = {}): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                ...options.headers,
            },
            body: JSON.stringify(data),
            ...options
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * POST request with streaming response
     */
    postStream: async (endpoint: string, data: any, options: RequestInit = {}): Promise<Response> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                ...options.headers,
            },
            body: JSON.stringify(data),
            ...options
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response;
    }
};
