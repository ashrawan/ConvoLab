import { useState, useRef, useCallback, useEffect } from 'react';
import ContextInput from '../input/ContextInput';
import LanguageTranslations from '../shared/LanguageTranslations';
import ConversationSuggestions from '../shared/ConversationSuggestions';
import { ResizableDivider } from '../shared/ResizableDivider';
import ReactMarkdown from 'react-markdown';

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

interface PartyBPanelProps {
    // Context
    context: string;
    onContextChange: (context: string) => void;
    languages: string[];
    onLanguagesChange: (languages: string[]) => void;
    audioEnabledLanguages?: string[];
    onAudioEnabledChange?: (languages: string[]) => void;
    // Changed: Track specific item being played (e.g., 'response', 'translation-fr')
    currentlyPlayingKey?: string | null;
    highlightedWordIndex?: number;

    // Response
    response: string;
    isGenerating: boolean;

    // Translations
    translations: Record<string, string>;
    isTranslating: boolean;
    // Updated signature: playAudio now takes a key to identify what's playing
    onPlayAudio: (text: string, lang: string, key: string) => void;
    onStopAudio?: () => void;

    // Conversation suggestions
    suggestions: Array<{ phrase: string; translations?: Record<string, string> }>;
    isLoadingSuggestions: boolean;
    onSelectSuggestion: (phrase: string) => void;

    // Images
    images: string[];

    // Video
    videoActive: boolean;
    videoRef: React.RefObject<HTMLVideoElement | null>;

    // Collapsible Props
    isSparksCollapsed?: boolean;
    onToggleSparks?: () => void;

    // Translations Collapsible
    isTranslationsCollapsed?: boolean;
    onToggleTranslations?: () => void;
    // New status override
    customStatus?: string | null;
}

export default function PartyBPanel({
    context,
    onContextChange,
    languages,
    onLanguagesChange,
    audioEnabledLanguages,
    onAudioEnabledChange,
    currentlyPlayingKey,
    highlightedWordIndex,
    response,
    isGenerating,
    translations,
    isTranslating,
    onPlayAudio,
    onStopAudio,
    customStatus,
    suggestions = [],
    isLoadingSuggestions = false,
    onSelectSuggestion,
    images,
    videoActive,
    videoRef,
    isSparksCollapsed = true,
    onToggleSparks,
    isTranslationsCollapsed = true,
    onToggleTranslations
}: PartyBPanelProps) {
    // Check if the main response is playing (key='response')
    const isPlayingMain = currentlyPlayingKey === 'response';
    const isReading = highlightedWordIndex !== undefined && highlightedWordIndex >= 0;
    const showActiveState = isPlayingMain || isReading || !!customStatus;

    // Resizable top section height (in pixels)
    const containerRef = useRef<HTMLDivElement>(null);
    const topSectionRef = useRef<HTMLDivElement>(null);
    const [topSectionHeight, setTopSectionHeight] = useState<number | null>(null);
    const [translationsHeight, setTranslationsHeight] = useState<number>(120); // Default 120px
    // Internal state removed in favor of props control

    const handleResize = useCallback((delta: number) => {
        setTopSectionHeight(prev => {
            const container = containerRef.current;
            if (!container) return prev;

            const containerHeight = container.clientHeight;
            const currentHeight = prev ?? containerHeight * 0.5;
            const newHeight = Math.max(100, Math.min(containerHeight * 0.8, currentHeight + delta));
            return newHeight;
        });
    }, []);

    const handleTranslationsResize = useCallback((delta: number) => {
        setTranslationsHeight(prev => {
            const topSection = topSectionRef.current;
            if (!topSection) return prev;

            const maxHeight = topSection.clientHeight * 0.6; // Max 60% of top section
            // Negate delta: dragging down should increase height
            const newHeight = Math.max(48, Math.min(maxHeight, prev - delta)); // Min 48px
            return newHeight;
        });
    }, []);

    return (
        <div ref={containerRef} className="w-1/2 flex flex-col bg-background/50">
            {/* Context Input */}
            <ContextInput
                party="B"
                value={context}
                onChange={onContextChange}
                selectedLanguages={languages}
                onLanguagesChange={onLanguagesChange}
                audioEnabledLanguages={audioEnabledLanguages}
                onAudioEnabledChange={onAudioEnabledChange}
            />

            {/* Top Section - Response + Translations (Resizable) */}
            <div
                ref={topSectionRef}
                className={`border-b border-border flex flex-col overflow-hidden ${isSparksCollapsed ? 'flex-1' : ''}`}
                style={isSparksCollapsed ? undefined : { height: topSectionHeight ?? '60%' }}
            >
                {/* Response Area */}
                <div className="flex-1 relative p-6 overflow-y-auto custom-scrollbar min-h-0">
                    {/* Speaking/Reading/Custom indicator - Top */}
                    {showActiveState && response && (
                        <div className="flex items-center gap-2 mb-2 opacity-80">
                            <span className={`text-[10px] uppercase tracking-wider font-bold ${customStatus ? 'text-amber-500' :
                                isReading ? 'text-blue-700 dark:text-blue-400' :
                                    'text-violet-700 dark:text-violet-400'
                                }`}>
                                {customStatus || (isReading ? 'Reading...' : 'Speaking...')}
                            </span>
                            <span className="flex gap-0.5 items-end h-2.5">
                                <span className={`w-0.5 h-1 animate-[pulse_0.6s_infinite] ${customStatus ? 'bg-amber-500' :
                                    isReading ? 'bg-blue-600 dark:bg-blue-400' :
                                        'bg-violet-600 dark:bg-violet-400'
                                    }`}></span>
                                <span className={`w-0.5 h-2.5 animate-[pulse_0.8s_infinite] ${customStatus ? 'bg-amber-500' :
                                    isReading ? 'bg-blue-600 dark:bg-blue-400' :
                                        'bg-violet-600 dark:bg-violet-400'
                                    }`}></span>
                                <span className={`w-0.5 h-1.5 animate-[pulse_0.7s_infinite] ${customStatus ? 'bg-amber-500' :
                                    isReading ? 'bg-blue-600 dark:bg-blue-400' :
                                        'bg-violet-600 dark:bg-violet-400'
                                    }`}></span>
                            </span>
                        </div>
                    )}

                    {/* Response Text */}
                    <div className={`text-xl leading-relaxed whitespace-pre-wrap transition-colors duration-300 ${customStatus ? 'opacity-80' :
                        isPlayingMain ? 'text-violet-700 dark:text-violet-400' :
                            'text-blue-700 dark:text-blue-400'
                        }`}>
                        {highlightedWordIndex !== undefined && highlightedWordIndex >= 0 ? (
                            renderHighlightedText(response, highlightedWordIndex)
                        ) : response ? (
                            <ReactMarkdown
                                components={{
                                    p: ({ children }) => <span className="block mb-2 last:mb-0">{children}</span>,
                                    strong: ({ children }) => <span className="font-bold text-blue-700 dark:text-blue-400">{children}</span>,
                                    em: ({ children }) => <span className="italic opacity-80">{children}</span>,
                                    // Handle lists if needed, though 'nice and simple' was requested
                                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                                }}
                            >
                                {response}
                            </ReactMarkdown>
                        ) : (
                            <span>{isGenerating ? 'Generating response...' : 'Output'}</span>
                        )}
                        {isGenerating && (
                            <span className="inline-block w-2 h-6 ml-2 bg-blue-600 dark:bg-blue-400 animate-pulse" />
                        )}
                    </div>

                    {/* Play/Stop button - Bottom Right */}
                    {response && !isGenerating && (
                        <div className="absolute bottom-4 right-4">
                            <button
                                onClick={() => {
                                    if (showActiveState && onStopAudio) {
                                        onStopAudio();
                                    } else {
                                        onPlayAudio(response, languages[0] || 'en', 'response');
                                    }
                                }}
                                className={`p-3 rounded-full transition-all shadow-lg ${showActiveState
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                title={showActiveState ? "Stop" : "Play response"}
                            >
                                {showActiveState ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Translations Label + Resize Handle */}
                <button
                    onClick={onToggleTranslations}
                    className="w-full px-3 py-1 shrink-0 border-t border-border flex items-center justify-between hover:bg-accent transition-colors"
                >
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Translations</span>
                    <svg className={`w-3 h-3 text-muted-foreground transition-transform ${isTranslationsCollapsed ? '-rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {!isTranslationsCollapsed && (
                    <>
                        <ResizableDivider onResize={handleTranslationsResize} className="shrink-0" />

                        {/* Language Translations - Resizable height */}
                        <div
                            className="overflow-y-auto shrink-0"
                            style={{ height: translationsHeight }}
                        >
                            <LanguageTranslations
                                inputText={response}
                                languages={languages}
                                translations={translations}
                                isTranslating={isTranslating}
                                onPlayAudio={onPlayAudio}
                                onStopAudio={onStopAudio}
                                currentlyPlayingKey={currentlyPlayingKey}
                                showLastMessage={false}
                                hideSelector={true}
                                excludePrimary={true}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Conversation Sparks Label + Resize Handle */}
            <button
                onClick={onToggleSparks}
                className="w-full px-4 py-2 border-t border-border flex items-center justify-between hover:bg-accent transition-colors"
            >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Conversation Sparks</h3>
                <svg className={`w-3 h-3 text-muted-foreground transition-transform ${isSparksCollapsed ? '-rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {!isSparksCollapsed && (
                <>
                    <ResizableDivider onResize={handleResize} />

                    {/* Conversation Suggestions - Takes remaining space (aligns with Suggested Phrases) */}
                    <div className="flex-1 flex flex-col overflow-hidden">

                        <div className="flex-1 overflow-y-auto p-4">
                            <ConversationSuggestions
                                suggestions={suggestions}
                                isLoading={isLoadingSuggestions}
                                hasResponse={!!response}
                                onSelectSuggestion={onSelectSuggestion}
                                onPlayAudio={(text, lang) => onPlayAudio(text, lang, `suggestion-${lang}`)}
                            />
                        </div>

                        {/* Image Visualization */}
                        {images.length > 0 && (
                            <div className="border-t border-border p-4">
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Visual Context</div>
                                <div className="flex gap-3">
                                    {images.map((img, idx) => (
                                        <div key={idx} className="relative w-40 h-28 rounded-lg overflow-hidden border border-border">
                                            <img
                                                src={img}
                                                alt="Context visual"
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
