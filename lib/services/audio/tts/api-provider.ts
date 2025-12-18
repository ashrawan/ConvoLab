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
    private audioElement: HTMLAudioElement | null = null;

    isAvailable(): boolean {
        return typeof window !== 'undefined' && 'Audio' in window;
    }

    cancel(): void {
        this.currentRequestId++;

        // Stop any playing audio
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.onended = null;
            this.audioElement.onerror = null;
            this.audioElement = null;
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

            // Create and play audio element
            const audio = new Audio(audioUrl);
            this.audioElement = audio;

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
                    this.audioElement = null;
                    this.activeOnEnd = null;
                    if (options.onEnd) options.onEnd();
                }
            };

            audio.onerror = (error) => {
                console.error(`🔴 API audio error (req ${requestId}):`, error);
                URL.revokeObjectURL(audioUrl);

                if (requestId === this.currentRequestId) {
                    this.audioElement = null;
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
