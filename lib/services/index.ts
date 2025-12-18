/**
 * Main Services Export
 * Central export point for all services
 */

// Translation Service
export { translationService } from './translation';
export type { TranslationProvider } from './translation';

// Audio Services
export { ttsService, sttService, getSpeechLang } from './audio';
export type { TTSProvider, TTSOptions, STTProvider, STTOptions, TTSProviderType, STTProviderType } from './audio';
