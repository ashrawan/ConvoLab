interface ConversationSuggestionsProps {
    suggestions: Array<{ phrase: string; translations?: Record<string, string> }>;
    isLoading: boolean;
    hasResponse: boolean;
    onSelectSuggestion: (phrase: string) => void;
    onPlayAudio?: (text: string, lang: string) => void;
}

export default function ConversationSuggestions({
    suggestions,
    isLoading,
    hasResponse,
    onSelectSuggestion,
    onPlayAudio
}: ConversationSuggestionsProps) {
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                Loading suggestions...
            </div>
        );
    }

    if (!hasResponse) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                Start a conversation to see suggestions
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                No suggestions available
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((suggestion, idx) => (
                <button
                    key={idx}
                    onClick={() => onSelectSuggestion(suggestion.phrase)}
                    className="group relative bg-white/5 hover:bg-violet-500/10 border border-white/10 hover:border-violet-500/30 rounded-xl p-4 transition text-left"
                >
                    <div className="flex flex-col gap-2">
                        <p className="text-xs md:text-base text-white group-hover:text-violet-300 transition font-medium truncate">
                            {suggestion.phrase}
                        </p>
                        {suggestion.translations && Object.keys(suggestion.translations).length > 0 && (
                            <div className="space-y-1">
                                {Object.entries(suggestion.translations).map(([lang, text]) => (
                                    <div key={lang} className="flex items-center justify-between text-[10px] md:text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500">{lang.toUpperCase()}:</span>
                                            <span className="text-gray-400">{text}</span>
                                        </div>
                                        {onPlayAudio && (
                                            <span
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onPlayAudio(text, lang);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 cursor-pointer"
                                            >
                                                🔊
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
}
