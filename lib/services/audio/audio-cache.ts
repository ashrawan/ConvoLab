/**
 * Audio Cache Service
 * Caches generated audio to avoid regenerating the same audio
 */

class AudioCacheService {
    private cache: Map<string, AudioBuffer | Blob> = new Map();

    /**
     * Generate cache key from text and language
     */
    private getCacheKey(text: string, lang: string): string {
        return `${lang}:${text.toLowerCase().trim()}`;
    }

    /**
     * Check if audio is cached
     */
    has(text: string, lang: string): boolean {
        const key = this.getCacheKey(text, lang);
        return this.cache.has(key);
    }

    /**
     * Get cached audio
     */
    get(text: string, lang: string): AudioBuffer | Blob | undefined {
        const key = this.getCacheKey(text, lang);
        return this.cache.get(key);
    }

    /**
     * Cache audio
     */
    set(text: string, lang: string, audio: AudioBuffer | Blob): void {
        const key = this.getCacheKey(text, lang);
        this.cache.set(key, audio);

        // Limit cache size to 100 items
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
    }

    /**
     * Clear cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache size
     */
    size(): number {
        return this.cache.size;
    }
}

// Singleton
export const audioCacheService = new AudioCacheService();
