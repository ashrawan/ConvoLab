import { useState, useRef, useEffect, useCallback } from 'react';
import { PhrasePrediction, getPhrasePredictions } from '@/lib/services/llm';
import { translationService, sttService } from '@/lib/services';
import { sequentialAudioPlayer } from '@/lib/utils/audio-player';
import { playbackController, PlaybackMode, PlaybackItem } from '@/lib/utils/playback-controller';

export type { PlaybackMode };

// Coupled playback state - key and wordIndex are always synchronized
export interface PlaybackState {
    key: string;
    wordIndex: number;  // -1 means audio playing (not highlighting)
}

export function usePartyA(
    playbackMode: PlaybackMode = 'audio',
    readingSpeed: number = 180,
    pauseMicOnAudio: boolean = true,
    isSimulationControlled: boolean = false
) {

    // State
    const [context, setContext] = useState('');
    const [languages, setLanguages] = useState<string[]>(['en']);
    const [input, setInput] = useState('');
    const [predictions, setPredictions] = useState<PhrasePrediction[]>([]);
    const [videoActive, setVideoActive] = useState(false);
    const [audioActive, setAudioActive] = useState(false);
    const [audioTranscript, setAudioTranscript] = useState('');
    const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
    const [submission, setSubmission] = useState<{ text: string, timestamp: number } | null>(null);

    // Translation State
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [lastSentTranslations, setLastSentTranslations] = useState<Record<string, string>>({});
    const [isTranslating, setIsTranslating] = useState(false);
    const [images] = useState<string[]>([]);
    const [audioEnabledLanguages, setAudioEnabledLanguages] = useState<string[]>(['en']);
    // Coupled playback state: key and wordIndex are always synchronized
    const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
    const [isPlayingSequence, setIsPlayingSequence] = useState(false);
    // Custom status override (e.g., "TYPING...")
    const [customStatus, setCustomStatus] = useState<string | null>(null);
    const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Collapsible State (Phrases & Translations)
    const [isPhrasesCollapsed, setIsPhrasesCollapsed] = useState(true); // Default Closed
    const [isTranslationsCollapsed, setIsTranslationsCollapsed] = useState(true); // Default Closed

    // Mode
    const [buildMode, setBuildMode] = useState(true);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastProcessedInput = useRef('');

    // Internal Refs for closures
    const inputRef = useRef(input);
    const languagesRef = useRef(languages);
    const buildModeRef = useRef(buildMode);
    const playbackModeRef = useRef(playbackMode);
    const readingSpeedRef = useRef(readingSpeed);
    const audioEnabledLanguagesRef = useRef(audioEnabledLanguages);
    const pauseMicOnAudioRef = useRef(pauseMicOnAudio);
    const isPhrasesCollapsedRef = useRef(isPhrasesCollapsed);
    const isTranslationsCollapsedRef = useRef(isTranslationsCollapsed);
    const isSimulationControlledRef = useRef(isSimulationControlled);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const submissionTimer = useRef<NodeJS.Timeout | null>(null);

    // Sync Refs
    useEffect(() => { inputRef.current = input; }, [input]);
    useEffect(() => { languagesRef.current = languages; }, [languages]);
    useEffect(() => { buildModeRef.current = buildMode; }, [buildMode]);
    useEffect(() => { playbackModeRef.current = playbackMode; }, [playbackMode]);
    useEffect(() => { readingSpeedRef.current = readingSpeed; }, [readingSpeed]);
    useEffect(() => { audioEnabledLanguagesRef.current = audioEnabledLanguages; }, [audioEnabledLanguages]);
    useEffect(() => { pauseMicOnAudioRef.current = pauseMicOnAudio; }, [pauseMicOnAudio]);
    useEffect(() => { isPhrasesCollapsedRef.current = isPhrasesCollapsed; }, [isPhrasesCollapsed]);
    useEffect(() => { isTranslationsCollapsedRef.current = isTranslationsCollapsed; }, [isTranslationsCollapsed]);
    useEffect(() => { isSimulationControlledRef.current = isSimulationControlled; }, [isSimulationControlled]);

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
    const simulatePlayback = useCallback(async (text: string, wpm: number, key: string = 'lastSent') => {
        await playbackController.playItem(
            { text, lang: languagesRef.current[0] || 'en', key },
            'highlight',
            playbackCallbacks(),
            { wpm }
        );
    }, [playbackCallbacks]);

    const triggerHighlight = simulatePlayback;

    // ============================================================================
    // Internal Audio Helper - Respects playback mode
    // ============================================================================
    const playBatchAudio = useCallback((text: string, translationsToPlay: Record<string, string>) => {
        const mode = playbackModeRef.current;
        const sourceLang = languagesRef.current[0] || 'en';
        const targetLangs = languagesRef.current.slice(1);
        const enabledLangs = audioEnabledLanguagesRef.current;

        // Build sequence of items to play/highlight
        const items: PlaybackItem[] = [];

        // Add primary language if enabled
        if (enabledLangs.includes(sourceLang)) {
            items.push({ text, lang: sourceLang, key: 'lastSent' });
        }

        // Add translations for other enabled languages
        targetLangs.forEach(lang => {
            if (enabledLangs.includes(lang) && translationsToPlay[lang]) {
                items.push({
                    text: translationsToPlay[lang],
                    lang,
                    key: `sent-translation-${lang}`
                });
            }
        });

        if (items.length === 0) return Promise.resolve();

        console.log(`🔊 Playing ${items.length} items in ${mode} mode`);
        setIsPlayingSequence(true);

        return playbackController.playSequence(
            items,
            mode,
            playbackCallbacks(),
            { wpm: readingSpeedRef.current, delayBetween: 500 }
        ).finally(() => {
            setIsPlayingSequence(false);
        });
    }, [playbackCallbacks]);


    // ============================================================================
    // Input Handlers & Unified AI Updates
    // ============================================================================

    // Unified AI Update Function (Predictions + Translations)
    const updateAI = useCallback(async (text: string, currentLangs: string[]) => {
        if (!text || text.trim().length === 0) {
            setPredictions([]);
            setTranslations({});
            return;
        }

        // Parallelize requests
        setIsLoadingPredictions(true);
        setIsTranslating(true);

        try {
            const sourceLang = currentLangs[0];
            const targetLangs = currentLangs.slice(1);

            // Create promises array
            const promises: Promise<any>[] = [];

            // 1. Predictions (Only if NOT collapsed)
            if (!isPhrasesCollapsedRef.current) {
                promises.push(
                    getPhrasePredictions(text, sourceLang, sourceLang, 8)
                        .catch(e => { console.error('Prediction error:', e); return []; })
                );
            } else {
                promises.push(Promise.resolve([]));
            }

            // 2. Translations (Only if NOT collapsed AND has targets)
            if (!isTranslationsCollapsedRef.current && targetLangs.length > 0) {
                promises.push(
                    translationService.translateMultiple(text, sourceLang, targetLangs)
                        .catch(e => { console.error('Translation error:', e); return {}; })
                );
            } else {
                promises.push(Promise.resolve({}));
            }

            // Execute parallel
            const [preds, trans] = await Promise.all(promises);

            setPredictions(preds);
            // Only update translations if we actually fetched something or if we want to clear them.
            // If collapsed, 'trans' is {}, so we don't necessarily want to wipe existing translations if we just collapsed?
            // User requirement: "expected it not to make the call... Only when open it will make, or when its collapse open it will make if it hasn't yet."
            // If we collapse, we probably shouldn't clear the data, just hide it (UI side). But here we are setting state.
            // If we setTranslations({}) when collapsed, when we open it back up, we MUST re-fetch.
            // The logic below in useEffect triggers updateAI when opening, so it's fine to 'clear' or keep stable.
            // However, keeping stable is better UX (no flicker).
            // But if input changed while collapsed, we want proper state.
            // Simpler approach: updateAI always sets the state to what it decided.
            // If collapsed, it resolves {}, so we set {}. This means "no translations available".
            // When we expand, we trigger updateAI, which sees !collapsed, fetches real trans, and updates state.
            // BUT: if we already have translations and just collapse, do we lose them?
            // Yes, with this logic we lose them in state.
            // Is that okay? "collapase open it will make if it hasn't yet" implies caching?
            // If I just typed "Hello", got trans, then collapsed. Then typed "Hello World". Trans is {}.
            // Then expanded. It fetches for "Hello World". Correct.
            // What if I typed "Hello", got trans, collapsed. Trans becomes {}.
            // Expanded immediately. Input is still "Hello". It fetches again.
            // This satisfies "make if it hasn't yet" (it hasn't for the current visual state).
            // Optimization: if we wanted to keep them, we'd need to check if input changed.
            // For now, let's stick to the simpler "fetch based on visibility" model.

            // However, to avoid clearing previous valid translations when just typing in collapsed mode (which might be fine),
            // let's follow the standard pattern: state reflects current reality.
            if (!isTranslationsCollapsedRef.current) {
                setTranslations(trans);
            } else if (Object.keys(trans).length > 0) {
                // Should not happen if we passed Promise.resolve({})
                setTranslations(trans);
            } else {
                // If collapsed, we resolved {}.
                // If we had translations before, do we want to keep them?
                // Probably not relevant if hidden.
                // Let's sets it to trans (empty) to be safe.
                setTranslations(trans);
            }

        } catch (error) {
            console.error('AI Update Failed:', error);
        } finally {
            setIsLoadingPredictions(false);
            setIsTranslating(false);
        }
    }, []);

    // Trigger update when opening Phrases section if there's input
    // Trigger update when opening Phrases section if there's input
    useEffect(() => {
        if (!isPhrasesCollapsed && inputRef.current.trim()) {
            updateAI(inputRef.current, languagesRef.current);
        }
    }, [isPhrasesCollapsed, updateAI]);

    // Trigger update when opening Translations section if there's input
    // Trigger update when opening Translations section if there's input
    useEffect(() => {
        // Only fetch if NOT collapsed (opening) AND we have input AND we have target languages
        if (!isTranslationsCollapsed && inputRef.current.trim() && languagesRef.current.length > 1) {
            updateAI(inputRef.current, languagesRef.current);
        }
    }, [isTranslationsCollapsed, updateAI]);

    // Auto-expand/collapse translations based on language count
    useEffect(() => {
        if (languages.length > 1) {
            setIsTranslationsCollapsed(false);
        } else {
            setIsTranslationsCollapsed(true);
        }
    }, [languages.length]);

    // Load Languages from Local Storage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('partyA_languages');
            if (saved) {
                try {
                    const loadedLangs = JSON.parse(saved);
                    setLanguages(loadedLangs);

                    // Trigger immediate update if there is input
                    if (inputRef.current) {
                        updateAI(inputRef.current, loadedLangs);
                    }

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
                    console.error('Failed to parse partyA_languages', e);
                }
            }
        }
    }, [updateAI]); // Added updateAI dependency

    // Language Setter Wrapper
    const setLanguagesWithPersistence = useCallback((langs: string[]) => {
        setLanguages(langs);

        // Trigger update immediately when language changes
        if (inputRef.current) {
            // Cancel any pending debounced updates to avoid race conditions
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            updateAI(inputRef.current, langs);
        }

        // Auto-enable audio for the new primary language
        setAudioEnabledLanguages(prev => {
            const primary = langs[0];
            if (!prev.includes(primary)) {
                return [...prev, primary];
            }
            return prev;
        });

        if (typeof window !== 'undefined') {
            localStorage.setItem('partyA_languages', JSON.stringify(langs));
        }
    }, [updateAI]);

    // Input Change Handler
    const handleInput = useCallback((text: string) => {
        setInput(text);

        // Debounce unified update
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            updateAI(text, languagesRef.current);
        }, 600); // Slightly longer debounce 600ms to reduce calls further

        // Auto-process in instant mode
        // Clear any pending submission
        if (submissionTimer.current) clearTimeout(submissionTimer.current);

        if (!buildMode && text.trim() && text !== lastProcessedInput.current) {
            submissionTimer.current = setTimeout(() => {
                lastProcessedInput.current = text;
                setSubmission({ text, timestamp: Date.now() });
            }, 2000);
        }
    }, [buildMode, updateAI]); // Removed fetchPredictions dependency, added updateAI

    const handleManualSubmit = useCallback(async () => {
        // Clear any pending auto-submission
        if (submissionTimer.current) clearTimeout(submissionTimer.current);

        const trimmed = input.trim();
        if (!trimmed) return;

        // Allow re-submitting same text if manually clicked
        lastProcessedInput.current = trimmed;

        // Return promise for external awaiting
        return new Promise<{ text: string, translations: Record<string, string> } | void>(async (resolve) => {
            // Clear input immediately for responsiveness
            setInput('');

            // Set submission immediately (translations will pop in)
            setSubmission({ text: trimmed, timestamp: Date.now() });
            setLastSentTranslations({}); // Start clear

            const sourceLang = languagesRef.current[0] || 'en';
            const targetLangs = languagesRef.current.slice(1);
            let finalTranslations: Record<string, string> = {};

            // Fetch translations specifically for this submission
            if (targetLangs.length > 0) {
                try {
                    finalTranslations = await translationService.translateMultiple(trimmed, sourceLang, targetLangs);
                } catch (e) {
                    console.error('Failed to translate submission', e);
                }
            }

            // Update translations state
            setLastSentTranslations(finalTranslations);

            // Playback based on mode (skip if simulation is controlling)
            // - 'audio': auto-play audio
            // - 'highlight': auto-highlight (no audio)
            // - 'manual': NO auto-play - user explicitly clicks play button
            if (!isSimulationControlledRef.current) {
                if (playbackModeRef.current === 'audio' || playbackModeRef.current === 'highlight') {
                    playBatchAudio(trimmed, finalTranslations);
                }
            }
            // 'manual' mode or simulation controlled: no auto-play
            resolve({ text: trimmed, translations: finalTranslations });
        });
    }, [input, playBatchAudio]); // Removed autoPlay/audioEnabledLanguages form dependency as we use refs

    const handleWordSelect = useCallback((phrase: string) => {
        const newText = input ? `${input} ${phrase}` : phrase;
        setInput(newText);
        // Immediate update for word/phrase selection
        updateAI(newText, languagesRef.current);

        if (!buildMode) {
            setSubmission({ text: newText, timestamp: Date.now() });
        }
    }, [input, buildMode, updateAI]);

    // ============================================================================
    // Audio (STT)
    // ============================================================================
    const startAudio = useCallback(async () => {
        if (pauseMicOnAudioRef.current) {
            sequentialAudioPlayer.cancel();
        }
        const primaryLang = languagesRef.current[0] || 'en';

        try {
            await sttService.startListening(primaryLang, {
                onTranscript: (text, isFinal) => {
                    // Safety check for playing audio: Only cancel if auto-pause is enabled
                    if (pauseMicOnAudioRef.current && sequentialAudioPlayer.getIsPlaying()) {
                        sequentialAudioPlayer.cancel();
                    }

                    if (isFinal) {
                        const currentInput = inputRef.current;
                        const newText = currentInput ? currentInput + ' ' + text.trim() : text.trim();
                        setInput(newText);
                        setAudioTranscript('');
                        // Trigger update for final transcript
                        updateAI(newText, languagesRef.current);

                        // Only auto-submit if NOT in build mode
                        if (!buildModeRef.current) {
                            setSubmission({ text: newText, timestamp: Date.now() });

                            // Playback based on mode - only auto-play in 'audio' mode
                            if (playbackModeRef.current === 'audio' && audioEnabledLanguagesRef.current.includes(primaryLang)) {
                                sequentialAudioPlayer.playSequentially([{
                                    text: newText,
                                    lang: primaryLang,
                                    onStart: () => setPlaybackState({ key: 'lastSent', wordIndex: -1 }),
                                    onEnd: () => setPlaybackState(prev => prev?.key === 'lastSent' ? null : prev)
                                }]).finally(() => setIsPlayingSequence(false));
                                setIsPlayingSequence(true);
                            } else if (playbackModeRef.current === 'highlight') {
                                triggerHighlight(newText, readingSpeedRef.current);
                            }
                            // 'manual' mode: no auto-playback - user explicitly clicks play
                        }
                    } else {
                        setAudioTranscript(text);
                    }
                },
                onError: (err) => {
                    if (err.name === 'NotAllowedError') {
                        alert('Microphone access denied. Please check permission.');
                        setAudioActive(false);
                    } else if (err.name === 'NotFoundError') {
                        alert('No microphone found. Please connect a device.');
                        setAudioActive(false);
                    }
                }
            });
            setAudioActive(true);
        } catch (e: any) {
            setAudioActive(false);
            if (e.name === 'NotFoundError' || e.message?.includes('device not found')) {
                alert('Microphone not found. Please check your connection.');
            } else if (e.name === 'NotAllowedError') {
                alert('Microphone access denied. Please check permission.');
            } else {
                console.error('STT Start Failed:', e);
            }
        }
    }, [updateAI]);

    const stopAudio = useCallback(() => {
        sttService.stopListening();
        setAudioActive(false);
        setAudioTranscript('');
    }, []);

    // ============================================================================
    // Video
    // ============================================================================
    const startVideo = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            streamRef.current = stream;
            setVideoActive(true);

            // Allow state update to render video element before assigning stream
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.error('Play error', e));
                }
            }, 100);

        } catch (err) {
            console.error('Camera access denied:', err);
        }
    };

    const stopVideo = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setVideoActive(false);
    };

    const toggleVideo = () => {
        if (videoActive) stopVideo();
        else startVideo();
    };

    const submitPhrase = useCallback(async (phrase: string) => {
        if (!phrase) return;

        // If in Build Mode (Instant Mode OFF), clicking a phrase should just append it to input
        if (buildModeRef.current) {
            setInput(phrase);
            updateAI(phrase, languagesRef.current);
            return;
        }

        // Otherwise (Instant Mode ON), treat as full submission
        const sourceLang = languagesRef.current[0] || 'en';
        const targetLangs = languagesRef.current.slice(1);

        let phraseTranslations: Record<string, string> = {};

        // Fetch translations for the phrase immediately
        if (targetLangs.length > 0) {
            try {
                phraseTranslations = await translationService.translateMultiple(phrase, sourceLang, targetLangs);
                setLastSentTranslations(phraseTranslations);
            } catch (e) {
                console.error('Failed to translate phrase submission', e);
            }
        } else {
            setLastSentTranslations({});
        }

        // Handle Playback based on mode - only auto-play in 'audio' mode
        if (playbackModeRef.current === 'audio') {
            playBatchAudio(phrase, phraseTranslations);
        } else if (playbackModeRef.current === 'highlight') {
            triggerHighlight(phrase, readingSpeedRef.current);
        }
        // 'manual' mode: no auto-playback - user explicitly clicks play

        // Trigger submission
        setSubmission({ text: phrase, timestamp: Date.now() });
        setInput('');
    }, [playbackMode, playBatchAudio, updateAI]); // Updated dependency

    // playAudio now takes a key to identify what's being played
    // Respects playback mode: highlight mode does NOT play audio
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

    // Explicitly play sequence for current submission
    const playSequence = useCallback(async (text: string, translations: Record<string, string>) => {
        await playBatchAudio(text, translations);
    }, [playBatchAudio]);



    const reset = () => {
        setInput('');
        setPredictions([]);
        setContext('');
        setTranslations({});
        setAudioTranscript('');
        setSubmission(null);
        setPlaybackState(null);
        setCustomStatus(null);
        if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    };

    const stopSimulation = useCallback(() => {
        playbackController.stop();
        setPlaybackState(null);
        setCustomStatus(null);
    }, []);

    const stopAllAudio = useCallback(() => {
        playbackController.stop();
        setPlaybackState(null);
    }, []);

    return {
        state: {
            context, languages, input, predictions, videoActive, audioActive,
            audioTranscript, isLoading: isLoadingPredictions, translations, lastSentTranslations, isTranslating, images,
            audioEnabledLanguages, playbackState, buildMode,
            submission, isPhrasesCollapsed, isTranslationsCollapsed, isPlayingSequence,
            customStatus, videoRef
        },
        actions: {
            setContext, setLanguages: setLanguagesWithPersistence, setInput,
            setAudioEnabledLanguages, setBuildMode, setIsPhrasesCollapsed, setIsTranslationsCollapsed,
            handleInput, handleManualSubmit, handleWordSelect, submitPhrase,
            startAudio, stopAudio, stopAllAudio, toggleVideo, reset, playAudio, playSequence,
            simulatePlayback, setCustomStatus, stopSimulation
        },
        refs: {
            videoRef
        }
    };
}
