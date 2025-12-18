/**
 * Configurable STT Service
 * Allows runtime switching between browser and API STT providers.
 */

import { STTProvider, STTOptions } from './types';
import { BrowserSTTProvider } from './stt/browser-provider';
import { APISTTProvider } from './stt/api-provider';

// Define the provider types for STT
export type STTProviderType = 'browser' | 'api';

class ConfigurableSTTService implements STTProvider {
    name = 'configurable';
    private currentProvider: STTProvider;
    private browserProvider: BrowserSTTProvider;
    private apiProvider: APISTTProvider;
    private providerType: STTProviderType;
    private listeners: Set<(type: STTProviderType) => void> = new Set();

    constructor(defaultProvider: STTProviderType = 'browser') {
        this.browserProvider = new BrowserSTTProvider();
        this.apiProvider = new APISTTProvider();
        this.providerType = defaultProvider;
        this.currentProvider = this.getProvider(defaultProvider);

        // Try to load from localStorage
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('stt_provider_type');
            if (saved === 'browser' || saved === 'api') {
                this.setProvider(saved);
            }
        }

        console.log(`🎤 STT Service initialized with provider: ${this.providerType}`);
    }

    private getProvider(type: STTProviderType): STTProvider {
        return type === 'browser' ? this.browserProvider : this.apiProvider;
    }

    /**
     * Get current provider type
     */
    getProviderType(): STTProviderType {
        return this.providerType;
    }

    /**
     * Set STT provider (browser or API)
     */
    setProvider(type: STTProviderType): void {
        console.log(`🔄 Switching STT provider to: ${type}`);
        this.providerType = type;
        this.currentProvider = this.getProvider(type);

        // Save to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('stt_provider_type', type);
        }

        // Notify listeners
        this.listeners.forEach(listener => listener(type));
    }

    /**
     * Subscribe to provider changes
     */
    onProviderChange(listener: (type: STTProviderType) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // Implement STTProvider interface
    isAvailable(): boolean {
        return this.currentProvider.isAvailable();
    }

    isListening(): boolean {
        return this.currentProvider.isListening();
    }

    async startListening(lang: string, options: STTOptions): Promise<void> {
        if (!this.currentProvider.isAvailable()) {
            console.warn(`⚠️ STT ${this.currentProvider.name} is not available. Falling back to browser.`);
            // Fallback logic could go here, but strict adherence to setting is usually preferred unless unavailable.
            if (this.currentProvider !== this.browserProvider && this.browserProvider.isAvailable()) {
                return this.browserProvider.startListening(lang, options);
            }
        }
        return this.currentProvider.startListening(lang, options);
    }

    stopListening(): void {
        // Stop both providers to be safe
        this.browserProvider.stopListening();
        this.apiProvider.stopListening();
    }
}

// Singleton instance
export const configurableSTTService = new ConfigurableSTTService();
