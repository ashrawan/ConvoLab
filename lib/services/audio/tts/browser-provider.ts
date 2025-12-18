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
        'zh': 'zh-CN',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'ar': 'ar-SA',
        'hi': 'hi-IN'
    };
    return speechLangs[langCode] || langCode;
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

        // CRITICAL: Cancel any ongoing speech/queue to prevent getting stuck behind a ghost utterance.
        // This effectively interrupts previous speech, which is desired for responsiveness.
        window.speechSynthesis.cancel();

        // We do NOT call cancel() here to allow queueing. 
        // Readers can call cancel() explicitly if they want to interrupt.

        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);
        activeUtterance = utterance; // Store global reference to prevent GC

        utterance.lang = getSpeechLang(lang);
        utterance.rate = options.rate || 0.9;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 1.0;

        // Ensure voices are loaded
        let voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            await new Promise<void>(resolve => {
                const onVoicesChanged = () => {
                    voices = window.speechSynthesis.getVoices();
                    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                    resolve();
                };
                window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
                // Fallback timeout in case event never fires (some browsers)
                setTimeout(() => {
                    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                    resolve();
                }, 1000);
            });
        }

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
            setTimeout(() => {
                if (!hasResolved) {
                    console.warn('⚠️ TTS timed out or stuck, forcing completion to unblock mic.');
                    if (options.onEnd) options.onEnd(); // ensure callback fires
                    cleanup();
                }
            }, 10000); // 10 seconds max safety valve

            // Speak
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }
            window.speechSynthesis.speak(utterance);
        });
    }
}
