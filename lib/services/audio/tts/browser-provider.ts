/**
 * Browser TTS Provider
 * Uses Web Speech Synthesis API
 */

import { TTSProvider, TTSOptions } from '../types';

/**
 * Get speech synthesis language code from language code
 */
function getSpeechLang(langCode: string): string {
    const speechLangs: Record<string, string> = {
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'pt': 'pt-PT',
        'zh-cn': 'zh-CN',
        'zh-tw': 'zh-TW',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'ar': 'ar-SA',
        'hi': 'hi-IN',
        'ru': 'ru-RU',
        'nl': 'nl-NL',
        'tr': 'tr-TR',
        'pl': 'pl-PL',
        'vi': 'vi-VN',
        'th': 'th-TH',
        'id': 'id-ID'
    };
    return speechLangs[langCode.toLowerCase()] || langCode;
}

// Module-level reference to prevent GC across re-renders/instances
let activeUtterance: SpeechSynthesisUtterance | null = null;

export class BrowserTTSProvider implements TTSProvider {
    name = 'browser';

    isAvailable(): boolean {
        return typeof window !== 'undefined' && 'speechSynthesis' in window;
    }

    cancel(): void {
        if (this.isAvailable()) {
            window.speechSynthesis.cancel();
            activeUtterance = null;
        }
    }

    /**
     * Warmup speech synthesis voices (best-effort)
     */
    warmup(): void {
        if (!this.isAvailable()) return;
        try {
            // Trigger voice list load for some browsers
            window.speechSynthesis.getVoices();
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }
        } catch (e) {
            console.warn('⚠️ Browser TTS warmup failed', e);
        }
    }

    async speak(text: string, lang: string, options: TTSOptions = {}): Promise<void> {
        if (!text || !this.isAvailable()) {
            console.warn('⚠️ Browser TTS not available or no text provided');
            return;
        }

        console.log(`🎵 Browser TTS: "${text.substring(0, 50)}..." (${lang})`);

        // Force cleanup of previous
        if (activeUtterance) {
            activeUtterance = null;
        }

        const isSpeakingOrPending = window.speechSynthesis.speaking || window.speechSynthesis.pending;
        if (isSpeakingOrPending) {
            // Cancel any ongoing speech/queue to prevent getting stuck behind a ghost utterance.
            // Some browsers need a tick after cancel() before speak() will work reliably.
            window.speechSynthesis.cancel();
        }

        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);
        activeUtterance = utterance; // Store global reference to prevent GC

        utterance.lang = getSpeechLang(lang);
        utterance.rate = options.rate || 0.9;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 1.0;

        // Load voices without blocking user gesture (best effort)
        const voices = window.speechSynthesis.getVoices();

        // Try to find matching voice
        if (voices.length > 0) {
            const langPrefix = lang.split('-')[0];
            const matchingVoice = voices.find(v =>
                v.lang.toLowerCase().startsWith(langPrefix.toLowerCase())
            );

            if (matchingVoice) {
                utterance.voice = matchingVoice;
                console.log(`✅ Using voice: ${matchingVoice.name} (${matchingVoice.lang})`);
            }
        }

        return new Promise<void>((resolve) => {
            let hasResolved = false;
            const cleanup = () => {
                if (!hasResolved) {
                    hasResolved = true;
                    activeUtterance = null;
                    resolve();
                }
            };

            // Set up event handlers
            utterance.onstart = () => {
                // console.log('▶️ Speech started'); 
                if (options.onStart) options.onStart();
            };

            utterance.onend = () => {
                if (options.onEnd) options.onEnd();
                cleanup();
            };

            utterance.onerror = (event: any) => {
                if (event.error !== 'canceled' && event.error !== 'interrupted') {
                    console.error('🔴 Speech error:', event.error);
                }
                if (options.onEnd) options.onEnd();
                cleanup();
            };

            // Safety Timeout: If speech gets stuck or doesn't fire end event
            // (Common in Chrome for long text or if tab is backgrounded)
            // Increased to 3 minutes to handle long generated responses without cutting off state prematurely.
            setTimeout(() => {
                if (!hasResolved) {
                    console.warn('⚠️ TTS timed out or stuck, forcing completion to unblock mic.');
                    if (options.onEnd) options.onEnd(); // ensure callback fires
                    cleanup();
                }
            }, 180000); // 3 minutes max safety valve

            // Speak (defer only if we had to cancel an active queue)
            const speakNow = () => {
                // If a newer request replaced this one, bail out
                if (activeUtterance !== utterance) {
                    cleanup();
                    return;
                }

                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }

                try {
                    window.speechSynthesis.speak(utterance);
                } catch (error) {
                    console.error('🔴 Speech error:', error);
                    if (options.onEnd) options.onEnd();
                    cleanup();
                }
            };

            if (isSpeakingOrPending) {
                setTimeout(speakNow, 0);
            } else {
                speakNow();
            }
        });
    }
}
