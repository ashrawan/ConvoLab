/**
 * Conversation Features
 * Consolidates conversation-related functionality
 */

import { chatService } from './chat';

export async function getConversationSuggestions(
    conversationHistory: Array<{ user: string; ai: string }>,
    sourceLang: string,
    targetLangs: string[]
) {
    try {
        const result = await chatService.getConversationSuggestions({
            conversation_history: conversationHistory,
            source_lang: sourceLang,
            target_langs: targetLangs
        });
        return result.suggestions || [];
    } catch (error) {
        console.error('Error fetching conversation suggestions:', error);
        return [];
    }
}
