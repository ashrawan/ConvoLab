import { useState, useRef, useEffect } from 'react';
import { sendEvent } from '@/lib/analytics';

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
    onResendLastSubmission?: (text: string) => void;
    isAudioPlaying?: boolean;
    onPlayTTS?: (text: string) => void;
    onStopTTS?: () => void;
    // Translations
    languages?: string[];
    lastSentTranslations?: Record<string, string>;
    currentlyPlayingKey?: string | null;
    onPlayTranslationAudio?: (text: string, lang: string, key: string) => void;
    highlightedWordIndex?: number;
    customStatus?: string | null;
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
        // Use whitespace-pre-wrap to allow wrapping while preserving sequence
        return <span key={i} className="whitespace-pre-wrap">{part}</span>;
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
    onResendLastSubmission,
    isAudioPlaying,
    onPlayTTS,
    onStopTTS,
    // Translation props
    languages = [],
    lastSentTranslations = {},
    currentlyPlayingKey,
    onPlayTranslationAudio,
    highlightedWordIndex,
    customStatus
}: TextInputPanelProps) {
    const [showTranslations, setShowTranslations] = useState(true);
    const hasTranslations = Object.keys(lastSentTranslations).length > 0;
    // Only show reading state if highlighting the main message (not a translation)
    const isReadingMain = highlightedWordIndex !== undefined && highlightedWordIndex >= 0 && currentlyPlayingKey === 'lastSent';
    const showActiveState = isAudioPlaying || isReadingMain || (!!customStatus && currentlyPlayingKey === 'lastSent');


    return (
        <div className="flex-1 relative flex flex-col">
            {/* Last Sent Message - Above the text input */}
            {/* Last Sent Message - Above the text input */}
            {lastSubmission && (
                <div className="border-b border-border bg-muted/5">
                    <div className="p-2">
                        <div className={`py-1 px-2 rounded-lg transition-all ${showActiveState
                            ? 'bg-primary/10 border border-primary/20 flex flex-col gap-1.5'
                            : 'hover:bg-muted border border-transparent flex items-center gap-2'
                            }`}>

                            {/* Header Layout when playing (Badge + Status + Button) */}
                            <div className={`flex items-center ${showActiveState ? 'justify-between w-full' : 'gap-2 shrink-0'}`}>
                                <div className={`flex items-center ${showActiveState ? 'gap-2' : ''}`}>
                                    {/* SENT Badge */}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono min-w-[32px] text-center transition-all shrink-0 ${showActiveState
                                        ? 'bg-primary/20 text-primary ring-1 ring-primary/50'
                                        : 'bg-muted text-muted-foreground'
                                        }`}>
                                        SENT
                                    </span>
                                    {onResendLastSubmission && lastSubmission && (
                                        <button
                                            onClick={() => {
                                                onResendLastSubmission(lastSubmission.text);
                                                sendEvent({
                                                    action: 'message_resent',
                                                    params: {
                                                        char_count: lastSubmission.text.length,
                                                        language: (languages[0] || 'en'),
                                                        type: 'text'
                                                    }
                                                });
                                            }}
                                            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 transition-all"
                                            title="Resend"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64L21 8V3h-5l2.29 2.29A7 7 0 1 0 19 12h-2a5 5 0 1 1-5-5c1.3 0 2.5.5 3.4 1.3L13 11h8V3l-2.2 2.2A9 9 0 0 0 12 3a9 9 0 0 0-9 9h0z" />
                                            </svg>
                                        </button>
                                    )}

                                    {/* Speaking Indicator (Only visible here when playing) */}
                                    {showActiveState && (
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] uppercase tracking-wider font-bold ${customStatus ? 'text-amber-500' :
                                                isReadingMain ? 'text-blue-700 dark:text-blue-400' :
                                                    'text-violet-700 dark:text-violet-400'
                                                }`}>
                                                {customStatus || (isReadingMain ? 'READING...' : 'SPEAKING...')}
                                            </span>
                                            <span className="flex gap-0.5 items-end h-2">
                                                <span className={`w-0.5 h-1 animate-[pulse_0.6s_infinite] ${customStatus ? 'bg-amber-500' : isReadingMain ? 'bg-blue-600 dark:bg-blue-400' : 'bg-violet-600 dark:bg-violet-400'}`}></span>
                                                <span className={`w-0.5 h-2 animate-[pulse_0.8s_infinite] ${customStatus ? 'bg-amber-500' : isReadingMain ? 'bg-blue-600 dark:bg-blue-400' : 'bg-violet-600 dark:bg-violet-400'}`}></span>
                                                <span className={`w-0.5 h-1.5 animate-[pulse_0.7s_infinite] ${customStatus ? 'bg-amber-500' : isReadingMain ? 'bg-blue-600 dark:bg-blue-400' : 'bg-violet-600 dark:bg-violet-400'}`}></span>
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Stop Button (Only visible here when playing) */}
                                {showActiveState && (
                                    <div className="flex items-center gap-1">
                                        {hasTranslations && (
                                            <button
                                                onClick={() => setShowTranslations(!showTranslations)}
                                                className={`p-1 rounded-full transition-all ${showTranslations ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                                title={showTranslations ? "Hide translations" : "Show translations"}
                                            >
                                                <svg className={`w-3.5 h-3.5 transition-transform ${showTranslations ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        )}
                                        {onStopTTS && (
                                            <button
                                                onClick={onStopTTS}
                                                className="p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shrink-0 transition-all"
                                                title="Stop"
                                            >
                                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Text Content - Only highlight if this item is being played */}
                            <div className={`text-sm transition-all min-w-0 ${showActiveState
                                ? 'text-violet-700 dark:text-violet-400 font-medium whitespace-pre-wrap pl-1'
                                : 'flex-1 text-muted-foreground truncate'
                                }`}>
                                {currentlyPlayingKey === 'lastSent' && highlightedWordIndex !== undefined && highlightedWordIndex >= 0
                                    ? renderHighlightedText(lastSubmission.text, highlightedWordIndex)
                                    : lastSubmission.text}
                            </div>

                            {/* Play Button & Toggle (Only visible here when NOT playing) */}
                            {!showActiveState && (
                                <div className="flex items-center gap-1 shrink-0">
                                    {hasTranslations && (
                                        <button
                                            onClick={() => setShowTranslations(!showTranslations)}
                                            className={`p-1 rounded-full transition-all ${showTranslations ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                            title={showTranslations ? "Hide translations" : "Show translations"}
                                        >
                                            <svg className={`w-3.5 h-3.5 transition-transform ${showTranslations ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    )}
                                    {onPlayTTS && (
                                        <button
                                            onClick={() => onPlayTTS(lastSubmission.text)}
                                            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 transition-all"
                                            title="Play Again"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Translations section - collapsible */}
                        {showTranslations && hasTranslations && (
                            <div className="px-4 pb-2 max-h-24 overflow-y-auto custom-scrollbar border-t border-border">
                                <div className="space-y-1 pt-2">
                                    {languages.slice(1).map(lang => {
                                        const text = lastSentTranslations[lang];
                                        if (!text) return null;
                                        // Use 'sent-translation-' prefix to differentiate from input translations
                                        const translationKey = `sent-translation-${lang}`;
                                        const isPlayingThis = currentlyPlayingKey === translationKey;

                                        return (
                                            <div key={lang} className={`py-1 px-2 rounded-lg transition-all ${isPlayingThis ? 'bg-primary/10 border border-primary/20 flex flex-col gap-1.5' : 'hover:bg-muted border border-transparent flex items-center gap-2'}`}>

                                                {/* Header Layout (Badge + Status + Button) */}
                                                <div className={`flex items-center ${isPlayingThis ? 'justify-between w-full' : 'gap-2 shrink-0'}`}>
                                                    <div className={`flex items-center ${isPlayingThis ? 'gap-2' : ''}`}>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono min-w-[32px] text-center transition-all shrink-0 ${isPlayingThis ? 'bg-primary/20 text-primary ring-1 ring-primary/50' : 'bg-muted text-muted-foreground'}`}>
                                                            {lang.toUpperCase()}
                                                        </span>
                                                        {isPlayingThis && (
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${customStatus ? 'text-amber-500' : 'text-primary'}`}>
                                                                    {customStatus || ((highlightedWordIndex !== undefined && highlightedWordIndex >= 0) ? 'READING...' : 'SPEAKING...')}
                                                                </span>
                                                                {/* Audio Wave Animation */}
                                                                <span className="flex gap-0.5 items-end h-2.5 mx-1">
                                                                    <span className="w-0.5 h-1.5 bg-primary animate-[pulse_0.6s_infinite]"></span>
                                                                    <span className="w-0.5 h-3 bg-primary animate-[pulse_0.8s_infinite]"></span>
                                                                    <span className="w-0.5 h-2 bg-primary animate-[pulse_0.7s_infinite]"></span>
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Stop Button when playing */}
                                                    {isPlayingThis && onStopTTS && (
                                                        <button
                                                            onClick={onStopTTS}
                                                            className="p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shrink-0 transition-all"
                                                            title="Stop"
                                                        >
                                                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                                                                <rect x="6" y="6" width="12" height="12" rx="2" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Text Content */}
                                                <div className={`text-sm transition-all min-w-0 ${isPlayingThis ? 'text-primary font-medium pl-1' : 'flex-1 text-muted-foreground truncate'}`}>
                                                    <span className={`${isPlayingThis ? 'whitespace-pre-wrap block' : 'truncate block'}`}>
                                                        {isPlayingThis && highlightedWordIndex !== undefined && highlightedWordIndex >= 0
                                                            ? renderHighlightedText(text, highlightedWordIndex)
                                                            : text}
                                                    </span>
                                                </div>

                                                {/* Play Button when NOT playing */}
                                                {!isPlayingThis && onPlayTranslationAudio && (
                                                    <button
                                                        onClick={() => {
                                                            onPlayTranslationAudio(text, lang, translationKey);
                                                        }}
                                                        className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 transition-all"
                                                        title={`Play ${lang}`}
                                                    >
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M8 5v14l11-7z" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}<div className="flex-1 relative">
                {/* Instant Mode Toggle - Moved here */}
                <div className="absolute top-4 right-4 z-10">
                    <button
                        onClick={onBuildModeToggle}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition shadow-lg ${!buildMode
                            ? 'bg-violet-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                            }`}
                        title={buildMode ? "Instant mode: OFF - Build then submit" : "Instant mode: ON - Auto-process"}
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                        </svg>
                    </button>
                </div>

                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (value.trim()) {
                                onSubmit();
                                sendEvent({
                                    action: 'message_sent',
                                    params: {
                                        char_count: value.length,
                                        language: (languages[0] || 'en'),
                                        type: 'text'
                                    }
                                });
                            }
                        }
                    }}
                    placeholder="Type Your Message Here..."
                    className="w-full h-full bg-transparent text-xl placeholder:text-muted-foreground/60 text-foreground focus:outline-none resize-none leading-relaxed p-6 pb-16"
                />

                {/* Controls (bottom) */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    {/* Listening indicator - Left side */}
                    {audioActive ? (
                        <div className="flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-lg px-3 py-1.5">
                            <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></span>
                            <p className="text-violet-800 dark:text-violet-300 text-xs font-medium">{audioTranscript || 'Listening...'}</p>
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground">{value.length}/500</div>
                    )}

                    {/* Right side controls */}
                    <div className="flex items-center gap-2">
                        {/* Submit Button */}
                        {value && (
                            <button
                                onClick={() => {
                                    onSubmit();
                                    sendEvent({
                                        action: 'message_sent',
                                        params: {
                                            char_count: value.length,
                                            language: (languages[0] || 'en'),
                                            type: 'text'
                                        }
                                    });
                                }}
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
                                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
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
