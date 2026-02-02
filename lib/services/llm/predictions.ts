/**
 * API functions for phrase predictions with language support
 */

import { API_BASE_URL } from '@/lib/config/api';
import { getLLMHeaders } from '@/lib/config/llm-config';

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
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            ...getLLMHeaders()
        };


        const response = await fetch(`${API_BASE_URL}/api/ai/predict/phrases`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                party_context: "User", // This might need to be passed in, but for now default or infer? Original code didn't pass it clearly in GET params
                history: text, // The 'text' arg seems to be history or context. Original code encoded it as 'text'.
                lang_name: returnLang // Using returnLang as the language
            })
        });

        if (!response.ok) return [];

        const data = await response.json();
        return data.phrases ? data.phrases.map((p: string) => ({ phrase: p, probability: 1.0 })) : []; // Adapt response format
    } catch (error) {
        console.error('Phrase prediction error:', error);
        return [];
    }
}
