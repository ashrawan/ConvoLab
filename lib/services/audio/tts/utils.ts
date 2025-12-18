/**
 * Utility functions for audio services
 */

/**
 * Convert language code to speech synthesis language code
 */
export function getSpeechLang(langCode: string): string {
    const speechLangs: Record<string, string> = {
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'pt': 'pt-PT',
        'zh': 'zh-CN',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'ar': 'ar-SA',
        'hi': 'hi-IN'
    };

    return speechLangs[langCode] || langCode;
}
