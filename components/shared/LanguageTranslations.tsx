import { useState, useEffect } from 'react';
import LanguageSelector from './LanguageSelector';
import { getSpeechLang } from '@/lib/services';

interface LanguageTranslationsProps {
    inputText?: string;
    languages: string[];
    translations: Record<string, string>;
    isTranslating: boolean;
    // Updated: onPlayAudio now takes a key to identify what's being played
    onPlayAudio: (text: string, lang: string, key: string) => void;
    onStopAudio?: () => void;
    // Changed: Track specific item being played (e.g., 'translation-fr', 'translation-de')
    currentlyPlayingKey?: string | null;
    showLastMessage?: boolean; // Show "Last Message" section
    hideSelector?: boolean; // Hide the language selector (for Party B)
    excludePrimary?: boolean; // Hide the primary language from the list (for Party B)
    keyPrefix?: string; // Key prefix for translation keys (e.g., 'input-translation', 'response-translation')
    highlightedWordIndex?: number; // For word-by-word highlighting
    customStatus?: string | null; // For custom status text override
}

// Helper to render highlighted text preserving whitespace
const renderHighlightedText = (text: string, activeIndex: number) => {
    let wordCount = 0;
    return text.split(/(\s+)/).map((part, i) => {
        if (part.length > 0 && !part.match(/\s/)) {
            const isActive = wordCount === activeIndex;
            wordCount++;
            return <span key={i} className={isActive ? "bg-primary/50 text-white shadow-[0_0_10px_rgba(139,92,246,0.3)] rounded px-1 -mx-1 transition-all duration-150" : ""}>{part}</span>;
        }
        // Use whitespace-pre-wrap to allow wrapping while preserving sequence
        return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
};

// Inline AudioWave component
const AudioWave = () => (
    <span className="flex gap-0.5 items-end h-3 mx-1">
        <span className="w-0.5 h-1.5 bg-primary animate-[pulse_0.6s_infinite]"></span>
        <span className="w-0.5 h-3 bg-primary animate-[pulse_0.8s_infinite]"></span>
        <span className="w-0.5 h-2 bg-primary animate-[pulse_0.7s_infinite]"></span>
    </span>
);

export default function LanguageTranslations({
    languages,
    translations,
    isTranslating,
    onPlayAudio,
    onStopAudio,
    inputText = '',
    currentlyPlayingKey = null,
    showLastMessage = true,
    hideSelector = false,
    excludePrimary = false,
    keyPrefix = 'translation',
    highlightedWordIndex,
    customStatus
}: LanguageTranslationsProps) {
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

    // Sync selected languages with prop changes
    useEffect(() => {
        if (hideSelector) {
            setSelectedLanguages(languages);
        } else if (selectedLanguages.length === 0) {
            setSelectedLanguages([languages[0]]);
        }
    }, [languages, hideSelector]);

    // Filter out primary language if excludePrimary is set
    const filteredLanguages = excludePrimary
        ? languages.filter(lang => lang !== languages[0])
        : languages;

    const shouldShow = inputText && filteredLanguages.length >= 1;

    if (!shouldShow) {
        return null;
    }

    const languagesToShow = excludePrimary
        ? selectedLanguages.filter(lang => lang !== languages[0])
        : selectedLanguages;

    return (
        <div className="border-t border-border bg-card p-2 md:p-3">
            {/* Header section - only show if we have content to display */}
            {(showLastMessage || !hideSelector || excludePrimary) && (
                <div className="flex items-center justify-between mb-3">
                    {showLastMessage && inputText && (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Last Message</span>
                            <span className="text-sm text-foreground line-clamp-2">{inputText}</span>
                        </div>
                    )}
                    {/* {excludePrimary && !showLastMessage && (
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Translations</span>
                    )} */}
                    {!hideSelector && (
                        <LanguageSelector
                            availableLanguages={languages}
                            selectedLanguages={selectedLanguages}
                            onLanguagesChange={setSelectedLanguages}
                            primaryLanguage={languages[0]}
                            label="Select languages"
                        />
                    )}
                </div>
            )}

            {languagesToShow.length > 0 ? (
                <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                    {languagesToShow.map((lang, idx) => {
                        const isPrimary = lang === languages[0];
                        const text = isPrimary ? inputText : translations[lang];
                        // Each translation row has its unique key with the specified prefix
                        const translationKey = `${keyPrefix}-${lang}`;
                        const isPlaying = currentlyPlayingKey === translationKey;

                        return (
                            <div key={lang} className={`py-1 px-2 rounded-lg transition-all ${isPlaying
                                ? 'bg-primary/10 border border-primary/20 flex flex-col gap-1.5'
                                : 'hover:bg-muted border border-transparent flex items-center gap-2'
                                }`}>

                                {/* Header Layout when playing (Badge + Status + Button) */}
                                <div className={`flex items-center ${isPlaying ? 'justify-between w-full' : 'gap-2 shrink-0'}`}>
                                    <div className={`flex items-center ${isPlaying ? 'gap-2' : ''}`}>
                                        {/* Language Badge */}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono min-w-[32px] text-center transition-all shrink-0 ${isPlaying
                                            ? 'bg-primary/20 text-primary ring-1 ring-primary/50'
                                            : (isPrimary && !excludePrimary)
                                                ? 'bg-secondary/50 text-secondary-foreground border border-border'
                                                : 'bg-muted text-muted-foreground'
                                            }`}>
                                            {lang.toUpperCase()}
                                        </span>

                                        {/* Speaking Indicator & Wave (Only visible here when playing) */}
                                        {isPlaying && (
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-medium uppercase tracking-wide shrink-0 ${customStatus ? 'text-amber-500' : 'text-primary'}`}>
                                                    {customStatus || ((highlightedWordIndex !== undefined && highlightedWordIndex >= 0) ? 'Reading...' : 'Speaking...')}
                                                </span>
                                                <AudioWave />
                                            </div>
                                        )}
                                    </div>

                                    {/* Stop Button (Only visible here when playing) */}
                                    {isPlaying && text && (
                                        <button
                                            onClick={() => onStopAudio && onStopAudio()}
                                            className="p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shrink-0 transition-all"
                                            title="Stop"
                                        >
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                                <rect x="6" y="6" width="12" height="12" rx="2" />
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                {/* Text Content */}
                                <div className={`text-sm leading-relaxed transition-all min-w-0 ${isPlaying ? 'text-primary font-medium pl-1' : 'flex-1 text-foreground'}`}>
                                    {!isPrimary && isTranslating ? (
                                        <span className="text-muted-foreground italic">Translating...</span>
                                    ) : text ? (
                                        <span className={`${isPlaying ? 'whitespace-pre-wrap block' : 'truncate block'}`}>
                                            {isPlaying && highlightedWordIndex !== undefined && highlightedWordIndex >= 0
                                                ? renderHighlightedText(text, highlightedWordIndex)
                                                : text}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">—</span>
                                    )}
                                </div>

                                {/* Play Button (Only visible here when NOT playing) */}
                                {!isPlaying && text && (
                                    <button
                                        onClick={() => onPlayAudio(text, getSpeechLang(lang), translationKey)}
                                        className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 transition-all"
                                        title={`Play in ${lang}`}
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-xs text-muted-foreground mt-2">Select languages</p>
            )}
        </div>
    );
}
