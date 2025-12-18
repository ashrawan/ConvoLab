/**
 * API TTS Provider
 * Calls backend TTS API (backend chooses AI model)
 */

import { TTSProvider, TTSOptions } from '../types';
import { getSpeechLang } from './utils';

import { API_BASE_URL } from '@/lib/config/api';

export class APITTSProvider implements TTSProvider {
    name = 'api';
    private currentRequestId: number = 0;
    private activeOnEnd: (() => void) | null = null;

    // Singleton audio element to support mobile auto-play policies
    private static audioElement: HTMLAudioElement | null = null;

    constructor() {
        if (typeof window !== 'undefined' && !APITTSProvider.audioElement) {
            APITTSProvider.audioElement = new Audio();
        }
    }

    isAvailable(): boolean {
        return typeof window !== 'undefined' && 'Audio' in window;
    }

    /**
     * Warmup the audio engine by playing a silent sound/interacting with the element.
     * Call this on a user interaction event (click/touch).
     */
    warmup(): void {
        // Warmup removed as per user request
    }

    cancel(): void {
        this.currentRequestId++;

        // Stop any playing audio
        const audio = APITTSProvider.audioElement;
        if (audio) {
            audio.pause();
            audio.onplay = null;
            audio.onended = null;
            audio.onerror = null;
            // Don't nullify the static element, just stop it
        }

        // CRITICAL: Always trigger the pending completion callback if there is one
        // This unblocks the sequential audio player and allows hooks to clear their "Speaking..." state
        if (this.activeOnEnd) {
            const callback = this.activeOnEnd;
            this.activeOnEnd = null;
            callback();
        }
    }

    async speak(text: string, lang: string, options: TTSOptions = {}): Promise<void> {
        if (!text || !this.isAvailable()) {
            console.warn('⚠️ API TTS not available or no text provided');
            if (options.onEnd) options.onEnd();
            return;
        }

        // 1. Cancel previous request/playback and get a fresh ID
        this.cancel();
        const requestId = this.currentRequestId;

        // 2. Store the new completion callback
        this.activeOnEnd = options.onEnd || null;

        console.log(`🎵 API TTS (req ${requestId}): "${text.substring(0, 50)}..." (${lang})`);

        try {
            // Call backend TTS endpoint
            const response = await fetch(`${API_BASE_URL}/api/audio/tts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    text,
                    lang: getSpeechLang(lang),
                    speed: options.rate || 1.0
                })
            });

            // Check if we've been cancelled while fetching
            if (requestId !== this.currentRequestId) {
                console.log(`⏭️ Ignoring stale TTS response (req ${requestId})`);
                return;
            }

            if (!response.ok) {
                throw new Error(`TTS API error: ${response.statusText}`);
            }

            // Get audio blob
            const audioBlob = await response.blob();

            // Check again after blob download
            if (requestId !== this.currentRequestId) {
                return;
            }

            const audioUrl = URL.createObjectURL(audioBlob);

            // Use the singleton audio element
            const audio = APITTSProvider.audioElement;
            if (!audio) {
                throw new Error('Audio element not initialized');
            }

            audio.src = audioUrl;

            audio.onplay = () => {
                if (requestId === this.currentRequestId) {
                    console.log(`▶️ API audio started (req ${requestId})`);
                    if (options.onStart) options.onStart();
                }
            };

            audio.onended = () => {
                console.log(`⏹️ API audio ended (req ${requestId})`);
                URL.revokeObjectURL(audioUrl);

                if (requestId === this.currentRequestId) {
                    // Don't nullify static element
                    this.activeOnEnd = null;
                    if (options.onEnd) options.onEnd();
                }
            };

            audio.onerror = (error) => {
                console.error(`🔴 API audio error (req ${requestId}):`, error);
                URL.revokeObjectURL(audioUrl);

                if (requestId === this.currentRequestId) {
                    // Don't nullify static element
                    this.activeOnEnd = null;
                    if (options.onEnd) options.onEnd();
                }
            };

            await audio.play();

        } catch (error) {
            console.error(`❌ API TTS error (req ${requestId}):`, error);

            // Only call error callbacks if this is still the active request
            if (requestId === this.currentRequestId) {
                this.activeOnEnd = null;
                if (options.onEnd) options.onEnd();
            }

            // We don't rethrow here because the callback was handled, 
            // allowing the sequential player to proceed to next item if necessary.
        }
    }
}
