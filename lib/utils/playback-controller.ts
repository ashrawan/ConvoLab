/**
 * Centralized Playback Controller
 * Handles audio playback and word-by-word highlighting with mode support
 */

import { sequentialAudioPlayer } from './audio-player';

// ============================================================================
// Types
// ============================================================================

export type PlaybackMode = 'audio' | 'highlight' | 'manual';

export interface PlaybackItem {
    text: string;
    lang: string;
    key: string;
}

export interface PlaybackCallbacks {
    onPlayingKeyChange: (key: string | null) => void;
    onHighlightIndexChange: (index: number) => void;
}

export interface PlaybackOptions {
    wpm?: number;           // Words per minute for highlight mode (default: 180)
    delayBetween?: number;  // Delay between items in ms (default: 500)
}

// ============================================================================
// Playback Controller Class
// ============================================================================

class PlaybackController {
    private highlightIntervalRef: NodeJS.Timeout | null = null;
    private highlightResolverRef: (() => void) | null = null;
    private isActive: boolean = false;

    // Concurrency control
    private currentRequestId: number = 0;
    private activeCallbacks: PlaybackCallbacks | null = null;

    // ============================================================================
    // Public API
    // ============================================================================

    /**
     * Play a sequence of items based on the playback mode
     */
    async playSequence(
        items: PlaybackItem[],
        mode: PlaybackMode,
        callbacks: PlaybackCallbacks,
        options: PlaybackOptions = {}
    ): Promise<void> {
        if (items.length === 0) return;
        if (mode === 'manual') return; // No auto-play in manual mode

        // Stop any previous playback and register new one
        this.stop();

        const requestId = this.currentRequestId;
        this.activeCallbacks = callbacks;
        this.isActive = true;

        const { wpm = 180, delayBetween = 500 } = options;

        try {
            if (mode === 'audio') {
                await this.playAudioSequence(items, requestId, callbacks, delayBetween);
            } else if (mode === 'highlight') {
                await this.playHighlightSequence(items, requestId, callbacks, wpm, delayBetween);
            }
        } finally {
            // Only clean up if we are still the active request
            if (this.currentRequestId === requestId) {
                if (this.activeCallbacks) {
                    this.activeCallbacks.onPlayingKeyChange(null);
                    this.activeCallbacks.onHighlightIndexChange(-1);
                    this.activeCallbacks = null;
                }
                this.isActive = false;
            }
        }
    }

    /**
     * Play a single item based on the playback mode (for manual clicks)
     */
    async playItem(
        item: PlaybackItem,
        mode: PlaybackMode,
        callbacks: PlaybackCallbacks,
        options: PlaybackOptions = {}
    ): Promise<void> {
        // Stop any previous playback
        this.stop();

        const requestId = this.currentRequestId;
        this.activeCallbacks = callbacks;
        this.isActive = true;

        const { wpm = 180 } = options;

        try {
            if (mode === 'highlight') {
                // In highlight mode, clicking still highlights (not speaks)
                await this.highlightText(item.text, item.key, requestId, callbacks, wpm);
            } else {
                // In audio and manual modes, clicking speaks
                await this.speakText(item.text, item.lang, item.key, requestId, callbacks);
            }
        } finally {
            if (this.currentRequestId === requestId) {
                if (this.activeCallbacks) {
                    this.activeCallbacks.onPlayingKeyChange(null);
                    this.activeCallbacks.onHighlightIndexChange(-1);
                    this.activeCallbacks = null;
                }
                this.isActive = false;
            }
        }
    }

    /**
     * Stop all playback (audio and highlighting)
     */
    stop(): void {
        // Invalidate current request
        this.currentRequestId++;
        this.isActive = false;

        // 1. Clean up active callbacks (reset state visually)
        if (this.activeCallbacks) {
            this.activeCallbacks.onPlayingKeyChange(null);
            this.activeCallbacks.onHighlightIndexChange(-1);
            this.activeCallbacks = null;
        }

        // 2. Stop audio
        sequentialAudioPlayer.cancel();

        // 3. Stop highlighting
        if (this.highlightIntervalRef) {
            clearInterval(this.highlightIntervalRef);
            this.highlightIntervalRef = null;
        }

        // 4. Resolve any pending highlight promise (releasing the await)
        if (this.highlightResolverRef) {
            this.highlightResolverRef();
            this.highlightResolverRef = null;
        }
    }

    /**
     * Check if currently playing
     */
    isPlaying(): boolean {
        return this.isActive;
    }

    /**
     * Warm up audio context (call on user interaction)
     */
    warmup(): void {
        sequentialAudioPlayer.resumeContext();
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    /**
     * Play items as audio sequentially
     */
    private async playAudioSequence(
        items: PlaybackItem[],
        requestId: number,
        callbacks: PlaybackCallbacks,
        delayBetween: number
    ): Promise<void> {
        const queue = items.map(item => ({
            text: item.text,
            lang: item.lang,
            onStart: () => {
                if (this.currentRequestId === requestId) {
                    callbacks.onPlayingKeyChange(item.key);
                }
            },
            onEnd: () => {
                // We rely on sequence/finally to clear the key generally, 
                // but during sequence we can clear it before next starts if we wanted.
                // However, SequentialAudioPlayer might overlap slightly or delay?
                // Let's safe-guard global check.
                if (this.currentRequestId === requestId) {
                    callbacks.onPlayingKeyChange(null);
                }
            }
        }));

        await sequentialAudioPlayer.playSequentially(queue, delayBetween);
    }

    /**
     * Play items as word-by-word highlight sequentially
     */
    private async playHighlightSequence(
        items: PlaybackItem[],
        requestId: number,
        callbacks: PlaybackCallbacks,
        wpm: number,
        delayBetween: number
    ): Promise<void> {
        for (let i = 0; i < items.length; i++) {
            if (this.currentRequestId !== requestId) break;

            const item = items[i];
            await this.highlightText(item.text, item.key, requestId, callbacks, wpm);

            // Delay between items (except after the last one)
            if (i < items.length - 1 && this.currentRequestId === requestId) {
                await new Promise(resolve => setTimeout(resolve, delayBetween));
            }
        }
    }

    /**
     * Highlight text word by word
     */
    private highlightText(
        text: string,
        key: string,
        requestId: number,
        callbacks: PlaybackCallbacks,
        wpm: number
    ): Promise<void> {
        // Double check request validity
        if (this.currentRequestId !== requestId) return Promise.resolve();

        // Cleanup any previous interval (redundant if logic is correct, but safe)
        if (this.highlightIntervalRef) {
            clearInterval(this.highlightIntervalRef);
        }
        if (this.highlightResolverRef) {
            // Should have been cleared by stop/start logic, but just in case
            this.highlightResolverRef();
            this.highlightResolverRef = null;
        }

        callbacks.onPlayingKeyChange(key);
        callbacks.onHighlightIndexChange(-1);

        // Split into words (filter out whitespace-only parts)
        const words = text.split(/(\s+)/).filter(p => p.length > 0 && !p.match(/^\s+$/));
        if (words.length === 0) {
            return Promise.resolve();
        }

        // Calculate ms per word from WPM (with safety bounds)
        const safeWpm = Math.max(50, Math.min(1000, wpm));
        const msPerWord = 60000 / safeWpm;

        let currentIndex = 0;

        return new Promise<void>((resolve) => {
            this.highlightResolverRef = resolve;
            callbacks.onHighlightIndexChange(0);

            this.highlightIntervalRef = setInterval(() => {
                // Periodic staleness check
                if (this.currentRequestId !== requestId) {
                    if (this.highlightIntervalRef) clearInterval(this.highlightIntervalRef);
                    // No need to callback clean - stop() handled it
                    resolve();
                    return;
                }

                currentIndex++;
                if (currentIndex >= words.length) {
                    if (this.highlightIntervalRef) clearInterval(this.highlightIntervalRef);
                    this.highlightIntervalRef = null;
                    if (this.highlightResolverRef) {
                        this.highlightResolverRef = null;
                    }
                    // We don't clear state here, we let the sequence/finally block handle it or the next item
                    resolve();
                } else {
                    callbacks.onHighlightIndexChange(currentIndex);
                }
            }, msPerWord);
        });
    }

    /**
     * Speak a single text using TTS
     */
    private async speakText(
        text: string,
        lang: string,
        key: string,
        requestId: number,
        callbacks: PlaybackCallbacks
    ): Promise<void> {
        if (this.currentRequestId !== requestId) return;

        callbacks.onPlayingKeyChange(key);

        await sequentialAudioPlayer.playSequentially([{
            text,
            lang,
            onStart: () => { },
            onEnd: () => { }
        }], 0);

        if (this.currentRequestId === requestId) {
            callbacks.onPlayingKeyChange(null);
        }
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const playbackController = new PlaybackController();
