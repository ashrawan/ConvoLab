import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_MODELS, LLM_PROVIDERS, getStoredProviderModel, hasApiKey, type LLMProvider } from '@/lib/config/llm-config';

export interface ModelSelectorProps {
    onOpenSettings: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onOpenSettings }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('openai');
    const [providerModelName, setProviderModelName] = useState(DEFAULT_MODELS.openai);
    const [missingKeys, setMissingKeys] = useState<LLMProvider[]>([]);
    const [isLocalMode, setIsLocalMode] = useState(true);
    const [activeTab, setActiveTab] = useState<'llm' | 'audio'>('llm');
    const [audioState, setAudioState] = useState({
        ttsProvider: 'openai',
        ttsModel: '',
        ttsKeyMissing: false,
        ttsMode: 'browser' as 'browser' | 'api',
        sttProvider: 'openai',
        sttModel: '',
        sttKeyMissing: false,
        sttMode: 'browser' as 'browser' | 'api'
    });
    const containerRef = useRef<HTMLDivElement>(null);

    const loadState = React.useCallback(() => {
        if (typeof window !== 'undefined') {
            const currentProvider = (localStorage.getItem('user_llm_provider') || 'openai') as LLMProvider;
            setSelectedProvider(currentProvider);

            // Check operation mode (Local vs Cloud)
            // Default to true (Local) if not set
            const isOffline = localStorage.getItem('app_mode_offline') !== 'false';
            setIsLocalMode(isOffline);

            // Get the specific model name configured for this provider
            const storedModel = localStorage.getItem(`model_name_${currentProvider}`);
            const modelName = storedModel && storedModel.toLowerCase() !== 'default'
                ? storedModel
                : (DEFAULT_MODELS[currentProvider] || DEFAULT_MODELS.openai);
            setProviderModelName(modelName);

            // Check for keys ONLY if in Local Mode
            const missing: LLMProvider[] = [];
            let ttsMissing = false;
            let sttMissing = false;

            // Audio State
            const ttsProvider = localStorage.getItem('active_provider_tts') || 'openai';
            const sttProvider = localStorage.getItem('active_provider_stt') || 'openai';
            const ttsModel = localStorage.getItem('model_name_tts') || (ttsProvider === 'elevenlabs' ? 'Default Voice' : 'tts-1');
            const sttModel = localStorage.getItem('model_name_stt') || (sttProvider === 'deepgram' ? 'nova-2' : 'whisper-1');

            if (isOffline) {
                LLM_PROVIDERS.forEach((provider) => {
                    if (!hasApiKey(provider.id)) missing.push(provider.id);
                });

                // Check Audio Keys
                const ttsKey = localStorage.getItem(`key_${ttsProvider}`) || (ttsProvider === 'openai' ? (localStorage.getItem('key_openai_audio') || localStorage.getItem('user_openai_api_key')) : null);
                if (!ttsKey) ttsMissing = true;

                const sttKey = localStorage.getItem(`key_${sttProvider}`) || (sttProvider === 'openai' ? (localStorage.getItem('key_openai_audio') || localStorage.getItem('user_openai_api_key')) : null);
                if (!sttKey) sttMissing = true;
            }
            setMissingKeys(missing);
            setAudioState({
                ttsProvider,
                ttsModel: ttsProvider === 'elevenlabs' ? 'Voice ID: ' + ttsModel.substring(0, 8) + '...' : ttsModel,
                ttsKeyMissing: ttsMissing,
                ttsMode: (localStorage.getItem('tts_provider_type') || 'browser') as 'browser' | 'api',
                sttProvider,
                sttModel,
                sttKeyMissing: sttMissing,
                sttMode: (localStorage.getItem('stt_provider_type') || 'browser') as 'browser' | 'api'
            });
        }
    }, []); // No dependencies - LLM_PROVIDERS is now a constant outside the component

    useEffect(() => {
        loadState();

        // Listen for storage events to update UI when settings change
        window.addEventListener('storage', loadState);

        // Also a custom event for inside-app updates if needed
        const interval = setInterval(loadState, 1000);

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('storage', loadState);
            clearInterval(interval);
        };
    }, [loadState]);

    const handleProviderSelect = (providerId: LLMProvider) => {
        setSelectedProvider(providerId);
        localStorage.setItem('user_llm_provider', providerId);

        // Also update the generic 'user_selected_model' to the specific model for this provider
        let specificModel = localStorage.getItem(`model_name_${providerId}`);
        if (!specificModel || specificModel.toLowerCase() === 'default') {
            specificModel = DEFAULT_MODELS[providerId] || DEFAULT_MODELS.openai;
        }
        localStorage.setItem('user_selected_model', specificModel);
        setProviderModelName(specificModel);

        setIsOpen(false);
    };

    const isKeyMissing = missingKeys.includes(selectedProvider);
    const isTtsBuiltIn = audioState.ttsMode === 'browser';
    const isSttBuiltIn = audioState.sttMode === 'browser';
    const builtInTooltip = '!Configured to Built-In, please update App Settings to AI mode.';

    return (
        <div className="flex items-center gap-2" ref={containerRef}>
            {/* Dropdown Trigger */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs font-medium ${isKeyMissing
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20'
                        : 'bg-muted/40 hover:bg-muted border-border text-foreground'
                        }`}
                >
                    <span className="opacity-70 hidden sm:inline">Provider:</span>
                    <span className="font-semibold capitalize">{LLM_PROVIDERS.find(p => p.id === selectedProvider)?.name}</span>
                    <span className="opacity-50 text-[10px] max-w-[80px] truncate hidden sm:inline-block">({providerModelName})</span>

                    {isKeyMissing && (
                        <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    )}

                    <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            className="absolute right-0 top-full mt-2 w-64 bg-popover rounded-xl border border-border shadow-xl z-50 overflow-hidden py-1"
                        >
                            <div className="flex border-b border-border bg-muted/20">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveTab('llm'); }}
                                    className={`flex-1 px-3 py-2 text-[10px] uppercase tracking-wider font-semibold transition-colors ${activeTab === 'llm' ? 'text-primary border-b-2 border-primary bg-background' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    LLM
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveTab('audio'); }}
                                    className={`flex-1 px-3 py-2 text-[10px] uppercase tracking-wider font-semibold transition-colors ${activeTab === 'audio' ? 'text-primary border-b-2 border-primary bg-background' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    Audio
                                </button>
                                <div className="px-3 py-2 flex items-center justify-end border-l border-border/50">
                                    {isLocalMode && (
                                        <button
                                            onClick={() => { setIsOpen(false); onOpenSettings(); }}
                                            className="text-primary hover:text-primary/80 flex items-center gap-1 text-[10px] font-medium transition-colors"
                                        >
                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                                            Configure
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto p-1 text-xs">
                                {activeTab === 'llm' ? (
                                    LLM_PROVIDERS.map((p) => {
                                        const isMissing = missingKeys.includes(p.id);
                                        const configuredModel = typeof window !== 'undefined'
                                            ? (localStorage.getItem(`model_name_${p.id}`) || DEFAULT_MODELS[p.id])
                                            : DEFAULT_MODELS[p.id];

                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => handleProviderSelect(p.id)}
                                                className={`w-full text-left px-2 py-2 rounded-lg transition-colors flex items-center justify-between group ${selectedProvider === p.id
                                                    ? 'bg-primary/10 text-primary font-medium'
                                                    : 'hover:bg-muted text-foreground'
                                                    }`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="flex items-center gap-1">
                                                        {p.name}
                                                        {isMissing && <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1 rounded ml-1">Key Missing</span>}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground opacity-70 truncate max-w-[180px]">
                                                        {configuredModel || DEFAULT_MODELS[p.id] || 'Default Model'}
                                                    </span>
                                                </div>
                                                {selectedProvider === p.id && (
                                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    /* Audio Tab Selection Lists */
                                    <div className="space-y-4 p-1">
                                        {/* TTS Selection */}
                                        <div className="space-y-1">
                                            <div className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                                                <span>Text-to-Speech (TTS)</span>
                                            </div>
                                            <div className="space-y-1">
                                                {['openai', 'elevenlabs'].map(pid => {
                                                    const isActive = audioState.ttsProvider === pid;
                                                    const keyMissing = pid === 'openai' ? (missingKeys.includes('openai') && !localStorage.getItem('key_openai_audio')) : !localStorage.getItem(`key_${pid}`);
                                                    const showKeyMissing = !isTtsBuiltIn && keyMissing;
                                                    const needsConfig = isTtsBuiltIn || showKeyMissing;
                                                    const configTooltip = showKeyMissing
                                                        ? 'Audio Output (TTS) is not configured'
                                                        : builtInTooltip;
                                                    const subtitle = typeof window !== 'undefined'
                                                        ? (pid === 'elevenlabs' ? (localStorage.getItem('voice_id_elevenlabs') || 'Default Voice') : (localStorage.getItem('model_name_tts') || 'tts-1'))
                                                        : '';

                                                    return (
                                                        <button
                                                            key={'tts-' + pid}
                                                            onClick={() => {
                                                                localStorage.setItem('active_provider_tts', pid);
                                                                if (containerRef.current) {
                                                                    const event = new Event('storage');
                                                                    window.dispatchEvent(event);
                                                                    setTimeout(loadState, 0);
                                                                }
                                                                setAudioState(prev => ({ ...prev, ttsProvider: pid }));
                                                            }}
                                                            title={needsConfig ? configTooltip : undefined}
                                                            className={`relative w-full text-left px-2 py-2 rounded-lg transition-colors flex items-center justify-between group border border-transparent ${showKeyMissing
                                                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/50'
                                                                : isActive
                                                                    ? 'bg-primary/10 text-primary font-medium'
                                                                    : 'hover:bg-muted text-foreground'
                                                                }`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="capitalize">{pid === 'openai' ? 'OpenAI' : pid === 'elevenlabs' ? 'ElevenLabs' : pid}</span>
                                                                    {showKeyMissing && (
                                                                        <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1 rounded">Key Missing</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-muted-foreground opacity-70 truncate max-w-[180px]">
                                                                    {subtitle}
                                                                </span>
                                                            </div>
                                                            {isActive && (
                                                                needsConfig ? (
                                                                    <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                        <circle cx="12" cy="12" r="9" />
                                                                        <line x1="12" y1="7" x2="12" y2="13" />
                                                                        <circle cx="12" cy="17" r="1" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                )
                                                            )}
                                                            {needsConfig && (
                                                                <div className="absolute right-3 top-0 translate-y-full px-2 py-1 bg-popover border border-border rounded-md text-[10px] text-popover-foreground shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal max-w-[220px] z-10">
                                                                    {configTooltip}
                                                                </div>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* STT Selection */}
                                        <div className="space-y-1">
                                            <div className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                                                <span>Speech-to-Text (STT)</span>
                                            </div>
                                            <div className="space-y-1">
                                                {['openai', 'deepgram'].map(pid => {
                                                    const isActive = audioState.sttProvider === pid;
                                                    const keyMissing = pid === 'openai' ? (missingKeys.includes('openai') && !localStorage.getItem('key_openai_audio')) : !localStorage.getItem(`key_${pid}`);
                                                    const showKeyMissing = !isSttBuiltIn && keyMissing;
                                                    const needsConfig = isSttBuiltIn || showKeyMissing;
                                                    const configTooltip = showKeyMissing
                                                        ? 'Voice Input (STT) is not configured'
                                                        : builtInTooltip;
                                                    const subtitle = typeof window !== 'undefined'
                                                        ? (pid === 'deepgram' ? (localStorage.getItem('model_name_deepgram') || 'nova-2') : (localStorage.getItem('model_name_stt') || 'whisper-1'))
                                                        : '';

                                                    return (
                                                        <button
                                                            key={'stt-' + pid}
                                                            onClick={() => {
                                                                localStorage.setItem('active_provider_stt', pid);
                                                                if (containerRef.current) {
                                                                    window.dispatchEvent(new Event('storage'));
                                                                    setTimeout(loadState, 0);
                                                                }
                                                                setAudioState(prev => ({ ...prev, sttProvider: pid }));
                                                            }}
                                                            title={needsConfig ? configTooltip : undefined}
                                                            className={`relative w-full text-left px-2 py-2 rounded-lg transition-colors flex items-center justify-between group border border-transparent ${showKeyMissing
                                                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/50'
                                                                : isActive
                                                                    ? 'bg-primary/10 text-primary font-medium'
                                                                    : 'hover:bg-muted text-foreground'
                                                                }`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="capitalize">{pid === 'openai' ? 'OpenAI' : pid === 'deepgram' ? 'Deepgram' : pid}</span>
                                                                    {showKeyMissing && (
                                                                        <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1 rounded">Key Missing</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-muted-foreground opacity-70 truncate max-w-[180px]">
                                                                    {subtitle}
                                                                </span>
                                                            </div>
                                                            {isActive && (
                                                                needsConfig ? (
                                                                    <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                        <circle cx="12" cy="12" r="9" />
                                                                        <line x1="12" y1="7" x2="12" y2="13" />
                                                                        <circle cx="12" cy="17" r="1" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                )
                                                            )}
                                                            {needsConfig && (
                                                                <div className="absolute right-3 top-0 translate-y-full px-2 py-1 bg-popover border border-border rounded-md text-[10px] text-popover-foreground shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal max-w-[220px] z-10">
                                                                    {configTooltip}
                                                                </div>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            {isKeyMissing && (
                                <div className="mx-2 mb-2 mt-1 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-600">
                                    API Key not set for <b>{LLM_PROVIDERS.find(p => p.id === selectedProvider)?.name}</b>.
                                    <br />Please click <button
                                        onClick={() => { setIsOpen(false); onOpenSettings(); }}
                                        className="font-semibold underline hover:text-amber-700 transition-colors"
                                    >Configure</button>.
                                </div>
                            )}

                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
