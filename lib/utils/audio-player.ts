/**
 * Sequential Audio Playback Helper
 * Plays multiple audio clips one after another with proper timing
 */

import { ttsService, getSpeechLang } from '@/lib/services';

interface AudioQueueItem {
    text: string;
    lang: string;
    onStart?: () => void;
    onEnd?: () => void;
}

class SequentialAudioPlayer {
    private isPlaying: boolean = false;
    private currentQueue: AudioQueueItem[] = [];
    private globalOnPlaybackStart?: () => void;
    private globalOnPlaybackEnd?: () => void;

    private playbackPromise: Promise<void> = Promise.resolve();
    private currentRequestId: number = 0;

    /**
     * Set global callbacks for playback events
     */
    setGlobalCallbacks(onStart?: () => void, onEnd?: () => void): void {
        this.globalOnPlaybackStart = onStart;
        this.globalOnPlaybackEnd = onEnd;
    }

    /**
     * Resume Audio Context (Warmup)
     */
    resumeContext(): void {
        ttsService.warmup();
    }

    /**
     * Cancel any ongoing audio playback
     */
    cancel(): void {
        console.log('🛑 SequentialAudioPlayer: Cancel requested');
        ttsService.cancel();
        this.isPlaying = false;
        this.currentQueue = [];
        this.currentRequestId++; // Invalidate any pending bits of the promise chain

        // Finalize global end callback if was playing
        if (this.globalOnPlaybackEnd) {
            this.globalOnPlaybackEnd();
        }

        // Reset promise to allow immediate new playback
        this.playbackPromise = Promise.resolve();
    }

    /**
     * Play multiple audio clips sequentially
     * @param items - Array of audio items to play
     * @param delayBetween - Delay in ms between each audio clip (default: 500ms)
     * @param options - Playback options
     */
    async playSequentially(
        items: AudioQueueItem[],
        delayBetween: number = 500,
        options: { cancel?: boolean } = { cancel: true }
    ): Promise<void> {
        if (items.length === 0) return;

        if (options.cancel) {
            this.cancel();
        }

        const requestId = this.currentRequestId;

        // Add this request to the promise chain
        this.playbackPromise = this.playbackPromise.then(async () => {
            // If cancel() was called or a new request was made with cancel: true
            // while this one was waiting in the promise chain, skip it.
            if (requestId !== this.currentRequestId) {
                console.log('⏭️ Skipping stale audio request');
                return;
            }

            this.isPlaying = true;
            this.currentQueue = [...items];

            // Call global start callback
            if (this.globalOnPlaybackStart) {
                this.globalOnPlaybackStart();
            }

            for (let i = 0; i < items.length; i++) {
                // Check if we should stop (interrupted by cancel or another request)
                if (!this.isPlaying || requestId !== this.currentRequestId) {
                    console.log('⏹️ Audio playback interrupted');
                    break;
                }

                const item = items[i];

                console.log(`🔊 Playing audio ${i + 1}/${items.length}:`, {
                    text: item.text.substring(0, 30),
                    lang: item.lang
                });

                // Call onStart callback
                if (item.onStart) item.onStart();

                // Play the audio and wait for completion
                await new Promise<void>((resolve) => {
                    ttsService.speak(item.text, getSpeechLang(item.lang), {
                        onStart: () => { },
                        onEnd: () => {
                            if (item.onEnd) item.onEnd();
                            resolve();
                        }
                    });
                });

                // Wait delay before next audio (except after the last one)
                if (i < items.length - 1 && this.isPlaying && requestId === this.currentRequestId) {
                    console.log(`⏱️ Waiting ${delayBetween}ms before next audio...`);
                    await new Promise(resolve => setTimeout(resolve, delayBetween));
                }
            }

            // Only clear state if we are still the active request
            if (requestId === this.currentRequestId) {
                this.isPlaying = false;
                this.currentQueue = [];

                // Call global end callback
                if (this.globalOnPlaybackEnd) {
                    this.globalOnPlaybackEnd();
                }
                console.log('✅ Sequential playback completed');
            }
        });

        return this.playbackPromise;
    }

    /**
     * Check if currently playing
     */
    getIsPlaying(): boolean {
        return this.isPlaying;
    }
}

// Singleton instance
export const sequentialAudioPlayer = new SequentialAudioPlayer();
