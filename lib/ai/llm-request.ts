import type { NextRequest } from 'next/server';
import { DEFAULT_MODELS, LLM_PROVIDERS, type LLMProvider } from '@/lib/config/llm-config';

const isProvider = (value: string | null | undefined): value is LLMProvider => {
    return !!value && LLM_PROVIDERS.some((provider) => provider.id === value);
};

export const getLLMRequestConfig = (req: NextRequest) => {
    const providerHeader = req.headers.get('x-provider');
    const provider: LLMProvider = isProvider(providerHeader) ? providerHeader : 'openai';

    const modelHeader = req.headers.get('x-model');
    const envModel = provider === 'openai' ? process.env.OPENAI_MODEL : undefined;
    const model = modelHeader || envModel || DEFAULT_MODELS[provider];

    const envKey = provider === 'openai' ? process.env.OPENAI_API_KEY : undefined;
    const apiKeyValue = req.headers.get('x-api-key') || envKey;
    const apiKey = apiKeyValue ? apiKeyValue.trim() : null;

    return { provider, model, apiKey };
};

