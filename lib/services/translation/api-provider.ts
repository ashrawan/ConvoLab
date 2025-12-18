/**
 * API Translation Provider
 * Calls backend translation API (backend chooses AI model)
 */

import { TranslationProvider } from './types';
import { API_BASE_URL } from '@/lib/config/api';


export class APITranslationProvider implements TranslationProvider {
    name = 'api';

    isAvailable(): boolean {
        return true; // API is always available (assuming backend is running)
    }

    async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
        if (!text) return text;

        try {
            const response = await fetch(`${API_BASE_URL}/api/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    text,
                    source_lang: sourceLang,
                    target_lang: targetLang
                })
            });

            if (!response.ok) {
                throw new Error(`Translation API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.translated || text;
        } catch (error) {
            console.error('API translation error:', error);
            throw error;
        }
    }

    async translateMultiple(
        text: string,
        sourceLang: string,
        targetLangs: string[]
    ): Promise<Record<string, string>> {
        if (!text || targetLangs.length === 0) return {};

        try {
            const response = await fetch(`${API_BASE_URL}/api/ai/translate/multiple`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    text,
                    source_lang: sourceLang,
                    target_langs: targetLangs
                })
            });

            if (!response.ok) {
                throw new Error(`Translation API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.translations || {};
        } catch (error) {
            console.error('API multi-translation error:', error);
            return {};
        }
    }
}
