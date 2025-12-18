
/**
 * Audio Service Factories
 * Creates and exports appropriate TTS and STT providers
 */

import { TTSProvider, STTProvider } from './types';
import { configurableTTSService } from './configurable-tts';
import { configurableSTTService } from './configurable-stt';

// Export configurable TTS service (allows runtime switching)
export const ttsService = configurableTTSService;

// Export configurable STT service (follows TTS provider setting)
export const sttService = configurableSTTService;

// Export types
export type { TTSProvider, TTSOptions, STTProvider, STTOptions } from './types';
export type { TTSProviderType } from './configurable-tts';
export type { STTProviderType } from './configurable-stt';

// Re-export utility
export { getSpeechLang } from './tts/utils';

