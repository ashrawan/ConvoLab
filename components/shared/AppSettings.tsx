'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ttsService, TTSProviderType, sttService, STTProviderType } from '@/lib/services/audio';
import { checkApiHealth, HealthCheckResult } from '@/lib/utils/health-check';
import { useTheme } from '@/components/theme-provider';

interface AppSettingsProps {
    pauseMicOnAudio: boolean;
    onPauseMicChange: (val: boolean) => void;
    playbackMode: 'audio' | 'highlight' | 'manual';
    onPlaybackModeChange: (mode: 'audio' | 'highlight' | 'manual') => void;
    readingSpeed: number;
    onReadingSpeedChange: (speed: number) => void;
    delayMultiplier: number;
    onDelayMultiplierChange: (multiplier: number) => void;
    showTypingEffect: boolean;
    onShowTypingEffectChange: (show: boolean) => void;
    className?: string;
}

export function AppSettings({
    className = '',
    pauseMicOnAudio,
    onPauseMicChange,
    playbackMode,
    onPlaybackModeChange,
    readingSpeed,
    onReadingSpeedChange,
    delayMultiplier,
    onDelayMultiplierChange,
    showTypingEffect,
    onShowTypingEffectChange
}: AppSettingsProps) {
    const [ttsProvider, setTTSProvider] = useState<TTSProviderType>(() => ttsService.getProviderType());
    const [sttProvider, setSTTProvider] = useState<STTProviderType>(() => sttService.getProviderType());
    const [isOpen, setIsOpen] = useState(false);
    const [health, setHealth] = useState<HealthCheckResult>({ status: 'loading' });
    const { theme, setTheme } = useTheme();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Default to Offline mode (true) to prefer simpler experience unless user goes Online
    const [isOfflineMode, setIsOfflineMode] = useState(true);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        // Safe check for window
        if (typeof window !== 'undefined') {
            const storedMode = localStorage.getItem('app_mode_offline');
            if (storedMode) {
                setIsOfflineMode(storedMode === 'true');
            }
        }
    }, []);

    const toggleOfflineMode = (offline: boolean) => {
        setIsOfflineMode(offline);
        localStorage.setItem('app_mode_offline', String(offline));

        // When switching to Offline, force built-in audio providers
        if (offline) {
            handleTTSProviderChange('browser');
            handleSTTProviderChange('browser');
        } else {
            // If switching to online, trigger health check immediately
            checkApiHealth().then(setHealth);
        }
    };

    useEffect(() => {
        // Sync state with services immediately on mount
        setTTSProvider(ttsService.getProviderType());
        setSTTProvider(sttService.getProviderType());

        // Listen for changes
        const unsubTTS = ttsService.onProviderChange((newType) => {
            setTTSProvider(newType);
        });
        const unsubSTT = sttService.onProviderChange((newType) => {
            setSTTProvider(newType);
        });

        return () => {
            unsubTTS();
            unsubSTT();
        };
    }, []);

    // Health Check Logic - Only if Online
    useEffect(() => {
        if (isOfflineMode) return;

        // Init health check
        const performHealthCheck = async () => {
            const result = await checkApiHealth();
            setHealth(result);
        };

        performHealthCheck();

        // Check every 30 seconds
        const interval = setInterval(performHealthCheck, 30000);

        return () => {
            clearInterval(interval);
        };
    }, [isOfflineMode]);

    const [sttKeyMissing, setSttKeyMissing] = useState(false);
    const [ttsKeyMissing, setTtsKeyMissing] = useState(false);

    const checkAudioKeys = () => {
        if (typeof window === 'undefined') return;

        // STT Check
        if (sttProvider === 'api' && isOfflineMode) {
            const activeSTT = localStorage.getItem('active_provider_stt') || 'openai';
            const key = localStorage.getItem(`key_${activeSTT}`) || (activeSTT === 'openai' ? (localStorage.getItem('key_openai_audio') || localStorage.getItem('user_openai_api_key')) : null);
            setSttKeyMissing(!key);
        } else {
            setSttKeyMissing(false);
        }

        // TTS Check
        if (ttsProvider === 'api' && isOfflineMode) {
            const activeTTS = localStorage.getItem('active_provider_tts') || 'openai';
            const key = localStorage.getItem(`key_${activeTTS}`) || (activeTTS === 'openai' ? (localStorage.getItem('key_openai_audio') || localStorage.getItem('user_openai_api_key')) : null);
            setTtsKeyMissing(!key);
        } else {
            setTtsKeyMissing(false);
        }
    };

    useEffect(() => {
        checkAudioKeys();
        // Poll for external changes (config modal)
        const interval = setInterval(checkAudioKeys, 2000);
        return () => clearInterval(interval);
    }, [sttProvider, ttsProvider, isOfflineMode]);

    // If offline mode is enabled, keep audio providers on built-in
    useEffect(() => {
        if (!isOfflineMode) return;
        if (ttsProvider === 'api') {
            handleTTSProviderChange('browser');
        }
        if (sttProvider === 'api') {
            handleSTTProviderChange('browser');
        }
    }, [isOfflineMode, ttsProvider, sttProvider]);

    const handleTTSProviderChange = (newProvider: TTSProviderType) => {
        setTTSProvider(newProvider);
        ttsService.setProvider(newProvider);
        // State update is async, check will happen in effect
    };

    const handleSTTProviderChange = (newProvider: STTProviderType) => {
        setSTTProvider(newProvider);
        sttService.setProvider(newProvider);
    };

    const getHealthColor = () => {
        if (isOfflineMode) return 'hidden';
        switch (health.status) {
            case 'healthy': return 'bg-green-500';
            case 'degraded': return 'bg-amber-500';
            case 'ngrok-interposer': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse';
            case 'error': return 'bg-red-500';
            case 'loading': return 'bg-muted-foreground';
            default: return 'bg-muted-foreground';
        }
    };

    const handleHealthClick = () => {
        if (health.status === 'ngrok-interposer' && health.url) {
            window.open(health.url, '_blank');
        }
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div className="flex items-center gap-2">
                {/* API Status Indicator - Only if Online */}
                {!isOfflineMode && (
                    <div className="relative group/status">
                        <div
                            className={`w-2 h-2 rounded-full transition-all duration-300 cursor-pointer ${getHealthColor()}`}
                            onClick={handleHealthClick}
                        />
                        {/* Instant Custom Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border border-border rounded-md text-[10px] text-popover-foreground font-medium opacity-0 group-hover/status:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
                            {health.status === 'healthy' ? 'Cloud Connected' : (health.message || 'Checking API...')}
                        </div>
                    </div>
                )}

                {/* Settings Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2 rounded-full transition-all duration-200 ${isOpen
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                    title="App Settings"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>

            {/* Settings Dropdown */}
            {isOpen && (
                <>

                    {/* Dropdown Panel */}
                    <div className="absolute right-0 top-full mt-3 w-80 bg-popover border border-border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden ring-1 ring-border origin-top-right transition-all">
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">App Settings</span>
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-border" />
                                <span className="w-1.5 h-1.5 rounded-full bg-border" />
                            </div>
                        </div>

                        <div className="p-4 space-y-5">

                            {/* Operation Mode Toggle */}
                            <div className="bg-muted/10 rounded-lg p-3 border border-border">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <svg className={`w-4 h-4 ${isOfflineMode ? 'text-green-500' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Operation Mode
                                        </span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOfflineMode ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                        {isOfflineMode ? 'LOCAL' : 'CLOUD'}
                                    </span>
                                </div>

                                <div className="flex bg-muted rounded-lg p-1 gap-1">
                                    <button
                                        onClick={() => toggleOfflineMode(true)}
                                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${isOfflineMode
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                            }`}
                                    >
                                        Local
                                    </button>
                                    <div className="flex-1 relative group/cloud">
                                        <button
                                            onClick={() => {
                                                if (process.env.NEXT_PUBLIC_ENABLE_CLOUD === 'true') {
                                                    toggleOfflineMode(false);
                                                }
                                            }}
                                            disabled={process.env.NEXT_PUBLIC_ENABLE_CLOUD !== 'true'}
                                            className={`w-full h-full px-3 py-1.5 text-xs font-medium rounded-md transition-all ${!isOfflineMode
                                                ? 'bg-background text-foreground shadow-sm'
                                                : 'text-muted-foreground'
                                                } ${process.env.NEXT_PUBLIC_ENABLE_CLOUD !== 'true' ? 'opacity-50 cursor-not-allowed' : 'hover:text-foreground hover:bg-background/50'}`}
                                        >
                                            Cloud
                                        </button>
                                    </div>
                                </div>
                                {process.env.NEXT_PUBLIC_ENABLE_CLOUD !== 'true' && (
                                    <div className="mt-2 text-[10px] text-muted-foreground leading-tight px-1">
                                        <span className="font-semibold text-primary/80">Coming Soon:</span> Cloud mode with Social Login, Sync, and Subscriptions.
                                    </div>
                                )}
                            </div>

                            {/* API Health Alert - Only if Online and Error */}
                            {!isOfflineMode && health.status !== 'healthy' && health.status !== 'loading' && (
                                <div
                                    className={`p-3 rounded-xl text-[11px] flex items-start gap-3 border transition-colors ${health.status === 'ngrok-interposer'
                                        ? 'bg-destructive/10 border-destructive/20 text-destructive'
                                        : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                        }`}
                                >
                                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="flex-1">
                                        <p className="font-bold uppercase tracking-tight mb-0.5">
                                            {health.status === 'ngrok-interposer' ? 'Ngrok Action Required' : 'Connection Issue - App Backend is Down'}
                                        </p>
                                        <p className="opacity-90 leading-relaxed mb-1.5">
                                            {health.status === 'ngrok-interposer'
                                                ? 'You must visit the ngrok URL and click "Visit Site" to authorize the API connection.'
                                                : health.message || 'Unable to reach the backend service.'}
                                        </p>
                                        {health.status === 'ngrok-interposer' && health.url && (
                                            <button
                                                onClick={() => window.open(health.url, '_blank')}
                                                className="w-full px-2 py-1.5 bg-destructive/20 hover:bg-destructive/30 border border-destructive/30 rounded text-destructive font-medium transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <span>Authorize Now</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Voice Input Section (STT) - Grouped */}
                            <div className="bg-muted/10 rounded-lg p-3 border border-border">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Voice Input (STT)
                                        </span>
                                    </div>
                                </div>

                                <div className="flex bg-muted rounded-lg p-1 gap-1">
                                    <button
                                        onClick={() => handleSTTProviderChange('browser')}
                                        className={`relative group flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${sttProvider === 'browser'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                            }`}
                                    >
                                        Built-In
                                    </button>
                                    <button
                                        onClick={() => handleSTTProviderChange('api')}
                                        title={sttKeyMissing && sttProvider === 'api' ? "Voice Input (STT) is not configured" : undefined}
                                        className={`relative group flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${sttProvider === 'api'
                                            ? (sttKeyMissing
                                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/50 shadow-sm'
                                                : 'bg-blue-500/20 text-blue-500 border border-blue-500/30 shadow-sm')
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                            }`}
                                    >
                                        AI
                                        {sttKeyMissing && sttProvider === 'api' && (
                                            <>
                                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                                </span>
                                                {/* Tooltip on Hover */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-popover border border-border rounded-md text-[10px] text-popover-foreground font-medium shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                    Voice Input (STT) is not configured
                                                </div>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Audio Output Section (TTS) - Grouped */}
                            <div className="bg-muted/10 rounded-lg p-3 border border-border space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                        </svg>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Audio Output (TTS)
                                        </span>
                                    </div>
                                </div>

                                {/* TTS Provider */}
                                <div className="flex bg-muted rounded-lg p-1 gap-1">
                                    <button
                                        onClick={() => handleTTSProviderChange('browser')}
                                        className={`relative group flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${ttsProvider === 'browser'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                            }`}
                                    >
                                        Built-In
                                    </button>
                                    <button
                                        onClick={() => handleTTSProviderChange('api')}
                                        title={ttsKeyMissing && ttsProvider === 'api' ? "Audio Output (TTS) is not configured" : undefined}
                                        className={`relative group flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${ttsProvider === 'api'
                                            ? (ttsKeyMissing
                                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/50 shadow-sm'
                                                : 'bg-blue-500/20 text-blue-500 border border-blue-500/30 shadow-sm')
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                            }`}
                                    >
                                        AI
                                        {ttsKeyMissing && ttsProvider === 'api' && (
                                            <>
                                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                                </span>
                                                {/* Tooltip on Hover */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-popover border border-border rounded-md text-[10px] text-popover-foreground font-medium shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                    Audio Output (TTS) is not configured
                                                </div>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Auto-pause Mic */}
                                <div className="px-1 flex items-center justify-between">
                                    <div>
                                        <span className="text-sm text-foreground block">Auto-pause Mic</span>
                                        <span className="text-[10px] text-muted-foreground">Pause mic while audio is playing</span>
                                    </div>
                                    <button
                                        onClick={() => onPauseMicChange && onPauseMicChange(!pauseMicOnAudio)}
                                        className={`w-8 h-4 rounded-full transition-colors relative focus:outline-none ${pauseMicOnAudio ? 'bg-blue-500' : 'bg-muted'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${pauseMicOnAudio ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* AI Auto-Play Section (Reading Speed) */}
                            <div className="bg-muted/10 rounded-lg p-3 border border-border space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Playback Mode
                                    </span>
                                </div>

                                <div className="flex bg-muted rounded-lg p-1 gap-1">
                                    {(['audio', 'highlight', 'manual'] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => onPlaybackModeChange(mode)}
                                            className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all capitalize ${playbackMode === mode
                                                ? 'bg-background shadow-sm text-primary'
                                                : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                        >
                                            {mode === 'audio' ? 'Auto Audio' : mode === 'highlight' ? 'Auto Highlight' : 'Manual (audio)'}
                                        </button>
                                    ))}
                                </div>

                                {/* Speed Settings - Only for Highlight mode */}
                                {playbackMode === 'highlight' && (
                                    <div className="px-1">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm text-foreground">Highlight Speed</span>
                                            <span className="text-[10px] text-muted-foreground">{readingSpeed} WPM</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="100"
                                            max="600"
                                            step="10"
                                            value={readingSpeed}
                                            onChange={(e) => onReadingSpeedChange(parseInt(e.target.value))}
                                            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                    </div>
                                )}

                                <div className="px-1 pt-2 flex items-center justify-between">
                                    <div>
                                        <span className="text-sm text-foreground block">AI Type Effect</span>
                                        <span className="text-[10px] text-muted-foreground">Simulate typing</span>
                                    </div>
                                    <button
                                        onClick={() => onShowTypingEffectChange && onShowTypingEffectChange(!showTypingEffect)}
                                        className={`w-8 h-4 rounded-full transition-colors relative focus:outline-none ${showTypingEffect ? 'bg-violet-500' : 'bg-muted'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showTypingEffect ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
