/**
 * Translation Service Factory
 * Creates and exports the appropriate translation provider based on env config
 */

import { TranslationProvider } from './types';
import { BrowserTranslationProvider } from './browser-provider';
import { APITranslationProvider } from './api-provider';

type ProviderType = 'browser' | 'api';

function createTranslationService(): TranslationProvider {
    const providerType = (process.env.NEXT_PUBLIC_TRANSLATION_PROVIDER || 'api') as ProviderType;

    console.log(`🌐 Translation Provider: ${providerType}`);

    switch (providerType) {
        case 'browser':
            const browserProvider = new BrowserTranslationProvider();
            if (!browserProvider.isAvailable()) {
                console.warn('⚠️ Browser translation not available, falling back to API');
                return new APITranslationProvider();
            }
            return browserProvider;

        case 'api':
        default:
            return new APITranslationProvider();
    }
}

// Singleton instance
export const translationService = createTranslationService();

// Export types
export type { TranslationProvider } from './types';
