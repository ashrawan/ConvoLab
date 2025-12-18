import { useState, useRef, useEffect, useCallback } from 'react';
import { PhrasePrediction, chatService, getConversationSuggestions } from '@/lib/services/llm';
import { translationService } from '@/lib/services';
import { sequentialAudioPlayer } from '@/lib/utils/audio-player';

export function usePartyB(partyAInput: string, sourceLang: string, hasUserInteracted: boolean, autoPlay: boolean = true, autoPlayActive: boolean = false) {
    // State
    const [context, setContext] = useState('');
    const [languages, setLanguages] = useState<string[]>(['en']);
    const [response, setResponse] = useState('');
    const [predictions, setPredictions] = useState<PhrasePrediction[]>([]);
    const [videoActive, setVideoActive] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Translation State
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [isTranslating, setIsOutputTranslating] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [audioEnabledLanguages, setAudioEnabledLanguages] = useState<string[]>(['en']);
    // Changed: Track specific item being played (e.g., 'response', 'translation-fr')
    const [currentlyPlayingKey, setCurrentlyPlayingKey] = useState<string | null>(null);

    // Suggestions
    const [conversationSuggestions, setConversationSuggestions] = useState<Array<{ phrase: string; translations?: Record<string, string> }>>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastPlayedResponse = useRef<string>('');
    const lastSuggestionResponse = useRef<string>('');
    const lastUserInputRef = useRef<string>('');

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
        partyAContext: string = ""
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
        lastUserInputRef.current = userInput;

        let fullResponse = '';

        try {
            const res = await chatService.generateResponse({
                message: userInput,
                context: context, // Keeps legacy context field for Party B
                party_a_context: partyAContext,
                party_b_context: context,
                source_lang: sourceLang,
                return_lang: languages[0],
                stream: true,
                history: history
            });

            if (!res.ok) {
                fullResponse = `I understand: "${userInput}". How can I help you?`;
                setResponse(fullResponse);
            } else {
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
            }
        } catch (err) {
            console.error(err);
            fullResponse = `I understand: "${userInput}". How may I assist you?`;
            setResponse(fullResponse);
        } finally {
            setIsGenerating(false);

            // Trigger translation immediately after response is complete
            if (fullResponse && languages.length > 1) {
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

    // ============================================================================
    // Audio Playback Effect (only when autoPlay is enabled)
    // ============================================================================
    useEffect(() => {
        // Skip auto-play if disabled
        if (!autoPlay) return;

        if (isGenerating || isTranslating) return;
        if (!response || response === lastPlayedResponse.current) return;
        if (audioEnabledLanguages.length === 0) return;
        if (!hasUserInteracted) return;

        // Check if we have translations we expect
        const needsTranslation = languages.length > 1;
        const hasTranslations = Object.keys(translations).length > 0;

        if (needsTranslation && !hasTranslations) return;

        lastPlayedResponse.current = response;

        const src = languages[0];
        const targets = languages.slice(1);
        const queue = [];

        // Play main response first
        if (audioEnabledLanguages.includes(src)) {
            queue.push({
                text: response,
                lang: src,
                onStart: () => setCurrentlyPlayingKey('response'),
                onEnd: () => setCurrentlyPlayingKey(prev => prev === 'response' ? null : prev)
            });
        }

        // Then play translations
        targets.forEach(lang => {
            if (audioEnabledLanguages.includes(lang) && translations[lang]) {
                const key = `translation-${lang}`;
                queue.push({
                    text: translations[lang],
                    lang: lang,
                    onStart: () => setCurrentlyPlayingKey(key),
                    onEnd: () => setCurrentlyPlayingKey(prev => prev === key ? null : prev)
                });
            }
        });

        if (queue.length > 0) {
            console.log(`🔊 Queueing ${queue.length} Party B audio clips (waiting for idle)`);
            sequentialAudioPlayer.playSequentially(queue, 500, { cancel: false });
        }
    }, [response, audioEnabledLanguages, translations, languages, isGenerating, isTranslating, hasUserInteracted, autoPlay]);

    // ============================================================================
    // Suggestions
    // ============================================================================
    useEffect(() => {
        const fetchSuggestions = async () => {
            // Skip suggestions during auto-play mode
            if (autoPlayActive) {
                setConversationSuggestions([]);
                return;
            }

            if (!response || response === lastSuggestionResponse.current) {
                if (!response) setConversationSuggestions([]);
                return;
            }

            const seemsComplete = response.length > 20 && !isGenerating;
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
    }, [response, isGenerating, sourceLang, languages, autoPlayActive]);

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
        setResponse('');
        setPredictions([]);
        setContext('');
        setTranslations({});
        setConversationSuggestions([]);
    };

    return {
        state: {
            context, languages, response, predictions, videoActive, isGenerating,
            translations, isTranslating, images, audioEnabledLanguages, currentlyPlayingKey,
            conversationSuggestions, suggestionsLoading, videoRef
        },
        actions: {
            setContext, setLanguages: setLanguagesWithPersistence, setAudioEnabledLanguages,
            generateResponse, toggleVideo, reset, playAudio, stopAllAudio
        }
    };
}

