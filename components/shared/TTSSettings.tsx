'use client';

import React, { useState, useEffect } from 'react';
import { ttsService, TTSProviderType, sttService, STTProviderType } from '@/lib/services/audio';
import { checkApiHealth, HealthStatus, HealthCheckResult } from '@/lib/utils/health-check';

interface TTSSettingsProps {
    className?: string;
    pauseMicOnAudio?: boolean;
    onPauseMicChange?: (value: boolean) => void;
    autoPlay?: boolean;
    onAutoPlayChange?: (value: boolean) => void;
    readingSpeed?: number;
    onReadingSpeedChange?: (value: number) => void;
    showTypingEffect?: boolean;
    onShowTypingEffectChange?: (value: boolean) => void;
}

export function TTSSettings({
    className = '',
    pauseMicOnAudio = true,
    onPauseMicChange,
    autoPlay = true,
    onAutoPlayChange,
    readingSpeed = 180,
    onReadingSpeedChange,
    showTypingEffect = true,
    onShowTypingEffectChange
}: TTSSettingsProps) {
    const [ttsProvider, setTTSProvider] = useState<TTSProviderType>('browser');
    const [sttProvider, setSTTProvider] = useState<STTProviderType>('browser');
    const [isOpen, setIsOpen] = useState(false);
    const [health, setHealth] = useState<HealthCheckResult>({ status: 'loading' });

    useEffect(() => {
        // Init health check
        const performHealthCheck = async () => {
            const result = await checkApiHealth();
            setHealth(result);
        };

        performHealthCheck();

        // Check every 30 seconds
        const interval = setInterval(performHealthCheck, 30000);

        // Init state
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
            clearInterval(interval);
        };
    }, []);

    const handleTTSProviderChange = (newProvider: TTSProviderType) => {
        ttsService.setProvider(newProvider);
    };

    const handleSTTProviderChange = (newProvider: STTProviderType) => {
        sttService.setProvider(newProvider);
    };

    const getHealthColor = () => {
        switch (health.status) {
            case 'healthy': return 'bg-emerald-500';
            case 'degraded': return 'bg-amber-500';
            case 'ngrok-interposer': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse';
            case 'error': return 'bg-red-500';
            case 'loading': return 'bg-gray-500';
            default: return 'bg-gray-500';
        }
    };

    const handleHealthClick = () => {
        if (health.status === 'ngrok-interposer' && health.url) {
            window.open(health.url, '_blank');
        }
    };

    return (
        <div className={`relative ${className}`}>
            <div className="flex items-center gap-2">
                {/* API Status Indicator */}
                <div
                    className={`w-2 h-2 rounded-full cursor-help transition-all duration-300 ${getHealthColor()}`}
                    title={health.message || (health.status === 'healthy' ? 'API Connected' : 'Checking API status...')}
                    onClick={handleHealthClick}
                />

                {/* Settings Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2 rounded-full transition-all duration-200 ${isOpen
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    title="Settings"
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
                    {/* Backdrop for outside click */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Panel */}
                    <div className="absolute right-0 top-full mt-3 w-80 bg-[#1a1a1c]/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden backdrop-blur-2xl ring-1 ring-white/5 origin-top-right transition-all">
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.03]">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">System Settings</span>
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                            </div>
                        </div>

                        <div className="p-4 space-y-5">
                            {/* API Health Alert if not healthy */}
                            {health.status !== 'healthy' && health.status !== 'loading' && (
                                <div
                                    className={`p-3 rounded-xl text-[11px] flex items-start gap-3 border transition-colors ${health.status === 'ngrok-interposer'
                                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                        }`}
                                >
                                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="flex-1">
                                        <p className="font-bold uppercase tracking-tight mb-0.5">
                                            {health.status === 'ngrok-interposer' ? 'Ngrok Action Required' : 'API Connection Issue'}
                                        </p>
                                        <p className="opacity-90 leading-relaxed mb-1.5">
                                            {health.status === 'ngrok-interposer'
                                                ? 'You must visit the ngrok URL and click "Visit Site" to authorize the API connection.'
                                                : health.message || 'Unable to reach the backend service.'}
                                        </p>
                                        {health.status === 'ngrok-interposer' && health.url && (
                                            <button
                                                onClick={() => window.open(health.url, '_blank')}
                                                className="w-full px-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-red-300 font-medium transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <span>Authorize Now</span>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Voice Input Section (STT) - Grouped */}
                            <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                                            Voice Input
                                        </span>
                                    </div>
                                </div>

                                <div className="flex bg-black/30 rounded-lg p-1 gap-1">
                                    <button
                                        onClick={() => handleSTTProviderChange('browser')}
                                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${sttProvider === 'browser'
                                            ? 'bg-white/10 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        Offline
                                    </button>
                                    <button
                                        onClick={() => handleSTTProviderChange('api')}
                                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${sttProvider === 'api'
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        API
                                    </button>
                                </div>
                            </div>

                            {/* Audio Output Section (TTS) - Grouped */}
                            <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                        </svg>
                                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                                            Audio Output
                                        </span>
                                    </div>
                                </div>

                                {/* TTS Provider */}
                                <div className="flex bg-black/30 rounded-lg p-1 gap-1">
                                    <button
                                        onClick={() => handleTTSProviderChange('browser')}
                                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${ttsProvider === 'browser'
                                            ? 'bg-white/10 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        Offline
                                    </button>
                                    <button
                                        onClick={() => handleTTSProviderChange('api')}
                                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${ttsProvider === 'api'
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        API
                                    </button>
                                </div>

                                {/* Auto-Audio (was Auto Play) */}
                                <div className="px-1 flex items-center justify-between">
                                    <div>
                                        <span className="text-sm text-gray-300 block">Auto-Audio</span>
                                        <span className="text-[10px] text-gray-500">Play audio on submit</span>
                                    </div>
                                    <button
                                        onClick={() => onAutoPlayChange && onAutoPlayChange(!autoPlay)}
                                        className={`w-8 h-4 rounded-full transition-colors relative focus:outline-none ${autoPlay ? 'bg-emerald-500' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${autoPlay ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Auto-pause Mic */}
                                <div className="px-1 flex items-center justify-between">
                                    <div>
                                        <span className="text-sm text-gray-300 block">Auto-pause Mic</span>
                                        <span className="text-[10px] text-gray-500">Pause mic while audio is playing</span>
                                    </div>
                                    <button
                                        onClick={() => onPauseMicChange && onPauseMicChange(!pauseMicOnAudio)}
                                        className={`w-8 h-4 rounded-full transition-colors relative focus:outline-none ${pauseMicOnAudio ? 'bg-emerald-500' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${pauseMicOnAudio ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Text Section (Type Effect) */}
                            {/* <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5 space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                    </svg>
                                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                                        Text
                                    </span>
                                </div>

                            </div> */}

                            {/* AI Auto-Play Section (Reading Speed) */}
                            <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5 space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                                        AI Auto-Play
                                    </span>
                                </div>

                                <div className="px-1 pt-2 flex items-center justify-between">
                                    <div>
                                        <span className="text-sm text-gray-300 block">AI Type Effect</span>
                                        <span className="text-[10px] text-gray-500">Simulate typing</span>
                                    </div>
                                    <button
                                        onClick={() => onShowTypingEffectChange && onShowTypingEffectChange(!showTypingEffect)}
                                        className={`w-8 h-4 rounded-full transition-colors relative focus:outline-none ${showTypingEffect ? 'bg-violet-500' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showTypingEffect ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="px-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-gray-300">Reading Speed</span>
                                        <span className="text-[10px] text-gray-500">{readingSpeed} WPM</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="100"
                                        max="400"
                                        step="20"
                                        value={readingSpeed}
                                        onChange={(e) => onReadingSpeedChange && onReadingSpeedChange(parseInt(e.target.value))}
                                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500"
                                    />
                                </div>

                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
