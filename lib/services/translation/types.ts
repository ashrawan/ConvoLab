/**
 * Translation Service Types and Interfaces
 */

export interface TranslationProvider {
    /** Provider name for logging/debugging */
    name: string;

    /** Translate text from source language to target language */
    translate(text: string, sourceLang: string, targetLang: string): Promise<string>;

    /** Translate text to multiple target languages */
    translateMultiple(
        text: string,
        sourceLang: string,
        targetLangs: string[]
    ): Promise<Record<string, string>>;

    /** Check if provider is available/supported */
    isAvailable(): boolean;
}

export interface TranslationOptions {
    /** Source language code (e.g., 'en', 'es') */
    sourceLang: string;

    /** Target language code(s) */
    targetLang?: string;
    targetLangs?: string[];
}
