/**
 * Centralized LLM Configuration
 * Single source of truth for all provider settings
 */

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'groq';

// All supported LLM providers
export const LLM_PROVIDERS: { id: LLMProvider; name: string }[] = [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'google', name: 'Google' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'groq', name: 'Groq' }
];

// Default models for each provider
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
    openai: 'gpt-5.2-2025-12-11',
    anthropic: 'claude-haiku-4-5-20251001',
    google: 'gemini-3-flash-preview',
    openrouter: 'openai/gpt-oss-120b',
    groq: 'llama-3.3-70b-versatile'
};

// LocalStorage key mapping for each provider
export const PROVIDER_KEY_MAP: Record<LLMProvider, string> = {
    openai: 'key_openai',
    anthropic: 'key_anthropic',
    google: 'key_google',
    openrouter: 'key_openrouter',
    groq: 'key_groq'
};

// API endpoints for each provider
export const PROVIDER_ENDPOINTS: Record<LLMProvider, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions'
};

/**
 * Get provider-specific model from storage with sane fallbacks
 */
export function getStoredProviderModel(provider: LLMProvider): string {
    if (typeof window === 'undefined') {
        return DEFAULT_MODELS[provider];
    }

    return (
        localStorage.getItem(`model_name_${provider}`) ||
        localStorage.getItem('user_selected_model') ||
        DEFAULT_MODELS[provider] ||
        DEFAULT_MODELS.openai
    );
}

/**
 * Get provider-specific API key from storage (trimmed)
 */
export function getStoredProviderApiKey(provider: LLMProvider): string | null {
    if (typeof window === 'undefined') return null;

    const storageKey = PROVIDER_KEY_MAP[provider];
    let apiKey = localStorage.getItem(storageKey);

    // Fallback to legacy key for OpenAI
    if (!apiKey && provider === 'openai') {
        apiKey = localStorage.getItem('user_openai_api_key');
    }

    return apiKey ? apiKey.trim() : null;
}

/**
 * Get the current LLM configuration from localStorage
 */
export function getLLMConfig(): { provider: LLMProvider; model: string; apiKey: string | null } {
    if (typeof window === 'undefined') {
        return { provider: 'openai', model: DEFAULT_MODELS.openai, apiKey: null };
    }

    const provider = (localStorage.getItem('user_llm_provider') || 'openai') as LLMProvider;
    const model = getStoredProviderModel(provider);
    const apiKey = getStoredProviderApiKey(provider);

    return { provider, model, apiKey };
}

/**
 * Build request headers for API calls
 */
export function getLLMHeaders(): Record<string, string> {
    const { provider, model, apiKey } = getLLMConfig();
    const headers: Record<string, string> = {};

    if (apiKey) headers['x-api-key'] = apiKey.trim();
    if (provider) headers['x-provider'] = provider;
    if (model) headers['x-model'] = model;

    return headers;
}

/**
 * Check if a provider has a valid API key configured
 */
export function hasApiKey(provider: LLMProvider): boolean {
    if (typeof window === 'undefined') return false;

    return !!getStoredProviderApiKey(provider);
}
