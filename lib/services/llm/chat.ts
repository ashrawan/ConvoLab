/**
 * LLM Service - AI Response Generation
 */

import { apiClient } from '@/lib/utils/api-client';

export interface LLMResponseOptions {
    message: string;
    context?: string;
    party_a_context?: string;
    party_b_context?: string;
    source_lang: string;
    return_lang: string;
    stream?: boolean;
    history?: Array<{ role: string; content: string }>;
}

export const chatService = {
    /**
     * Generate AI response (with optional streaming)
     */
    async generateResponse(options: LLMResponseOptions): Promise<Response> {
        return apiClient.postStream('/api/ai/respond', options);
    },

    /**
     * Get conversation continuation suggestions
     */
    async getConversationSuggestions(data: {
        conversation_history: Array<{ user: string; ai: string }>;
        source_lang: string;
        target_langs: string[];
    }) {
        return apiClient.post('/api/ai/suggestions', data);
    }
};
