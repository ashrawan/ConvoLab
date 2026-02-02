import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_MODELS, LLM_PROVIDERS, type LLMProvider } from '@/lib/config/llm-config';

export interface ConfigurationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Provider = LLMProvider;

const PROVIDER_ICONS: Record<Provider, string> = {
    openai: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z',
    anthropic: 'M12 2L2 22h20L12 2zm0 4l6 14H6l6-14z',
    google: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    openrouter: 'M12 2a9 9 0 0 0-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7a9 9 0 0 0-9-9z',
    groq: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V8h2v4zm4 4h-2v-2h2v2zm0-4h-2V8h2v4z'
};

const PROVIDERS: { id: Provider; name: string; icon: string }[] = LLM_PROVIDERS.map((provider) => ({
    ...provider,
    icon: PROVIDER_ICONS[provider.id]
}));

type AudioProvider = 'openai' | 'deepgram' | 'elevenlabs';

const AUDIO_PROVIDERS: { id: AudioProvider; name: string; type: 'tts' | 'stt' | 'both'; icon: string }[] = [
    { id: 'openai', name: 'OpenAI Audio', type: 'both', icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z' },
    { id: 'deepgram', name: 'Deepgram', type: 'stt', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V8h2v4zm4 4h-2v-2h2v2zm0-4h-2V8h2v4z' }, // Simplified icon
    { id: 'elevenlabs', name: 'ElevenLabs', type: 'tts', icon: 'M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4c-.55 0-1 .45-1 1zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z' }
];

const STORAGE_KEYS = {
    llmKey: (provider: Provider) => `key_${provider}`,
    audioKey: (provider: AudioProvider) => `key_${provider}`,
    llmModel: (provider: Provider) => `model_name_${provider}`,
    ttsModel: 'model_name_tts',
    sttModel: 'model_name_stt',
    deepgramModel: 'model_name_deepgram',
    elevenlabsVoiceId: 'voice_id_elevenlabs',
    elevenlabsModel: 'model_name_elevenlabs',
    elevenlabsStability: 'elevenlabs_stability',
    elevenlabsSpeed: 'elevenlabs_speed',
    activeProviderTts: 'active_provider_tts',
    activeProviderStt: 'active_provider_stt',
    selectedLlmProvider: 'user_llm_provider',
    selectedLlmModel: 'user_selected_model',
    openaiAudioKey: 'key_openai_audio',
    legacyOpenaiKey: 'user_openai_api_key'
} as const;

const DEFAULT_AUDIO_CONFIG = {
    ttsModel: 'tts-1',
    sttModel: 'whisper-1',
    deepgramModel: 'nova-2',
    elevenlabsVoiceId: 'hpp4J3VqNfWAUOO0d1Us',
    elevenlabsModel: 'eleven_multilingual_v2',
    elevenlabsStability: '0.35',
    elevenlabsSpeed: '0.9'
};

const DEFAULT_ACTIVE_AUDIO_PROVIDERS = {
    tts: 'openai',
    stt: 'openai'
};

type AudioConfig = typeof DEFAULT_AUDIO_CONFIG;

export const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ isOpen, onClose }) => {
    const [selectedTab, setSelectedTab] = useState<'llm' | 'audio'>('llm');
    const [selectedProvider, setSelectedProvider] = useState<Provider>('openai');
    const [selectedAudioProvider, setSelectedAudioProvider] = useState<AudioProvider>('openai');

    // API Keys
    const [keys, setKeys] = useState<Record<Provider, string>>({
        openai: '',
        anthropic: '',
        google: '',
        openrouter: '',
        groq: ''
    });

    const [audioKeys, setAudioKeys] = useState<Record<AudioProvider, string>>({
        openai: '',
        deepgram: '',
        elevenlabs: ''
    });

    // Model Specific Configurations - uses DEFAULT_MODELS as initial state
    const [models, setModels] = useState<Record<Provider, string>>({ ...DEFAULT_MODELS });


    // Audio Configurations
    const [audioConfig, setAudioConfig] = useState<AudioConfig>({ ...DEFAULT_AUDIO_CONFIG });

    // Valid Audio Providers (Active)
    const [activeAudioProviders, setActiveAudioProviders] = useState(DEFAULT_ACTIVE_AUDIO_PROVIDERS);

    const selectedProviderMeta = useMemo(
        () => PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0],
        [selectedProvider]
    );
    const selectedAudioProviderMeta = useMemo(
        () => AUDIO_PROVIDERS.find((p) => p.id === selectedAudioProvider) || AUDIO_PROVIDERS[0],
        [selectedAudioProvider]
    );

    const updateAudioConfig = (key: keyof AudioConfig, value: string) => {
        setAudioConfig((prev) => ({ ...prev, [key]: value }));
    };

    const getStoredValue = (key: string, fallback = '') => {
        if (typeof window === 'undefined') return fallback;
        const stored = localStorage.getItem(key);
        return stored ?? fallback;
    };

    useEffect(() => {
        if (typeof window === 'undefined' || !isOpen) return;

        const storedKeys = Object.fromEntries(
            PROVIDERS.map((provider) => [provider.id, getStoredValue(STORAGE_KEYS.llmKey(provider.id))])
        ) as Record<Provider, string>;

        const storedAudioKeys = Object.fromEntries(
            AUDIO_PROVIDERS.map((provider) => {
                const value = provider.id === 'openai'
                    ? getStoredValue(STORAGE_KEYS.openaiAudioKey, getStoredValue(STORAGE_KEYS.llmKey('openai')))
                    : getStoredValue(STORAGE_KEYS.audioKey(provider.id));
                return [provider.id, value];
            })
        ) as Record<AudioProvider, string>;

        const storedModels = Object.fromEntries(
            PROVIDERS.map((provider) => [
                provider.id,
                getStoredValue(STORAGE_KEYS.llmModel(provider.id), DEFAULT_MODELS[provider.id])
            ])
        ) as Record<Provider, string>;

        setKeys(storedKeys);
        setAudioKeys(storedAudioKeys);
        setModels(storedModels);

        setAudioConfig({
            ttsModel: getStoredValue(STORAGE_KEYS.ttsModel, DEFAULT_AUDIO_CONFIG.ttsModel),
            sttModel: getStoredValue(STORAGE_KEYS.sttModel, DEFAULT_AUDIO_CONFIG.sttModel),
            deepgramModel: getStoredValue(STORAGE_KEYS.deepgramModel, DEFAULT_AUDIO_CONFIG.deepgramModel),
            elevenlabsVoiceId: getStoredValue(STORAGE_KEYS.elevenlabsVoiceId, DEFAULT_AUDIO_CONFIG.elevenlabsVoiceId),
            elevenlabsModel: getStoredValue(STORAGE_KEYS.elevenlabsModel, DEFAULT_AUDIO_CONFIG.elevenlabsModel),
            elevenlabsStability: getStoredValue(STORAGE_KEYS.elevenlabsStability, DEFAULT_AUDIO_CONFIG.elevenlabsStability),
            elevenlabsSpeed: getStoredValue(STORAGE_KEYS.elevenlabsSpeed, DEFAULT_AUDIO_CONFIG.elevenlabsSpeed)
        });

        setActiveAudioProviders({
            tts: getStoredValue(STORAGE_KEYS.activeProviderTts, DEFAULT_ACTIVE_AUDIO_PROVIDERS.tts),
            stt: getStoredValue(STORAGE_KEYS.activeProviderStt, DEFAULT_ACTIVE_AUDIO_PROVIDERS.stt)
        });

        const lastProvider = getStoredValue(STORAGE_KEYS.selectedLlmProvider) as Provider;
        if (lastProvider && PROVIDERS.some((provider) => provider.id === lastProvider)) {
            setSelectedProvider(lastProvider);
        }
    }, [isOpen]);

    const handleSave = () => {
        if (typeof window === 'undefined') {
            onClose();
            return;
        }

        const persistValue = (key: string, value: string) => {
            if (value) {
                localStorage.setItem(key, value);
            } else {
                localStorage.removeItem(key);
            }
        };

        // Save all LLM keys
        PROVIDERS.forEach((provider) => {
            persistValue(STORAGE_KEYS.llmKey(provider.id), keys[provider.id]);
        });

        // Save all audio keys (sync OpenAI audio key for backwards compatibility)
        AUDIO_PROVIDERS.forEach((provider) => {
            const value = audioKeys[provider.id];
            persistValue(STORAGE_KEYS.audioKey(provider.id), value);

            if (provider.id === 'openai') {
                persistValue(STORAGE_KEYS.openaiAudioKey, value);
            }
        });

        // Save all custom models
        PROVIDERS.forEach((provider) => {
            localStorage.setItem(STORAGE_KEYS.llmModel(provider.id), models[provider.id]);
        });

        // Save Audio Config
        localStorage.setItem(STORAGE_KEYS.ttsModel, audioConfig.ttsModel);
        localStorage.setItem(STORAGE_KEYS.sttModel, audioConfig.sttModel);
        localStorage.setItem(STORAGE_KEYS.deepgramModel, audioConfig.deepgramModel);
        localStorage.setItem(STORAGE_KEYS.elevenlabsVoiceId, audioConfig.elevenlabsVoiceId);
        localStorage.setItem(STORAGE_KEYS.elevenlabsModel, audioConfig.elevenlabsModel);
        localStorage.setItem(STORAGE_KEYS.elevenlabsStability, audioConfig.elevenlabsStability);
        localStorage.setItem(STORAGE_KEYS.elevenlabsSpeed, audioConfig.elevenlabsSpeed);

        // Save Active Providers
        localStorage.setItem(STORAGE_KEYS.activeProviderTts, activeAudioProviders.tts);
        localStorage.setItem(STORAGE_KEYS.activeProviderStt, activeAudioProviders.stt);

        // Set active provider logic
        localStorage.setItem(STORAGE_KEYS.selectedLlmProvider, selectedProvider);
        localStorage.setItem(STORAGE_KEYS.selectedLlmModel, models[selectedProvider]); // Update current global model selection

        // Backward compatibility
        if (selectedProvider === 'openai') {
            localStorage.setItem(STORAGE_KEYS.legacyOpenaiKey, keys.openai);
        } else {
            localStorage.removeItem(STORAGE_KEYS.legacyOpenaiKey);
        }

        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-background border border-border rounded-xl shadow-2xl z-[10000] overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight">System Configuration</h2>
                                <p className="text-sm text-muted-foreground mt-1">Manage API keys, models, and audio settings.</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-border">
                            <button
                                onClick={() => setSelectedTab('llm')}
                                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${selectedTab === 'llm' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            >
                                LLM Provider
                            </button>
                            <button
                                onClick={() => setSelectedTab('audio')}
                                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${selectedTab === 'audio' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            >
                                Audio Services
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex overflow-hidden">
                            {selectedTab === 'llm' ? (
                                <>
                                    {/* Sidebar: Providers */}
                                    <div className="w-1/3 border-r border-border bg-muted/10 overflow-y-auto p-4 space-y-2">
                                        {PROVIDERS.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedProvider(p.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${selectedProvider === p.id
                                                    ? 'bg-primary text-primary-foreground shadow-md'
                                                    : 'hover:bg-muted text-foreground'
                                                    }`}
                                            >
                                                <svg className="w-5 h-5 opacity-90" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d={p.icon} />
                                                </svg>
                                                {p.name}
                                                {keys[p.id] && selectedProvider !== p.id && (
                                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Main: Inputs */}
                                    <div className="flex-1 p-6 overflow-y-auto bg-background">
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d={selectedProviderMeta.icon} />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold">{selectedProviderMeta.name}</h3>
                                                    <p className="text-xs text-muted-foreground">Configure connection details.</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {/* API Key Input */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">API Key</label>
                                                    <div className="relative">
                                                        <input
                                                            type="password"
                                                            value={keys[selectedProvider]}
                                                            onChange={(e) => setKeys({ ...keys, [selectedProvider]: e.target.value })}
                                                            placeholder={`apikey...`}
                                                            className="w-full px-4 py-3 rounded-lg border border-input bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono text-sm"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                                                            Encrypted
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Model Name Input */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Model ID</label>
                                                    <input
                                                        type="text"
                                                        value={models[selectedProvider]}
                                                        onChange={(e) => setModels({ ...models, [selectedProvider]: e.target.value })}
                                                        placeholder="e.g. gpt-4o, claude-3-5-sonnet... "
                                                        className="w-full px-4 py-3 rounded-lg border border-input bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono text-sm"
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        Enter the exact model ID to use for this provider.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-8 mt-8 border-t border-border">
                                                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg p-4 text-sm">
                                                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                                                        Info
                                                    </h4>
                                                    Settings are auto-saved to your browser's local storage.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* Audio Tab Content */
                                <div className="flex-1 flex overflow-hidden">
                                    {/* Sidebar: Audio Providers */}
                                    <div className="w-1/3 border-r border-border bg-muted/10 overflow-y-auto p-4 space-y-2">
                                        {AUDIO_PROVIDERS.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedAudioProvider(p.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${selectedAudioProvider === p.id
                                                    ? 'bg-primary text-primary-foreground shadow-md'
                                                    : 'hover:bg-muted text-foreground'
                                                    }`}
                                            >
                                                <svg className="w-5 h-5 opacity-90" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d={p.icon} />
                                                </svg>
                                                {p.name}
                                                {audioKeys[p.id] && selectedAudioProvider !== p.id && (
                                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Main: Audio Configuration */}
                                    <div className="flex-1 p-6 overflow-y-auto bg-background">
                                        <div className="space-y-8">

                                            {/* Selected Provider Configuration */}
                                            <div>
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d={selectedAudioProviderMeta.icon} />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                    <h3 className="text-lg font-semibold">{selectedAudioProviderMeta.name}</h3>
                                                        <p className="text-xs text-muted-foreground">Configure connection details.</p>
                                                    </div>
                                                </div>

                                                {/* Configuration Fields */}
                                                <div className="space-y-4">
                                                    {/* API Key */}
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">API Key</label>
                                                        <div className="relative">
                                                            <input
                                                                type="password"
                                                                value={audioKeys[selectedAudioProvider]}
                                                                onChange={(e) => setAudioKeys({ ...audioKeys, [selectedAudioProvider]: e.target.value })}
                                                                placeholder={selectedAudioProvider === 'openai' ? 'apikey...' : 'API Secret Key'}
                                                                className="w-full px-4 py-3 rounded-lg border border-input bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono text-sm"
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                                                                Encrypted
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Provider Specific Settings */}
                                                    {selectedAudioProvider === 'openai' && (
                                                        <>
                                                            <div className="space-y-2">
                                                                <label className="text-sm font-medium">TTS Model</label>
                                                                <input
                                                                    type="text"
                                                                    value={audioConfig.ttsModel}
                                                                    onChange={(e) => updateAudioConfig('ttsModel', e.target.value)}
                                                                    className="w-full px-4 py-3 rounded-lg border border-input bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono text-sm"
                                                                    placeholder="tts-1"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-sm font-medium">STT Model</label>
                                                                <input
                                                                    type="text"
                                                                    value={audioConfig.sttModel}
                                                                    onChange={(e) => updateAudioConfig('sttModel', e.target.value)}
                                                                    className="w-full px-4 py-3 rounded-lg border border-input bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono text-sm"
                                                                    placeholder="whisper-1"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    {selectedAudioProvider === 'deepgram' && (
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium">STT Model</label>
                                                            <input
                                                                type="text"
                                                                value={audioConfig.deepgramModel}
                                                            onChange={(e) => updateAudioConfig('deepgramModel', e.target.value)}
                                                                className="w-full px-4 py-3 rounded-lg border border-input bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono text-sm"
                                                                placeholder="nova-2"
                                                            />
                                                        </div>
                                                    )}

                                                    {selectedAudioProvider === 'elevenlabs' && (
                                                        <>
                                                            <div className="space-y-2">
                                                                <label className="text-sm font-medium">Model ID</label>
                                                                <input
                                                                    type="text"
                                                                    value={audioConfig.elevenlabsModel}
                                                                    onChange={(e) => updateAudioConfig('elevenlabsModel', e.target.value)}
                                                                    className="w-full px-4 py-3 rounded-lg border border-input bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono text-sm"
                                                                    placeholder="eleven_multilingual_v2"
                                                                />
                                                                <p className="text-xs text-muted-foreground">
                                                                    Use a v2 model on free tier (for example, eleven_multilingual_v2).
                                                                </p>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                                <div className="space-y-2">
                                                                    <label className="text-sm font-medium">Stability</label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="1"
                                                                        step="0.01"
                                                                        value={audioConfig.elevenlabsStability}
                                                                        onChange={(e) => updateAudioConfig('elevenlabsStability', e.target.value)}
                                                                        className="w-full px-4 py-3 rounded-lg border border-input bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono text-sm"
                                                                        placeholder="0.35"
                                                                    />
                                                                    <p className="text-xs text-muted-foreground">
                                                                        0.35 equals 35% stability. Increase for more monotone output.
                                                                    </p>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-sm font-medium">Speed</label>
                                                                    <input
                                                                        type="number"
                                                                        min="0.7"
                                                                        max="1.2"
                                                                        step="0.01"
                                                                        value={audioConfig.elevenlabsSpeed}
                                                                        onChange={(e) => updateAudioConfig('elevenlabsSpeed', e.target.value)}
                                                                        className="w-full px-4 py-3 rounded-lg border border-input bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono text-sm"
                                                                        placeholder="0.9"
                                                                    />
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Default is 0.9 for slightly slower delivery.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-sm font-medium">Voice ID</label>
                                                                <input
                                                                    type="text"
                                                                    value={audioConfig.elevenlabsVoiceId}
                                                                    onChange={(e) => updateAudioConfig('elevenlabsVoiceId', e.target.value)}
                                                                    className="w-full px-4 py-3 rounded-lg border border-input bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono text-sm"
                                                                    placeholder="Voice ID"
                                                                />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-border bg-background flex justify-end gap-3">
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm transition-all active:scale-95"
                            >
                                Save Changes
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
