/**
 * LLM Service - AI Response Generation
 */

import { apiClient } from '@/lib/utils/api-client';
import { getLLMHeaders } from '@/lib/config/llm-config';

export interface LLMResponseOptions {
    message: string;
    context?: string;
    party_a_context?: string;
    party_b_context?: string;
    source_lang: string;
    return_lang: string;
    stream?: boolean;
    history?: Array<{ role: string; content: string }>;
    notebook?: NotebookContext;
}

export interface NotebookRequest {
    history: Array<{ role: string; content: string }>;
    party_a_context?: string;
    party_b_context?: string;
}

export interface NotebookContext {
    title?: string;
    content?: string;
}

export const chatService = {
    /**
     * Generate AI response (with optional streaming)
     */
    async generateResponse(options: LLMResponseOptions): Promise<Response> {
        const headers = getLLMHeaders();
        return apiClient.postStream('/api/ai/respond', options, { headers });
    },

    /**
     * Generate the next message for Auto-Play simulation
     */
    async generateNextMessage(data: {
        party_a_context: string;
        party_b_context: string;
        party_a_lang?: string;
        history: Array<{ role: string; content: string }>;
        notebook?: NotebookContext;
    }): Promise<{ message: string }> {
        const headers = getLLMHeaders();
        return apiClient.post('/api/ai/autoplay/generate', data, { headers });
    },

    /**
     * Get conversation continuation suggestions
     */
    async getConversationSuggestions(data: {
        conversation_history: Array<{ user: string; ai: string }>;
        source_lang: string;
        target_langs: string[];
    }) {
        const headers = getLLMHeaders();
        return apiClient.post('/api/ai/suggestions', data, { headers });
    },

    /**
     * Generate a notebook from conversation history
     */
    async generateNotebook(data: NotebookRequest): Promise<{ markdown: string }> {
        const headers = getLLMHeaders();
        return apiClient.post('/api/ai/notebook', data, { headers });
    }
};
