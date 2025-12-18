import { useState, useRef, useEffect, useCallback } from 'react';
import { PhrasePrediction, getPhrasePredictions } from '@/lib/services/llm';
import { translationService, sttService } from '@/lib/services';
import { sequentialAudioPlayer } from '@/lib/utils/audio-player';

export function usePartyA(autoPlay: boolean = true, pauseMicOnAudio: boolean = true) {
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
    const [images, setImages] = useState<string[]>([]);
    const [audioEnabledLanguages, setAudioEnabledLanguages] = useState<string[]>(['en']);
    // Changed: Track specific item being played (e.g., 'lastSent', 'translation-fr')
    const [currentlyPlayingKey, setCurrentlyPlayingKey] = useState<string | null>(null);

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
    const autoPlayRef = useRef(autoPlay);
    const audioEnabledLanguagesRef = useRef(audioEnabledLanguages);
    const pauseMicOnAudioRef = useRef(pauseMicOnAudio);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const submissionTimer = useRef<NodeJS.Timeout | null>(null);

    // Sync Refs
    useEffect(() => { inputRef.current = input; }, [input]);
    useEffect(() => { languagesRef.current = languages; }, [languages]);
    useEffect(() => { buildModeRef.current = buildMode; }, [buildMode]);
    useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);
    useEffect(() => { audioEnabledLanguagesRef.current = audioEnabledLanguages; }, [audioEnabledLanguages]);
    useEffect(() => { pauseMicOnAudioRef.current = pauseMicOnAudio; }, [pauseMicOnAudio]);

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
            const promises: Promise<any>[] = [
                // 1. Predictions
                getPhrasePredictions(text, sourceLang, sourceLang, 8)
                    .catch(e => { console.error('Prediction error:', e); return []; })
            ];

            // 2. Translations (if needed)
            if (targetLangs.length > 0) {
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
            setTranslations(trans);

        } catch (error) {
            console.error('AI Update Failed:', error);
        } finally {
            setIsLoadingPredictions(false);
            setIsTranslating(false);
        }
    }, []);

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

        // Only auto-play if autoPlay is enabled and we have enabled languages
        if (autoPlay && audioEnabledLanguages.length > 0) {
            const queue: Array<{ text: string; lang: string; onStart: () => void; onEnd: () => void }> = [];

            // Add primary language if enabled
            if (audioEnabledLanguages.includes(sourceLang)) {
                queue.push({
                    text: trimmed,
                    lang: sourceLang,
                    onStart: () => setCurrentlyPlayingKey('lastSent'),
                    onEnd: () => setCurrentlyPlayingKey(prev => prev === 'lastSent' ? null : prev)
                });
            }

            // Add translations for other enabled languages
            targetLangs.forEach(lang => {
                if (audioEnabledLanguages.includes(lang) && finalTranslations[lang]) {
                    const key = `translation-${lang}`;
                    queue.push({
                        text: finalTranslations[lang],
                        lang: lang,
                        onStart: () => setCurrentlyPlayingKey(key),
                        onEnd: () => setCurrentlyPlayingKey(prev => prev === key ? null : prev)
                    });
                }
            });

            if (queue.length > 0) {
                console.log(`🔊 Playing ${queue.length} audio clips for sent message`);
                sequentialAudioPlayer.playSequentially(queue, 500);
            }
        }
    }, [input, autoPlay, audioEnabledLanguages]);

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

                            // Only auto-play if autoPlay is enabled and primary language has audio enabled
                            if (autoPlayRef.current && audioEnabledLanguagesRef.current.includes(primaryLang)) {
                                sequentialAudioPlayer.playSequentially([{
                                    text: newText,
                                    lang: primaryLang,
                                    onStart: () => setCurrentlyPlayingKey('lastSent'),
                                    onEnd: () => setCurrentlyPlayingKey(prev => prev === 'lastSent' ? null : prev)
                                }]);
                            }
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

    const submitPhrase = useCallback(async (text: string) => {
        if (!text) return;

        const sourceLang = languagesRef.current[0] || 'en';
        const targetLangs = languagesRef.current.slice(1);

        let phraseTranslations: Record<string, string> = {};

        // Fetch translations for the phrase immediately
        if (targetLangs.length > 0) {
            try {
                phraseTranslations = await translationService.translateMultiple(text, sourceLang, targetLangs);
                setLastSentTranslations(phraseTranslations);
            } catch (e) {
                console.error('Failed to translate phrase submission', e);
            }
        } else {
            setLastSentTranslations({});
        }

        // Handle Audio Queue
        if (autoPlay && audioEnabledLanguages.length > 0) {
            const queue: Array<{ text: string; lang: string; onStart: () => void; onEnd: () => void }> = [];

            // Add primary language if enabled
            if (audioEnabledLanguages.includes(sourceLang)) {
                queue.push({
                    text: text,
                    lang: sourceLang,
                    onStart: () => setCurrentlyPlayingKey('lastSent'),
                    onEnd: () => setCurrentlyPlayingKey(prev => prev === 'lastSent' ? null : prev)
                });
            }

            // Add translations for other enabled languages
            targetLangs.forEach(lang => {
                if (audioEnabledLanguages.includes(lang) && phraseTranslations[lang]) {
                    const key = `translation-${lang}`;
                    queue.push({
                        text: phraseTranslations[lang],
                        lang: lang,
                        onStart: () => setCurrentlyPlayingKey(key),
                        onEnd: () => setCurrentlyPlayingKey(prev => prev === key ? null : prev)
                    });
                }
            });

            if (queue.length > 0) {
                console.log(`🔊 Playing ${queue.length} audio clips for phrase submission`);
                sequentialAudioPlayer.playSequentially(queue, 500);
            }
        }

        // Trigger submission
        setSubmission({ text, timestamp: Date.now() });
        setInput('');
    }, [autoPlay, audioEnabledLanguages]);

    // playAudio now takes a key to identify what's being played
    const playAudio = useCallback((text: string, lang: string, key: string) => {
        sequentialAudioPlayer.playSequentially([{
            text,
            lang,
            onStart: () => setCurrentlyPlayingKey(key),
            onEnd: () => setCurrentlyPlayingKey(prev => prev === key ? null : prev)
        }]);
    }, []);

    // Stop audio and reset state
    const stopAllAudio = useCallback(() => {
        sequentialAudioPlayer.cancel();
        setCurrentlyPlayingKey(null);
    }, []);

    const reset = () => {
        setInput('');
        setPredictions([]);
        setContext('');
        setTranslations({});
        setAudioTranscript('');
        setSubmission(null);
    };

    return {
        state: {
            context, languages, input, predictions, videoActive, audioActive,
            audioTranscript, isLoading: isLoadingPredictions, translations, lastSentTranslations, isTranslating, images,
            audioEnabledLanguages, currentlyPlayingKey, buildMode,
            videoRef, submission
        },
        actions: {
            setContext, setLanguages: setLanguagesWithPersistence, setInput,
            setAudioEnabledLanguages, setBuildMode,
            handleInput, handleManualSubmit, handleWordSelect, submitPhrase,
            startAudio, stopAudio, stopAllAudio, toggleVideo, reset, playAudio
        }
    };
}
