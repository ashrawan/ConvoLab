import { useState, useRef, useEffect } from 'react';

interface TextInputPanelProps {
    value: string;
    onChange: (text: string) => void;
    onSubmit: () => void;
    onAudioTranscript?: (text: string) => void; // Optional now
    buildMode: boolean;
    onBuildModeToggle: () => void;
    language: string;
    videoActive: boolean;
    onVideoToggle: () => void;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    // New props for external audio control
    audioActive: boolean;
    onToggleAudio: () => void;
    audioTranscript: string;
    lastSubmission?: { text: string; timestamp: number } | null;
    isAudioPlaying?: boolean;
    onPlayTTS?: (text: string) => void;
    onStopTTS?: () => void;
    // New props for translations
    languages?: string[];
    lastSentTranslations?: Record<string, string>;
    currentlyPlayingKey?: string | null;
    onPlayTranslationAudio?: (text: string, lang: string, key: string) => void;
    highlightedWordIndex?: number;
}

// Helper to render highlighted text preserving whitespace
const renderHighlightedText = (text: string, activeIndex: number) => {
    let wordCount = 0;
    return text.split(/(\s+)/).map((part, i) => {
        if (part.length > 0 && !part.match(/\s/)) {
            const isActive = wordCount === activeIndex;
            wordCount++;
            return <span key={i} className={isActive ? "bg-violet-500/50 text-white shadow-[0_0_10px_rgba(139,92,246,0.3)] rounded px-1 -mx-1 transition-all duration-150" : "text-gray-300/90 transition-colors duration-300"}>{part}</span>;
        }
        return <span key={i} className="whitespace-pre">{part}</span>;
    });
};

export default function TextInputPanel({
    value,
    onChange,
    onSubmit,
    buildMode,
    onBuildModeToggle,
    videoActive,
    onVideoToggle,
    videoRef,
    // Audio props
    audioActive,
    onToggleAudio,
    audioTranscript,
    lastSubmission,
    isAudioPlaying,
    onPlayTTS,
    onStopTTS,
    // Translation props
    languages = [],
    lastSentTranslations = {},
    currentlyPlayingKey,
    onPlayTranslationAudio,
    highlightedWordIndex
}: TextInputPanelProps) {
    const [showTranslations, setShowTranslations] = useState(true);
    const hasTranslations = Object.keys(lastSentTranslations).length > 0;

    return (
        <div className="flex-1 relative flex flex-col">
            {/* Last Sent Message - Above the text input */}
            {lastSubmission && (
                <div className={`border-b transition-colors duration-300 ${isAudioPlaying || (currentlyPlayingKey?.startsWith('translation-'))
                    ? 'bg-violet-500/10 border-violet-500/50'
                    : 'bg-white/5 border-white/5'
                    }`}>
                    {/* Main last sent row */}
                    <div className="px-4 py-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs uppercase tracking-wide font-medium ${isAudioPlaying ? 'text-violet-400' : 'text-gray-500'}`}>
                                    {isAudioPlaying ? 'Speaking...' : 'Last Sent'}
                                </span>
                                {isAudioPlaying && (
                                    <span className="flex gap-0.5 items-end h-3">
                                        <span className="w-0.5 h-1.5 bg-violet-400 animate-[pulse_0.6s_infinite]"></span>
                                        <span className="w-0.5 h-3 bg-violet-400 animate-[pulse_0.8s_infinite]"></span>
                                        <span className="w-0.5 h-2 bg-violet-400 animate-[pulse_0.7s_infinite]"></span>
                                    </span>
                                )}
                            </div>
                            <span className={`text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono shrink-0`}>
                                {(languages[0] || 'en').toUpperCase()}
                            </span>
                            <div className={`text-sm max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-medium custom-scrollbar ${isAudioPlaying ? 'text-violet-200' : 'text-gray-300'}`}>
                                {highlightedWordIndex !== undefined && highlightedWordIndex >= 0
                                    ? renderHighlightedText(lastSubmission.text, highlightedWordIndex)
                                    : lastSubmission.text}
                            </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            {/* Toggle translations button */}
                            {hasTranslations && (
                                <button
                                    onClick={() => setShowTranslations(!showTranslations)}
                                    className={`p-1.5 rounded-full transition-all ${showTranslations
                                        ? 'bg-violet-500/20 text-violet-400'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/10'
                                        }`}
                                    title={showTranslations ? "Hide translations" : "Show translations"}
                                >
                                    <svg className={`w-3.5 h-3.5 transition-transform ${showTranslations ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            )}

                            {/* Play/Stop Button for Last Message */}
                            {onPlayTTS && (
                                <button
                                    onClick={() => {
                                        if (isAudioPlaying && onStopTTS) {
                                            onStopTTS();
                                        } else {
                                            onPlayTTS(lastSubmission.text);
                                        }
                                    }}
                                    className={`p-1.5 rounded-full transition-all ${isAudioPlaying
                                        ? 'bg-violet-500 text-white hover:bg-violet-600 shadow-lg'
                                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                                        }`}
                                    title={isAudioPlaying ? "Stop" : "Play Again"}
                                >
                                    {isAudioPlaying ? (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                            <rect x="6" y="6" width="12" height="12" rx="2" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Translations section - collapsible */}
                    {showTranslations && hasTranslations && (
                        <div className="px-4 pb-2 max-h-24 overflow-y-auto custom-scrollbar border-t border-white/5">
                            <div className="space-y-1 pt-2">
                                {languages.slice(1).map(lang => {
                                    const text = lastSentTranslations[lang];
                                    if (!text) return null;
                                    const translationKey = `translation-${lang}`;
                                    const isPlayingThis = currentlyPlayingKey === translationKey;

                                    return (
                                        <div key={lang} className={`flex items-center gap-2 py-1 px-2 rounded transition-all ${isPlayingThis ? 'bg-violet-500/10' : 'hover:bg-white/5'}`}>
                                            <span className={`text-xs px-1.5 py-0.5 rounded font-mono shrink-0 ${isPlayingThis ? 'bg-violet-500/20 text-violet-300' : 'bg-white/10 text-gray-400'}`}>
                                                {lang.toUpperCase()}
                                            </span>
                                            {isPlayingThis && (
                                                <span className="flex gap-0.5 items-end h-2.5 shrink-0">
                                                    <span className="w-0.5 h-1 bg-violet-400 animate-[pulse_0.6s_infinite]"></span>
                                                    <span className="w-0.5 h-2.5 bg-violet-400 animate-[pulse_0.8s_infinite]"></span>
                                                    <span className="w-0.5 h-1.5 bg-violet-400 animate-[pulse_0.7s_infinite]"></span>
                                                </span>
                                            )}
                                            <span className={`text-xs truncate flex-1 ${isPlayingThis ? 'text-violet-200' : 'text-gray-400'}`}>
                                                {text}
                                            </span>
                                            {onPlayTranslationAudio && (
                                                <button
                                                    onClick={() => {
                                                        if (isPlayingThis && onStopTTS) {
                                                            onStopTTS();
                                                        } else {
                                                            onPlayTranslationAudio(text, lang, translationKey);
                                                        }
                                                    }}
                                                    className={`p-1 rounded-full transition-all shrink-0 ${isPlayingThis
                                                        ? 'bg-violet-500 text-white'
                                                        : 'text-gray-500 hover:text-white hover:bg-white/10'
                                                        }`}
                                                    title={isPlayingThis ? "Stop" : `Play ${lang}`}
                                                >
                                                    {isPlayingThis ? (
                                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                                                            <rect x="6" y="6" width="12" height="12" rx="2" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M8 5v14l11-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 relative">
                {/* Instant Mode Toggle - Moved here */}
                <div className="absolute top-4 right-4 z-10">
                    <button
                        onClick={onBuildModeToggle}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition shadow-lg ${!buildMode
                            ? 'bg-violet-500 text-white'
                            : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                            }`}
                        title={buildMode ? "Instant mode: OFF - Build then submit" : "Instant mode: ON - Auto-process"}
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                        </svg>
                    </button>
                </div>

                {/* Highlight Overlay */}
                {highlightedWordIndex !== undefined && highlightedWordIndex >= 0 && (
                    <div className="absolute inset-0 p-6 pb-16 text-2xl leading-relaxed pointer-events-none break-words font-sans z-10" aria-hidden="true">
                        {renderHighlightedText(value, highlightedWordIndex)}
                    </div>
                )}

                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (value.trim()) onSubmit();
                        }
                    }}
                    placeholder={highlightedWordIndex && highlightedWordIndex >= 0 ? "" : "Type your message here..."}
                    className={`w-full h-full bg-transparent text-2xl placeholder:text-gray-600 focus:outline-none resize-none leading-relaxed p-6 pb-16 ${highlightedWordIndex !== undefined && highlightedWordIndex >= 0 ? 'text-transparent caret-transparent selection:bg-transparent selection:text-transparent' : ''}`}
                />

                {/* Controls (bottom) */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    {/* Listening indicator - Left side */}
                    {audioActive ? (
                        <div className="flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-lg px-3 py-1.5">
                            <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></span>
                            <p className="text-violet-300 text-xs font-medium">{audioTranscript || 'Listening...'}</p>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-600">{value.length}/500</div>
                    )}

                    {/* Right side controls */}
                    <div className="flex items-center gap-2">
                        {/* Submit Button */}
                        {value && (
                            <button
                                onClick={onSubmit}
                                className="w-10 h-10 rounded-full bg-violet-500 hover:bg-violet-600 text-white flex items-center justify-center transition shadow-lg"
                                title="Submit (Enter)"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                </svg>
                            </button>
                        )}

                        {/* Audio Button */}
                        <button
                            onClick={onToggleAudio}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition ${audioActive
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                                }`}
                            title={audioActive ? 'Stop listening' : 'Voice input'}
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                            </svg>
                        </button>

                    </div>
                </div>
            </div>
        </div>
    );
}
