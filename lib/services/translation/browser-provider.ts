/**
 * Browser Translation Provider
 * Uses the experimental Translation API (Chrome only)
 */

import { TranslationProvider } from './types';

export class BrowserTranslationProvider implements TranslationProvider {
    name = 'browser';

    isAvailable(): boolean {
        // Check if Translation API is available (experimental Chrome feature)
        return 'translation' in self && 'createTranslator' in (self as any).translation;
    }

    async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
        if (!this.isAvailable()) {
            throw new Error('Browser Translation API not available. Use Chrome Canary with experimental features enabled.');
        }

        try {
            // @ts-ignore - Experimental API
            const translator = await self.translation.createTranslator({
                sourceLanguage: sourceLang,
                targetLanguage: targetLang
            });

            const result = await translator.translate(text);
            return result;
        } catch (error) {
            console.error('Browser translation error:', error);
            throw error;
        }
    }

    async translateMultiple(
        text: string,
        sourceLang: string,
        targetLangs: string[]
    ): Promise<Record<string, string>> {
        const translations: Record<string, string> = {};

        // Translate to each target language
        for (const targetLang of targetLangs) {
            try {
                translations[targetLang] = await this.translate(text, sourceLang, targetLang);
            } catch (error) {
                console.warn(`Failed to translate to ${targetLang}:`, error);
                translations[targetLang] = text; // Fallback to original
            }
        }

        return translations;
    }
}
