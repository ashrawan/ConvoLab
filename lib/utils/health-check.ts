/**
 * Utility to check API health and detect ngrok interposer
 */

import { API_BASE_URL } from '../config/api';

export type HealthStatus = 'loading' | 'healthy' | 'degraded' | 'error' | 'ngrok-interposer';

export interface HealthCheckResult {
    status: HealthStatus;
    message?: string;
    services?: any;
    url?: string;
}

export async function checkApiHealth(): Promise<HealthCheckResult> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // We use the root endpoint or /health. /health is more detailed.
        const response = await fetch(`${API_BASE_URL}/health`, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            cache: 'no-store'
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return {
                status: 'error',
                message: `HTTP ${response.status}: ${response.statusText}`,
                url: API_BASE_URL
            };
        }

        // Try to parse as JSON
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('application/json')) {
            return {
                status: 'ngrok-interposer',
                message: 'Non-JSON response received (likely ngrok interposer)',
                url: API_BASE_URL
            };
        }

        try {
            const data = await response.json();

            if (data && (data.status === 'healthy' || data.status === 'ok')) {
                return {
                    status: 'healthy',
                    services: data.services,
                    url: API_BASE_URL
                };
            }

            if (data && data.status === 'degraded') {
                return {
                    status: 'degraded',
                    services: data.services,
                    url: API_BASE_URL
                };
            }

            return {
                status: 'ngrok-interposer',
                message: 'Unexpected JSON structure',
                url: API_BASE_URL
            };
        } catch (e) {
            return {
                status: 'ngrok-interposer',
                message: 'Failed to parse JSON (likely ngrok interposer)',
                url: API_BASE_URL
            };
        }
    } catch (error: any) {
        if (error.name === 'AbortError') {
            return {
                status: 'error',
                message: 'Health check timed out',
                url: API_BASE_URL
            };
        }

        return {
            status: 'error',
            message: error.message || 'Connection failed',
            url: API_BASE_URL
        };
    }
}
