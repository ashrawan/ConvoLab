import { useState, useRef, useCallback } from 'react';
import ContextInput from '../input/ContextInput';
import LanguageTranslations from '../shared/LanguageTranslations';
import ConversationSuggestions from '../shared/ConversationSuggestions';
import { ResizableDivider } from '../shared/ResizableDivider';
import ReactMarkdown from 'react-markdown';

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
}

export default function PartyBPanel({
    context,
    onContextChange,
    languages,
    onLanguagesChange,
    audioEnabledLanguages,
    onAudioEnabledChange,
    currentlyPlayingKey,
    response,
    isGenerating,
    translations,
    isTranslating,
    onPlayAudio,
    onStopAudio,
    suggestions,
    isLoadingSuggestions,
    onSelectSuggestion,
    images,
    videoActive,
    videoRef
}: PartyBPanelProps) {
    // Check if the main response is playing (key='response')
    const isPlayingMain = currentlyPlayingKey === 'response';

    // Resizable top section height (in pixels)
    const containerRef = useRef<HTMLDivElement>(null);
    const topSectionRef = useRef<HTMLDivElement>(null);
    const [topSectionHeight, setTopSectionHeight] = useState<number | null>(null);
    const [translationsHeight, setTranslationsHeight] = useState<number>(120); // Default 120px

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
        <div ref={containerRef} className="w-1/2 flex flex-col bg-[#0a0a0b]">
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
                className="border-b border-white/5 flex flex-col overflow-hidden"
                style={{ height: topSectionHeight ?? '60%' }}
            >
                {/* Response Area */}
                <div className="flex-1 relative p-6 overflow-y-auto custom-scrollbar min-h-0">
                    {/* Speaking indicator - Top */}
                    {isPlayingMain && response && (
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs uppercase tracking-wide text-violet-400 font-medium">Speaking...</span>
                            <span className="flex gap-0.5 items-end h-3">
                                <span className="w-0.5 h-1.5 bg-violet-400 animate-[pulse_0.6s_infinite]"></span>
                                <span className="w-0.5 h-3 bg-violet-400 animate-[pulse_0.8s_infinite]"></span>
                                <span className="w-0.5 h-2 bg-violet-400 animate-[pulse_0.7s_infinite]"></span>
                            </span>
                        </div>
                    )}

                    {/* Response Text */}
                    {/* Response Text */}
                    <div className={`text-2xl leading-relaxed whitespace-pre-wrap transition-colors duration-300 ${isPlayingMain ? 'text-violet-200' : 'text-emerald-300'}`}>
                        {response ? (
                            <ReactMarkdown
                                components={{
                                    p: ({ children }) => <span className="block mb-2 last:mb-0">{children}</span>,
                                    strong: ({ children }) => <span className="font-bold text-emerald-200">{children}</span>,
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
                            <span className="inline-block w-2 h-6 ml-2 bg-emerald-400 animate-pulse" />
                        )}
                    </div>

                    {/* Play/Stop button - Bottom Right */}
                    {response && !isGenerating && (
                        <div className="absolute bottom-4 right-4">
                            <button
                                onClick={() => {
                                    if (isPlayingMain && onStopAudio) {
                                        onStopAudio();
                                    } else {
                                        onPlayAudio(response, languages[0] || 'en', 'response');
                                    }
                                }}
                                className={`p-3 rounded-full transition-all shadow-lg ${isPlayingMain
                                    ? 'bg-violet-500 text-white hover:bg-violet-600'
                                    : 'bg-white/10 text-gray-400 hover:text-white hover:bg-white/20'
                                    }`}
                                title={isPlayingMain ? "Stop" : "Play response"}
                            >
                                {isPlayingMain ? (
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
                <div className="px-3 py-1 shrink-0 border-t border-white/5">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Translations</span>
                </div>
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
            </div>

            {/* Conversation Sparks Label + Resize Handle */}
            <div className="px-4 py-2 border-t border-white/5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Conversation Sparks</h3>
            </div>
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
                    <div className="border-t border-white/10 p-4">
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Visual Context</div>
                        <div className="flex gap-3">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative w-40 h-28 rounded-lg overflow-hidden border border-white/10">
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
        </div>
    );
}
