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
}

// Inline AudioWave component
const AudioWave = () => (
    <span className="flex gap-0.5 items-end h-3 mx-1">
        <span className="w-0.5 h-1.5 bg-violet-400 animate-[pulse_0.6s_infinite]"></span>
        <span className="w-0.5 h-3 bg-violet-400 animate-[pulse_0.8s_infinite]"></span>
        <span className="w-0.5 h-2 bg-violet-400 animate-[pulse_0.7s_infinite]"></span>
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
    excludePrimary = false
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
        <div className="border-t border-white/10 bg-[#0a0a0b] p-4">
            {/* Header section - only show if we have content to display */}
            {(showLastMessage || !hideSelector || excludePrimary) && (
                <div className="flex items-center justify-between mb-3">
                    {showLastMessage && inputText && (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Last Message</span>
                            <span className="text-sm text-gray-300 line-clamp-2">{inputText}</span>
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
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                    {languagesToShow.map((lang, idx) => {
                        const isPrimary = lang === languages[0];
                        const text = isPrimary ? inputText : translations[lang];
                        // Each translation row has its unique key
                        const translationKey = `translation-${lang}`;
                        const isPlaying = currentlyPlayingKey === translationKey;

                        return (
                            <div key={lang} className={`flex items-center gap-3 p-2 rounded-lg transition-all ${isPlaying
                                ? 'bg-violet-500/10 border border-violet-500/20'
                                : 'hover:bg-white/5 border border-transparent'
                                }`}>

                                {/* Language Badge */}
                                <span className={`text-xs px-2 py-1 rounded font-mono min-w-[40px] text-center transition-all shrink-0 ${isPlaying
                                    ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/50'
                                    : (isPrimary && !excludePrimary)
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-white/10 text-gray-400'
                                    }`}>
                                    {lang.toUpperCase()}
                                </span>

                                {/* Text Content */}
                                <div className={`flex-1 text-sm leading-relaxed transition-all min-w-0 ${isPlaying ? 'text-violet-200' : 'text-gray-300'}`}>
                                    {!isPrimary && isTranslating ? (
                                        <span className="text-gray-500 italic">Translating...</span>
                                    ) : text ? (
                                        <div className="flex items-center gap-2">
                                            {/* Speaking indicator inline with text */}
                                            {isPlaying && (
                                                <>
                                                    <span className="text-xs text-violet-400 font-medium uppercase tracking-wide shrink-0">Speaking...</span>
                                                    <AudioWave />
                                                </>
                                            )}
                                            <span className={`${isPlaying ? 'truncate' : ''}`}>{text}</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-600">—</span>
                                    )}
                                </div>

                                {/* Play/Stop Button */}
                                {text && (
                                    <button
                                        onClick={() => {
                                            if (isPlaying && onStopAudio) {
                                                onStopAudio();
                                            } else {
                                                // Pass the unique key for this translation item
                                                onPlayAudio(text, getSpeechLang(lang), translationKey);
                                            }
                                        }}
                                        className={`p-2 rounded-full transition-all shrink-0 ${isPlaying
                                            ? 'bg-violet-500 text-white hover:bg-violet-600 shadow-md'
                                            : 'text-gray-500 hover:text-white hover:bg-white/10'
                                            }`}
                                        title={isPlaying ? "Stop" : `Play in ${lang}`}
                                    >
                                        {isPlaying ? (
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
                        );
                    })}
                </div>
            ) : (
                <p className="text-xs text-gray-600 mt-2">Select languages</p>
            )}
        </div>
    );
}
