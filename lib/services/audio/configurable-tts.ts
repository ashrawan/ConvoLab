/**
 * Configurable TTS Service
 * Allows runtime switching between browser and API TTS providers
 */

import { TTSProvider, TTSOptions } from './types';
import { BrowserTTSProvider } from './tts/browser-provider';
import { APITTSProvider } from './tts/api-provider';

type TTSProviderType = 'browser' | 'api';

class ConfigurableTTSService implements TTSProvider {
    name = 'configurable';
    private currentProvider: TTSProvider;
    private browserProvider: BrowserTTSProvider;
    private apiProvider: APITTSProvider;
    private providerType: TTSProviderType;
    private listeners: Set<(type: TTSProviderType) => void> = new Set();

    constructor(defaultProvider: TTSProviderType = 'browser') {
        this.browserProvider = new BrowserTTSProvider();
        this.apiProvider = new APITTSProvider();
        this.providerType = defaultProvider;
        this.currentProvider = this.getProvider(defaultProvider);

        // Try to load from localStorage
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('tts_provider_type');
            if (saved === 'browser' || saved === 'api') {
                this.setProvider(saved);
            }
        }

        console.log(`🔊 TTS Service initialized with provider: ${this.providerType}`);
    }

    private getProvider(type: TTSProviderType): TTSProvider {
        return type === 'browser' ? this.browserProvider : this.apiProvider;
    }

    /**
     * Get current provider type
     */
    getProviderType(): TTSProviderType {
        return this.providerType;
    }

    /**
     * Set TTS provider (browser or API)
     */
    setProvider(type: TTSProviderType): void {
        console.log(`🔄 Switching TTS provider to: ${type}`);
        // Cancel current playback before switching
        this.cancel();
        this.providerType = type;
        this.currentProvider = this.getProvider(type);

        // Save to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('tts_provider_type', type);
        }

        // Notify listeners
        this.listeners.forEach(listener => listener(type));
    }

    /**
     * Subscribe to provider changes
     */
    onProviderChange(listener: (type: TTSProviderType) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Check if browser TTS is available
     */
    isBrowserAvailable(): boolean {
        return this.browserProvider.isAvailable();
    }

    /**
     * Check if API TTS is available (backend must be running)
     */
    isAPIAvailable(): boolean {
        return this.apiProvider.isAvailable();
    }

    // Implement TTSProvider interface
    isAvailable(): boolean {
        return this.currentProvider.isAvailable();
    }

    cancel(): void {
        this.currentProvider.cancel();
    }

    warmup(): void {
        if (this.currentProvider.warmup) {
            this.currentProvider.warmup();
        }
    }

    async speak(text: string, lang: string, options?: TTSOptions): Promise<void> {
        return this.currentProvider.speak(text, lang, options);
    }
}

// Singleton instance
export const configurableTTSService = new ConfigurableTTSService();

// Export type
export type { TTSProviderType };
