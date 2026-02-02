import { useState, useRef, useEffect, useCallback } from 'react';
import { PhrasePrediction, chatService, getConversationSuggestions } from '@/lib/services/llm';
import type { NotebookContext } from '@/lib/services/llm';
import { translationService } from '@/lib/services';
import { sequentialAudioPlayer } from '@/lib/utils/audio-player';
import { playbackController, PlaybackMode, PlaybackItem } from '@/lib/utils/playback-controller';

export type { PlaybackMode };

// Import PlaybackState from usePartyA for consistency
import type { PlaybackState } from './usePartyA';
export type { PlaybackState };

export function usePartyB(
    partyAInput: string,
    sourceLang: string,
    hasUserInteracted: boolean,
    playbackMode: PlaybackMode = 'audio',
    readingSpeed: number = 180,
    isSimulationControlled: boolean = false
) {
    // State
    const [context, setContext] = useState('');
    const [languages, setLanguages] = useState<string[]>(['en']);
    const [response, setResponse] = useState('');
    const [responseError, setResponseError] = useState<string | null>(null);
    const [predictions, setPredictions] = useState<PhrasePrediction[]>([]);
    const [videoActive, setVideoActive] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Translation State
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [isTranslating, setIsOutputTranslating] = useState(false);
    const [images] = useState<string[]>([]);
    const [audioEnabledLanguages, setAudioEnabledLanguages] = useState<string[]>(['en']);
    // Coupled playback state: key and wordIndex are always synchronized
    const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
    const [isPlayingSequence, setIsPlayingSequence] = useState(false);
    // Custom status override
    const [customStatus, setCustomStatus] = useState<string | null>(null);
    const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Collapsible State (Sparks & Translations)
    const [isSparksCollapsed, setIsSparksCollapsed] = useState(true); // Default Closed
    const [isTranslationsCollapsed, setIsTranslationsCollapsed] = useState(true); // Default Closed

    // Suggestions
    const [conversationSuggestions, setConversationSuggestions] = useState<Array<{ phrase: string; translations?: Record<string, string> }>>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastPlayedResponse = useRef<string>('');
    const lastSuggestionResponse = useRef<string>('');
    const lastUserInputRef = useRef<string>('');
    const isTranslationsCollapsedRef = useRef(isTranslationsCollapsed);
    const playbackModeRef = useRef(playbackMode);
    const readingSpeedRef = useRef(readingSpeed);
    const isSimulationControlledRef = useRef(isSimulationControlled);

    useEffect(() => { isTranslationsCollapsedRef.current = isTranslationsCollapsed; }, [isTranslationsCollapsed]);
    useEffect(() => { playbackModeRef.current = playbackMode; }, [playbackMode]);
    useEffect(() => { readingSpeedRef.current = readingSpeed; }, [readingSpeed]);
    useEffect(() => { isSimulationControlledRef.current = isSimulationControlled; }, [isSimulationControlled]);

    // Load Languages from Local Storage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('partyB_languages');
            if (saved) {
                try {
                    const loadedLangs = JSON.parse(saved);
                    setLanguages(loadedLangs);
                    // Ensure primary language has audio enabled
                    if (loadedLangs.length > 0) {
                        setAudioEnabledLanguages(prev => {
                            const primary = loadedLangs[0];
                            if (!prev.includes(primary)) {
                                return [...prev, primary];
                            }
                            return prev;
                        });
                    }
                } catch (e) {
                    console.error('Failed to parse partyB_languages', e);
                }
            }
        }
    }, []);

    // Auto-expand/collapse translations based on language count
    useEffect(() => {
        if (languages.length > 1) {
            setIsTranslationsCollapsed(false);
        } else {
            setIsTranslationsCollapsed(true);
        }
    }, [languages.length]);

    const setLanguagesWithPersistence = useCallback((langs: string[]) => {
        setLanguages(langs);

        // Auto-enable audio for the new primary language if it's not enabled
        // This ensures the primary response is always heard by default when switching languages
        setAudioEnabledLanguages(prev => {
            const primary = langs[0];
            if (!prev.includes(primary)) {
                return [...prev, primary];
            }
            return prev;
        });

        if (typeof window !== 'undefined') {
            localStorage.setItem('partyB_languages', JSON.stringify(langs));
        }
    }, []);

    // ============================================================================
    // Generate Response
    // ============================================================================
    // ============================================================================
    // Generate Response & Translate
    // ============================================================================
    // ============================================================================
    // Generate Response & Translate
    // ============================================================================
    const generateResponse = useCallback(async (
        userInput: string,
        history: { role: string, content: string }[] = [],
        partyAContext: string = "",
        notebook?: NotebookContext
    ) => {
        if (!userInput.trim()) {
            setResponse('');
            setPredictions([]);
            setTranslations({});
            return;
        }

        setIsGenerating(true);
        setResponse(''); // Clear previous
        setTranslations({}); // Clear previous translations
        setResponseError(null);
        lastUserInputRef.current = userInput;

        let fullResponse = '';
        let didError = false;

        try {
            const res = await chatService.generateResponse({
                message: userInput,
                context: context, // Keeps legacy context field for Party B
                party_a_context: partyAContext,
                party_b_context: context,
                source_lang: sourceLang,
                return_lang: languages[0],
                stream: true,
                history: history,
                notebook
            });

            if (!res.ok) {
                didError = true;
                let errorMessage = `Request failed (${res.status} ${res.statusText})`;
                try {
                    const raw = await res.text();
                    if (raw) {
                        try {
                            const data = JSON.parse(raw);
                            errorMessage = data.error || data.message || errorMessage;
                        } catch {
                            errorMessage = raw;
                        }
                    }
                } catch { }
                setResponseError(errorMessage);
                setResponse('');
                return;
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    fullResponse += chunk;
                    setResponse(fullResponse);
                }
            }
        } catch (err) {
            console.error(err);
            didError = true;
            const message = err instanceof Error ? err.message : 'Failed to generate response';
            setResponseError(message);
            setResponse('');
        } finally {
            setIsGenerating(false);

            // Trigger translation immediately after response is complete ONLY if enabled
            if (!didError && fullResponse && languages.length > 1 && !isTranslationsCollapsedRef.current) {
                setIsOutputTranslating(true);
                try {
                    const src = languages[0];
                    const targets = languages.slice(1);
                    const results = await translationService.translateMultiple(fullResponse, src, targets);
                    setTranslations(results);
                } catch (e) {
                    console.error("Output translation failed", e);
                } finally {
                    setIsOutputTranslating(false);
                }
            }
        }
    }, [context, sourceLang, languages]);

    // Effect to handle translation when toggling OPEN
    useEffect(() => {
        const translateEffect = async () => {
            // If we open text, have response, needed languages, but no translations yet -> fetch
            if (!isTranslationsCollapsed && response && !isGenerating && languages.length > 1) {
                if (Object.keys(translations).length === 0) {
                    setIsOutputTranslating(true);
                    try {
                        const src = languages[0];
                        const targets = languages.slice(1);
                        const results = await translationService.translateMultiple(response, src, targets);
                        setTranslations(results);
                    } catch (e) {
                        console.error("Delayed output translation failed", e);
                    } finally {
                        setIsOutputTranslating(false);
                    }
                }
            }
        };

        translateEffect();

    }, [isTranslationsCollapsed, response, isGenerating, languages, translations]);

    // Unmount cleanup
    useEffect(() => {
        return () => {
            playbackController.stop();
        };
    }, []);

    // ============================================================================
    // Playback Callbacks (used by PlaybackController)
    // ============================================================================
    const playbackCallbacks = useCallback(() => ({
        onPlayingKeyChange: (key: string | null) => {
            if (key === null) {
                setPlaybackState(null);
            } else {
                setPlaybackState(prev => prev?.key === key ? prev : { key, wordIndex: -1 });
            }
        },
        onHighlightIndexChange: (index: number) => {
            setPlaybackState(prev => prev ? { ...prev, wordIndex: index } : null);
        }
    }), []);

    // ============================================================================
    // Playback Functions using Centralized Controller
    // ============================================================================
    const simulatePlayback = useCallback(async (text: string, wpm: number, key: string = 'response') => {
        await playbackController.playItem(
            { text, lang: languages[0] || 'en', key },
            'highlight',
            playbackCallbacks(),
            { wpm }
        );
    }, [languages, playbackCallbacks]);

    // ============================================================================
    // Internal Audio Helper - Respects playback mode
    // ============================================================================
    const playBatchAudio = useCallback((text: string, translationsToPlay: Record<string, string>) => {
        const mode = playbackModeRef.current;
        const enabledLangs = audioEnabledLanguages;
        const src = languages[0];
        const targets = languages.slice(1);

        // Build sequence of items to play/highlight
        const items: PlaybackItem[] = [];

        // Add primary response if enabled
        if (enabledLangs.includes(src)) {
            items.push({ text, lang: src, key: 'response' });
        }

        // Add translations for enabled languages
        targets.forEach(lang => {
            if (enabledLangs.includes(lang) && translationsToPlay[lang]) {
                items.push({
                    text: translationsToPlay[lang],
                    lang,
                    key: `response-translation-${lang}`
                });
            }
        });

        if (items.length === 0) return Promise.resolve();

        console.log(`🔊 Playing ${items.length} Party B items in ${mode} mode`);
        setIsPlayingSequence(true);

        return playbackController.playSequence(
            items,
            mode,
            playbackCallbacks(),
            { wpm: readingSpeedRef.current, delayBetween: 500 }
        ).finally(() => {
            setIsPlayingSequence(false);
        });
    }, [audioEnabledLanguages, languages, playbackCallbacks]);

    // ============================================================================
    // Audio Playback Effect (only when autoPlay is enabled)
    // ============================================================================
    // Explicitly play sequence for current response
    const playSequence = useCallback(async (responseToPlay: string, translationsToPlay: Record<string, string>) => {
        await playBatchAudio(responseToPlay, translationsToPlay);
    }, [playBatchAudio]);

    // ============================================================================
    // Audio Playback Effect (only when auto-play is enabled and NOT simulation controlled)
    // ============================================================================
    useEffect(() => {
        // Skip auto-play if mode is 'manual' or simulation is in control
        if (playbackMode === 'manual') return;
        if (isSimulationControlledRef.current) return;

        if (isGenerating || isTranslating) return;
        if (!response || response === lastPlayedResponse.current) return;
        if (audioEnabledLanguages.length === 0) return;
        if (!hasUserInteracted) return;

        // Check if we have translations we expect
        const needsTranslation = languages.length > 1;
        const hasTranslations = Object.keys(translations).length > 0;

        if (needsTranslation && !hasTranslations) return;

        lastPlayedResponse.current = response;

        // Auto-play using playBatchAudio (which respects the mode)
        playBatchAudio(response, translations);

    }, [response, translations, languages, isGenerating, isTranslating, hasUserInteracted, playbackMode, playBatchAudio, audioEnabledLanguages.length]);

    // ============================================================================
    // Suggestions
    // ============================================================================
    useEffect(() => {
        const fetchSuggestions = async () => {
            // Skip suggestions if collapsed
            if (isSparksCollapsed) {
                setConversationSuggestions([]);
                return;
            }

            // Skip suggestions during auto-play mode
            // if (autoPlayActive) {
            //    setConversationSuggestions([]);
            //    return;
            // }

            if (!response || response === lastSuggestionResponse.current) {
                if (!response) setConversationSuggestions([]);
                // If it IS the same response but we just opened the section, logic below handles it?
                // Actually, if lastSuggestionResponse matches, we return.
                // But if we toggle OPEN, we want to fetch even if response hasn't changed?
                // Let's reset lastSuggestionResponse if we toggled?
                // Or better: remove the strict check if we are explicitly triggering due to toggle
                // but simpler: if collapsed, we returned early.
                // If we un-collapse, this effect runs (because isSparksCollapsed changed).
                // But lastSuggestionResponse.current might equal response.
                // So we need to allow re-fetching if we don't have suggestions?
                if (conversationSuggestions.length > 0) return; // Already have them

                if (!response) return; // Nothing to suggest for
            }

            const seemsComplete = response.length > 0 && !isGenerating;
            if (!seemsComplete) return;

            lastSuggestionResponse.current = response;

            setSuggestionsLoading(true);
            try {
                const suggs = await getConversationSuggestions(
                    [{ user: lastUserInputRef.current, ai: response }],
                    sourceLang, // Source language (User's lang)
                    [sourceLang] // TARGET language for suggestions (Should be User's lang)
                );
                setConversationSuggestions(suggs.map((s: string) => ({ phrase: s })));
            } catch (e) {
                console.error(e);
            } finally {
                setSuggestionsLoading(false);
            }
        };

        const timeout = setTimeout(fetchSuggestions, 1000);
        return () => clearTimeout(timeout);
    }, [response, isGenerating, sourceLang, languages, isSparksCollapsed, conversationSuggestions.length]);

    // ============================================================================
    // Video
    // ============================================================================
    const startVideo = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setVideoActive(true);
        } catch (err) {
            console.error(err);
        }
    };

    const stopVideo = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setVideoActive(false);
    };

    const toggleVideo = () => {
        if (videoActive) stopVideo();
        else startVideo();
    };

    useEffect(() => {
        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        };
    }, []);

    // playAudio now takes a key to identify what's being played
    // Respects playback mode
    const playAudio = useCallback((text: string, lang: string, key: string) => {
        const mode = playbackModeRef.current;
        setIsPlayingSequence(true);

        playbackController.playItem(
            { text, lang, key },
            mode,
            playbackCallbacks(),
            { wpm: readingSpeedRef.current }
        ).finally(() => {
            setIsPlayingSequence(false);
        });
    }, [playbackCallbacks]);



    const reset = () => {
        setResponse('');
        setPredictions([]);
        setContext('');
        setTranslations({});
        setConversationSuggestions([]);
        setResponseError(null);
    };

    // ============================================================================
    // Simulation Actions
    // ============================================================================


    const stopSimulation = useCallback(() => {
        playbackController.stop();
        setPlaybackState(null);
        setCustomStatus(null);
    }, []);

    // Stop audio and reset state
    const stopAllAudio = useCallback(() => {
        playbackController.stop();
        setPlaybackState(null);
    }, []);

    return {
        state: {
            context,
            languages,
            response,
            error: responseError,
            predictions,
            videoActive,
            isGenerating,
            translations,
            isTranslating,
            images,
            audioEnabledLanguages,
            playbackState,
            conversationSuggestions,
            suggestionsLoading,
            videoRef,
            isSparksCollapsed,
            isTranslationsCollapsed,
            isPlayingSequence,
            customStatus
        },
        actions: {
            setContext,
            setLanguages: setLanguagesWithPersistence,
            setAudioEnabledLanguages,
            generateResponse,
            toggleVideo,
            reset,
            playAudio,
            stopAllAudio,
            setIsSparksCollapsed,
            setIsTranslationsCollapsed,
            playSequence,
            // Simulation actions
            simulatePlayback,
            setCustomStatus,
            stopSimulation
        }
    };
}
