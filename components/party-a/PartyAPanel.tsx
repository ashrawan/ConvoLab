import { useState, useRef, useCallback, useEffect } from 'react';
import ContextInput from '../input/ContextInput';
import TextInputPanel from '../input/TextInputPanel';
import LanguageTranslations from '../shared/LanguageTranslations';
import PhraseSuggestions from '../shared/PhraseSuggestions';
import { ResizableDivider } from '../shared/ResizableDivider';
import { PhrasePrediction } from '@/lib/services/llm';

interface PartyAPanelProps {
    // Context
    context: string;
    onContextChange: (context: string) => void;
    languages: string[];
    onLanguagesChange: (languages: string[]) => void;
    audioEnabledLanguages?: string[];
    onAudioEnabledChange?: (languages: string[]) => void;
    // Changed: Track specific item being played (e.g., 'lastSent', 'translation-fr')
    currentlyPlayingKey?: string | null;
    customStatus?: string | null;
    highlightedWordIndex?: number;

    // Input
    input: string;
    onInputChange: (text: string) => void;
    onSubmit: () => void;
    lastSubmission?: { text: string; timestamp: number } | null;

    // Audio
    audioActive: boolean;
    onToggleAudio: () => void;
    audioTranscript: string;

    // Build mode
    buildMode: boolean;
    onBuildModeToggle: () => void;

    // Predictions
    predictions: PhrasePrediction[];
    isLoadingPredictions: boolean;
    onSelectPhrase: (phrase: string) => void;

    // Translations
    translations: Record<string, string>;
    lastSentTranslations: Record<string, string>;
    isTranslating: boolean;
    // Updated signature: playAudio now takes a key to identify what's playing
    onPlayAudio: (text: string, lang: string, key: string) => void;
    onStopAudio?: () => void;

    // Images
    images: string[];

    // Video
    videoActive: boolean;
    onVideoToggle: () => void;
    videoRef: React.RefObject<HTMLVideoElement | null>;

    // Collapsible Props
    isPhrasesCollapsed?: boolean;
    onTogglePhrases?: () => void;

    // Translations Collapsible
    isTranslationsCollapsed?: boolean;
    onToggleTranslations?: () => void;
}

export default function PartyAPanel({
    context,
    onContextChange,
    languages,
    onLanguagesChange,
    audioEnabledLanguages,
    onAudioEnabledChange,
    currentlyPlayingKey,
    highlightedWordIndex,
    customStatus,
    input,
    onInputChange,
    onSubmit,
    audioActive,
    onToggleAudio,
    audioTranscript,
    buildMode,
    onBuildModeToggle,
    predictions,
    isLoadingPredictions,
    onSelectPhrase,
    translations,
    lastSentTranslations,
    isTranslating,
    onPlayAudio,
    onStopAudio,
    images,
    videoActive,
    onVideoToggle,
    videoRef,
    lastSubmission,
    isPhrasesCollapsed = true,
    onTogglePhrases,
    isTranslationsCollapsed = true,
    onToggleTranslations
}: PartyAPanelProps) {
    // Resizable top section height (in pixels, will be calculated from container)
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
        <div ref={containerRef} className="w-1/2 flex flex-col border-r border-border">
            {/* Context Input */}
            <ContextInput
                party="A"
                value={context}
                onChange={onContextChange}
                selectedLanguages={languages}
                onLanguagesChange={onLanguagesChange}
                audioEnabledLanguages={audioEnabledLanguages}
                onAudioEnabledChange={onAudioEnabledChange}
                videoVisible={videoActive}
                onVideoVisibleChange={onVideoToggle}
            />

            {/* Top Section - Text Input + Translations (Resizable) */}
            <div
                ref={topSectionRef}
                className={`border-b border-border flex flex-col overflow-hidden ${isPhrasesCollapsed ? 'flex-1' : ''}`}
                style={isPhrasesCollapsed ? undefined : { height: topSectionHeight ?? '60%' }}
            >
                {/* Text Input + Video */}
                <div className="flex flex-1 min-h-0">
                    {/* Text Input Panel - Always visible */}
                    <div className={`${videoActive ? 'w-1/2 border-r border-border' : 'w-full'} flex flex-col overflow-hidden`}>
                        <TextInputPanel
                            value={input}
                            onChange={onInputChange}
                            onSubmit={onSubmit}
                            buildMode={buildMode}
                            onBuildModeToggle={onBuildModeToggle}
                            language={languages[0]}
                            videoActive={videoActive}
                            onVideoToggle={onVideoToggle}
                            videoRef={videoRef}
                            // Audio
                            audioActive={audioActive}
                            onToggleAudio={onToggleAudio}
                            audioTranscript={audioTranscript}
                            lastSubmission={lastSubmission}
                            // Only show as playing if specifically the 'lastSent' key is active
                            isAudioPlaying={currentlyPlayingKey === 'lastSent'}
                            onPlayTTS={(text) => onPlayAudio(text, languages[0] || 'en', 'lastSent')}
                            onStopTTS={onStopAudio}
                            // Translations for last sent
                            languages={languages}
                            lastSentTranslations={lastSentTranslations}
                            currentlyPlayingKey={currentlyPlayingKey}
                            onPlayTranslationAudio={onPlayAudio}
                            highlightedWordIndex={highlightedWordIndex}
                            customStatus={customStatus}
                        />
                    </div>

                    {/* Video Panel - Only shows when toggled on */}
                    {videoActive && (
                        <div className="w-1/2 relative bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                onLoadedMetadata={(e) => {
                                    console.log('Video metadata loaded');
                                    const video = e.target as HTMLVideoElement;
                                    video.play().catch(err => console.error('Play error:', err));
                                }}
                                className="w-full h-full object-cover"
                            />
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
                                inputText={input}
                                languages={languages}
                                translations={translations}
                                isTranslating={isTranslating}
                                onPlayAudio={onPlayAudio}
                                onStopAudio={onStopAudio}
                                currentlyPlayingKey={currentlyPlayingKey}
                                hideSelector={true}
                                showLastMessage={false}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Suggested Phrases Label + Resize Handle */}
            <button
                onClick={onTogglePhrases}
                className="w-full px-4 py-2 border-t border-border flex items-center justify-between hover:bg-accent transition-colors"
            >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Suggested Phrases</h3>
                <svg className={`w-3 h-3 text-muted-foreground transition-transform ${isPhrasesCollapsed ? '-rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {!isPhrasesCollapsed && (
                <>
                    <ResizableDivider onResize={handleResize} />

                    {/* Phrase Predictions */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-4">
                            <PhraseSuggestions
                                predictions={predictions}
                                isLoading={isLoadingPredictions}
                                onSelectPhrase={onSelectPhrase}
                            />
                        </div>

                        {/* Image Visualization */}
                        {images.length > 0 && (
                            <div className="mt-4">
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
