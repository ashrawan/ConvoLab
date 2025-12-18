/**
 * API Client for Backend Communication
 */

import { API_BASE_URL } from '../config/api';

export const apiClient = {
    /**
     * GET request
     */
    get: async <T = any>(endpoint: string): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * POST request
     */
    post: async  <T = any>(endpoint: string, data: any): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * POST request with streaming response
     */
    postStream: async (endpoint: string, data: any): Promise<Response> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response;
    }
};
