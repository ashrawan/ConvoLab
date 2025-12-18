/**
 * API functions for phrase predictions with language support
 */

import { API_BASE_URL } from '@/lib/config/api';

export interface PhrasePrediction {
    phrase: string;
    probability: number;
}

export interface PhrasePredictionResponse {
    text: string;
    predictions: PhrasePrediction[];
    count: number;
    source_lang: string;
    return_lang: string;
}

/**
 * Get phrase predictions in the specified return language
 */
export async function getPhrasePredictions(
    text: string,
    sourceLang: string,
    returnLang: string,
    numPredictions: number = 8
): Promise<PhrasePrediction[]> {
    if (!text || text.trim().length === 0) return [];

    try {
        const url = `${API_BASE_URL}/api/ai/predict/phrases?text=${encodeURIComponent(text)}&num_predictions=${numPredictions}&source_lang=${sourceLang}&return_lang=${returnLang}`;

        const response = await fetch(url, {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        if (!response.ok) return [];

        const data: PhrasePredictionResponse = await response.json();
        return data.predictions || [];
    } catch (error) {
        console.error('Phrase prediction error:', error);
        return [];
    }
}
