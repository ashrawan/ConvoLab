import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import ContextInput from '../input/ContextInput';
import LanguageTranslations from '../shared/LanguageTranslations';
import ConversationSuggestions from '../shared/ConversationSuggestions';
import { ResizableDivider } from '../shared/ResizableDivider';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

const slugify = (value: string) => value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const createSlugger = () => {
    const counts: Record<string, number> = {};
    return {
        slug(text: string) {
            const base = slugify(text) || 'section';
            const count = counts[base] ?? 0;
            counts[base] = count + 1;
            return count ? `${base}-${count}` : base;
        },
        reset() {
            Object.keys(counts).forEach(key => delete counts[key]);
        }
    };
};

const getNodeText = (node: unknown): string => {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getNodeText).join('');
    if (node && typeof node === 'object' && 'props' in node) {
        return getNodeText((node as { props?: { children?: unknown } }).props?.children);
    }
    return '';
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
    error?: string | null;

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
    error,
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
    // Only show reading state if highlighting the main response (not a translation)
    const isReadingMain = highlightedWordIndex !== undefined && highlightedWordIndex >= 0 && currentlyPlayingKey === 'response';
    const showActiveState = isPlayingMain || isReadingMain || (!!customStatus && currentlyPlayingKey === 'response');

    // Resizable top section height (in pixels)
    const containerRef = useRef<HTMLDivElement>(null);
    const topSectionRef = useRef<HTMLDivElement>(null);
    const responseScrollRef = useRef<HTMLDivElement>(null);
    const [topSectionHeight, setTopSectionHeight] = useState<number | null>(null);
    const [translationsHeight, setTranslationsHeight] = useState<number>(120); // Default 120px
    // Internal state removed in favor of props control
    const headingSluggerRef = useRef(createSlugger());
    headingSluggerRef.current.reset();

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
                {/* Response Area - Wrapper for scrollable content and fixed button */}
                <div className="flex-1 relative min-h-0">
                    {(isGenerating || isTranslating) && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-transparent pointer-events-none">
                            <div className="h-full bg-gradient-to-r from-transparent via-primary/70 to-transparent animate-pulse" />
                        </div>
                    )}
                    {/* Scrollable Content */}
                    <div ref={responseScrollRef} className="absolute inset-0 p-6 overflow-y-auto custom-scrollbar">
                        {/* Speaking/Reading/Custom indicator - Top */}
                        {showActiveState && response && (
                            <div className="flex items-center gap-2 mb-2 opacity-80">
                                <span className={`text-[10px] uppercase tracking-wider font-bold ${customStatus ? 'text-amber-500' : 'text-muted-foreground'}`}>
                                    {customStatus || (isReadingMain ? 'Reading...' : 'Speaking...')}
                                </span>
                                <span className="flex gap-0.5 items-end h-2.5">
                                    <span className={`w-0.5 h-1 animate-[pulse_0.6s_infinite] ${customStatus ? 'bg-amber-500' : 'bg-muted-foreground'}`}></span>
                                    <span className={`w-0.5 h-2.5 animate-[pulse_0.8s_infinite] ${customStatus ? 'bg-amber-500' : 'bg-muted-foreground'}`}></span>
                                    <span className={`w-0.5 h-1.5 animate-[pulse_0.7s_infinite] ${customStatus ? 'bg-amber-500' : 'bg-muted-foreground'}`}></span>
                                </span>
                            </div>
                        )}

                        {/* Response Text */}
                        <div className={`text-lg leading-relaxed transition-colors duration-300 text-foreground ${customStatus ? 'opacity-80' : ''}`}>
                            {error && !isGenerating ? (
                                <div className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                                    {error}
                                </div>
                            ) : currentlyPlayingKey === 'response' && highlightedWordIndex !== undefined && highlightedWordIndex >= 0 ? (
                                renderHighlightedText(response, highlightedWordIndex)
                            ) : response ? (
                                <div className="prose prose-invert max-w-none space-y-3">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                            em: ({ children }) => <em className="italic opacity-80">{children}</em>,
                                            h1: ({ children }) => <h3 className="mt-5 mb-2 text-sm font-semibold text-foreground">{children}</h3>,
                                            h2: ({ children }) => <h3 className="mt-5 mb-2 text-sm font-semibold text-foreground">{children}</h3>,
                                            h3: ({ children }) => <h4 className="mt-4 mb-1 text-sm font-semibold text-foreground">{children}</h4>,
                                            h4: ({ children }) => <h5 className="mt-3 mb-1 text-xs font-semibold text-foreground">{children}</h5>,
                                            h5: ({ children }) => <h6 className="mt-3 mb-1 text-xs font-semibold text-foreground">{children}</h6>,
                                            h6: ({ children }) => <h6 className="mt-3 mb-1 text-xs font-semibold text-foreground">{children}</h6>,
                                            ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                                            ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
                                            li: ({ children }) => <li>{children}</li>,
                                            code: ({ children }) => <code className="px-1 py-0.5 rounded bg-muted text-xs">{children}</code>,
                                            pre: ({ children }) => (
                                                <pre className="bg-muted/40 p-3 rounded-md overflow-x-auto text-xs leading-relaxed">{children}</pre>
                                            ),
                                            table: ({ children }) => (
                                                <div className="my-3 overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">{children}</table>
                                                </div>
                                            ),
                                            th: ({ children }) => (
                                                <th className="border-b border-border px-2 py-1 text-xs font-semibold text-muted-foreground">
                                                    {children}
                                                </th>
                                            ),
                                            td: ({ children }) => (
                                                <td className="border-b border-border px-2 py-1 align-top">
                                                    {children}
                                                </td>
                                            )
                                        }}
                                    >
                                        {response}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <span>{isGenerating ? 'Generating response...' : 'Output'}</span>
                            )}
                            {isGenerating && (
                                <span className="inline-block w-2 h-6 ml-2 bg-foreground/60 animate-pulse" />
                            )}
                        </div>
                        
                        {/* Add padding at bottom to prevent content from being hidden behind button */}
                        <div className="h-20"></div>
                    </div>

                    {/* Play/Stop button - Fixed at Bottom Right (outside scrollable content) */}
                    {response && !isGenerating && (
                        <div className="absolute bottom-4 right-4 pointer-events-none">
                            <button
                                onClick={() => {
                                    if (showActiveState && onStopAudio) {
                                        onStopAudio();
                                    } else {
                                        onPlayAudio(response, languages[0] || 'en', 'response');
                                    }
                                }}
                                className={`p-3 rounded-full transition-all shadow-lg pointer-events-auto ${showActiveState
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

                                keyPrefix="response-translation"
                                highlightedWordIndex={highlightedWordIndex}
                                customStatus={customStatus}
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
