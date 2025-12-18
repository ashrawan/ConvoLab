import { useState, useRef, useCallback, useEffect } from 'react';
import useSound from 'use-sound';
import { getApiUrl } from '@/lib/config/api';

const MAX_AUTOPLAY_COUNT = 5;

export interface ConversationExchange {
    role: 'party_a' | 'party_b';
    content: string;
}

export type AutoPlayPhase =
    | 'idle'
    | 'generating'
    | 'typing'
    | 'waiting_response'
    | 'playing_audio'
    | 'reading';

interface UseAutoPlayParams {
    partyAContext: string;
    partyBContext: string;
    partyBResponse?: string;
    partyALang: string;
    autoPlayAudio: boolean;
    readingSpeed: number; // WPM
    onSetInput: (text: string) => void;
    onSubmit: () => void;
    isPartyBResponding: boolean;
    isPartyBTranslating: boolean; // Add this
    isAudioPlaying: boolean;  // Party B audio
    isPartyAAudioPlaying: boolean; // Party A audio
    showTypingEffect: boolean;
}

interface AutoPlayState {
    isRunning: boolean;
    isPaused: boolean;
    phase: AutoPlayPhase;
    typingText: string;
    highlightedWordIndex: number;
    highlightTarget: 'party_a' | 'party_b' | null;
    count: number;
}

// Generate conversation summary from history
function generateSummary(history: ConversationExchange[]): string {
    if (history.length <= 5) return '';

    const olderHistory = history.slice(0, -5);
    const summaryParts = olderHistory.map(ex => {
        const speaker = ex.role === 'party_a' ? 'User' : 'AI';
        return `${speaker}: ${ex.content.substring(0, 50)}...`;
    });

    return summaryParts.join(' | ');
}

export function useAutoPlay({
    partyAContext,
    partyBContext,
    partyBResponse,
    partyALang,
    autoPlayAudio,
    readingSpeed,
    onSetInput,
    onSubmit,
    isPartyBResponding,
    isPartyBTranslating,
    isAudioPlaying,
    isPartyAAudioPlaying,
    showTypingEffect
}: UseAutoPlayParams) {
    // Sound Effect
    const [playTyping, { stop: stopTyping }] = useSound('/sounds/keyboard-typing.mp3', {
        volume: 0.7,
        loop: true,
        interrupt: true
    });

    const [state, setState] = useState<AutoPlayState>({
        isRunning: false,
        isPaused: false,
        phase: 'idle',
        typingText: '',
        highlightedWordIndex: -1,
        highlightTarget: null,
        count: 0
    });

    // Conversation history (shared between manual and auto-play modes)
    const [conversationHistory, setConversationHistory] = useState<ConversationExchange[]>([]);

    // Refs for async operations - CRITICAL: these need to stay in sync
    const isRunningRef = useRef(false);
    const isPausedRef = useRef(false);
    const cancelRef = useRef(false);

    // Refs for dynamic values that change during the loop
    const isPartyBRespondingRef = useRef(isPartyBResponding);
    const isPartyBTranslatingRef = useRef(isPartyBTranslating);
    const isAudioPlayingRef = useRef(isAudioPlaying);
    const isPartyAAudioPlayingRef = useRef(isPartyAAudioPlaying);
    const autoPlayAudioRef = useRef(autoPlayAudio);
    const readingSpeedRef = useRef(readingSpeed);
    const showTypingEffectRef = useRef(showTypingEffect);
    const partyAContextRef = useRef(partyAContext);
    const partyBContextRef = useRef(partyBContext);
    const partyBResponseRef = useRef(partyBResponse);
    const partyALangRef = useRef(partyALang);
    const conversationHistoryRef = useRef(conversationHistory);
    const onSetInputRef = useRef(onSetInput);
    const onSubmitRef = useRef(onSubmit);

    // Keep refs in sync with props
    useEffect(() => {
        isPartyBRespondingRef.current = isPartyBResponding;
    }, [isPartyBResponding]);

    useEffect(() => {
        isPartyBTranslatingRef.current = isPartyBTranslating;
    }, [isPartyBTranslating]);

    useEffect(() => {
        isAudioPlayingRef.current = isAudioPlaying;
    }, [isAudioPlaying]);

    useEffect(() => {
        isPartyAAudioPlayingRef.current = isPartyAAudioPlaying;
    }, [isPartyAAudioPlaying]);

    useEffect(() => {
        autoPlayAudioRef.current = autoPlayAudio;
    }, [autoPlayAudio]);

    useEffect(() => {
        readingSpeedRef.current = readingSpeed;
    }, [readingSpeed]);

    useEffect(() => {
        showTypingEffectRef.current = showTypingEffect;
    }, [showTypingEffect]);

    useEffect(() => {
        partyAContextRef.current = partyAContext;
        partyBContextRef.current = partyBContext;
        partyBResponseRef.current = partyBResponse;
        partyALangRef.current = partyALang;
    }, [partyAContext, partyBContext, partyBResponse, partyALang]);

    useEffect(() => {
        conversationHistoryRef.current = conversationHistory;
    }, [conversationHistory]);

    useEffect(() => {
        onSetInputRef.current = onSetInput;
        onSubmitRef.current = onSubmit;
    }, [onSetInput, onSubmit]);

    // Sync running/paused refs with state
    useEffect(() => {
        isRunningRef.current = state.isRunning;
        isPausedRef.current = state.isPaused;
    }, [state.isRunning, state.isPaused]);

    // Add message to history
    const addToHistory = useCallback((role: 'party_a' | 'party_b', content: string) => {
        setConversationHistory(prev => [...prev, { role, content }]);
    }, []);

    // Clear history
    const clearHistory = useCallback(() => {
        setConversationHistory([]);
    }, []);

    // Highlight words for reading effect
    const highlightWords = useCallback(async (text: string) => {
        const parts = text.split(/(\s+)/);

        let wordCount = 0;
        for (const part of parts) {
            if (cancelRef.current) break;

            // Wait if paused
            while (isPausedRef.current && !cancelRef.current) {
                await new Promise(r => setTimeout(r, 100));
            }
            if (cancelRef.current) break;

            if (part.length > 0 && !part.match(/^\s+$/)) {
                // It's a word
                setState(prev => ({ ...prev, highlightedWordIndex: wordCount }));

                // Calculate speed dynamically for each word to support real-time adjustments
                const currentWpm = readingSpeedRef.current || 180;
                // Minimum 10ms per word to prevent infinite loop or freezing
                const msPerWord = Math.max(10, (60 / Math.max(10, currentWpm)) * 1000);

                await new Promise(r => setTimeout(r, msPerWord));
                wordCount++;
            }
        }
        setState(prev => ({ ...prev, highlightedWordIndex: -1 }));
    }, []);

    // Typing effect
    const typeMessage = useCallback(async (text: string): Promise<boolean> => {
        if (!showTypingEffectRef.current) {
            onSetInputRef.current(text);
            setState(prev => ({ ...prev, typingText: text }));
            return true;
        }

        const chars = text.split('');
        let typed = '';

        // Start looping typing sound
        playTyping();

        try {
            for (const char of chars) {
                if (cancelRef.current) return false;

                // Wait if paused
                if (isPausedRef.current) {
                    stopTyping(); // Stop sound while paused
                    while (isPausedRef.current && !cancelRef.current) {
                        await new Promise(r => setTimeout(r, 50));
                    }
                    if (!cancelRef.current) playTyping(); // Resume sound only if not cancelled
                }

                if (cancelRef.current) return false;

                typed += char;
                onSetInputRef.current(typed);
                setState(prev => ({ ...prev, typingText: typed }));

                // Natural typing speed variation (30-80ms per char)
                await new Promise(r => setTimeout(r, 30 + Math.random() * 50));
            }
        } finally {
            // Stop sound when typing finished or cancelled
            stopTyping();
        }

        return true;
    }, [playTyping, stopTyping]);

    // Generate next message from API
    const generateNextMessage = useCallback(async (): Promise<string | null> => {
        try {
            const history = conversationHistoryRef.current;
            const recentHistory = history.slice(-5);
            const summary = generateSummary(history);

            console.log('🤖 Generating auto-play message...', {
                partyA: partyAContextRef.current,
                partyB: partyBContextRef.current
            });

            const response = await fetch(getApiUrl('/api/ai/autoplay/generate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    party_a_context: partyAContextRef.current,
                    party_b_context: partyBContextRef.current,
                    party_a_lang: partyALangRef.current,
                    conversation_summary: summary,
                    recent_history: recentHistory.map(ex => ({
                        role: ex.role,
                        content: ex.content
                    }))
                })
            });

            if (!response.ok) {
                console.error('Auto-play generate failed:', response.status);
                return null;
            }

            const data = await response.json();
            console.log('✅ Generated message:', data.message);
            return data.message || null;
        } catch (err) {
            console.error('Auto-play generate error:', err);
            return null;
        }
    }, []);

    // Main auto-play loop
    const runAutoPlayCycle = useCallback(async () => {
        console.log('🎬 Starting auto-play cycle');
        let currentCycleCount = 0;

        while (isRunningRef.current && !cancelRef.current) {
            // Wait if paused
            while (isPausedRef.current && !cancelRef.current) {
                await new Promise(r => setTimeout(r, 100));
            }
            if (cancelRef.current) break;

            // Phase 1: Generate message
            console.log('📝 Phase 1: Generating message');
            setState(prev => ({ ...prev, phase: 'generating' }));
            const message = await generateNextMessage();

            if (!message || cancelRef.current) {
                console.log('⚠️ No message generated or cancelled');
                break;
            }

            // Increment count
            setState(prev => ({ ...prev, count: prev.count + 1 }));

            // Phase 2: Type message
            console.log('⌨️ Phase 2: Typing message');
            setState(prev => ({ ...prev, phase: 'typing' }));
            const typingComplete = await typeMessage(message);
            if (!typingComplete) break;

            // Phase 3: Submit and wait for response
            console.log('📤 Phase 3: Submitting');
            setState(prev => ({ ...prev, phase: 'waiting_response' }));
            addToHistory('party_a', message);
            onSubmitRef.current();

            // Wait for Party B to start responding (small delay to let state update)
            await new Promise(r => setTimeout(r, 500));

            // Wait for Party B to finish responding AND translating
            console.log('⏳ Waiting for Party B response & translation...');
            let waitCount = 0;
            // Wait while EITHER generating OR translating
            while ((isPartyBRespondingRef.current || isPartyBTranslatingRef.current) && !cancelRef.current && waitCount < 300) {
                await new Promise(r => setTimeout(r, 100));
                waitCount++;
            }
            if (cancelRef.current) break;

            // Phase 4: Handle audio/reading
            if (autoPlayAudioRef.current) {
                console.log('🔊 Phase 4: Playing audio');
                setState(prev => ({ ...prev, phase: 'playing_audio' }));

                // 1. Wait for Party A audio (Input + Translations)
                console.log('⏳ Waiting for Party A audio...');
                // Initial short wait to let audio start
                await new Promise(r => setTimeout(r, 500));
                let audioWaitA = 0;
                while (isPartyAAudioPlayingRef.current && !cancelRef.current && audioWaitA < 600) {
                    await new Promise(r => setTimeout(r, 100));
                    audioWaitA++;
                }

                // 2. Wait for Party B audio (Response + Translations)
                console.log('⏳ Waiting for Party B audio...');
                let audioWaitB = 0;
                while (isAudioPlayingRef.current && !cancelRef.current && audioWaitB < 600) {
                    await new Promise(r => setTimeout(r, 100));
                    audioWaitB++;
                }

                // Extra safety buffer
                await new Promise(r => setTimeout(r, 500));
            } else {
                console.log('📖 Phase 4: Reading mode');
                setState(prev => ({ ...prev, phase: 'reading' }));

                // Highlight Party A's message
                console.log('🔦 Highlighting Party A message');
                setState(prev => ({ ...prev, highlightTarget: 'party_a' }));
                await highlightWords(message);
                setState(prev => ({ ...prev, highlightTarget: null }));

                if (cancelRef.current) break;
                // Brief pause before Party B
                await new Promise(r => setTimeout(r, 500));

                // Highlight Party B's response
                const partyBResp = partyBResponseRef.current;
                console.log('🔦 Highlighting Party B response:', partyBResp ? 'Found' : 'Missing');
                if (partyBResp && !cancelRef.current) {
                    setState(prev => ({ ...prev, highlightTarget: 'party_b' }));
                    await highlightWords(partyBResp);
                    setState(prev => ({ ...prev, highlightTarget: null }));
                }

                await new Promise(r => setTimeout(r, 500));
            }

            if (cancelRef.current) break;

            // Check if we hit the limit during this cycle
            // Use a ref for current count to be safe or just read state
            // Getting fresh state inside loop is tricky with stale closure unless we use setState callback or ref.
            // We'll use a local counter since we are in a while loop.
            currentCycleCount++;
            if (currentCycleCount >= MAX_AUTOPLAY_COUNT) {
                console.log('🛑 Max auto-play count reached (loop end)');
                break;
            }

            // Brief pause between cycles
            console.log('⏸️ Pause before next cycle');
            await new Promise(r => setTimeout(r, 1500));
        }

        console.log('🛑 Auto-play cycle ended');
        // Reset state when done
        setState(prev => ({
            ...prev,
            isRunning: false,
            isPaused: false,
            phase: 'idle',
            typingText: '',
            highlightedWordIndex: -1,
            highlightTarget: null
        }));
    }, [generateNextMessage, typeMessage, addToHistory, highlightWords]);

    // Start auto-play
    const start = useCallback(() => {
        if (isRunningRef.current) {
            console.log('⚠️ Already running');
            return;
        }

        console.log('▶️ Starting auto-play');
        cancelRef.current = false;
        isRunningRef.current = true;

        setState(prev => ({
            ...prev,
            isRunning: true,
            isPaused: false,
            phase: 'generating',
            count: 0
        }));

        // Start the loop (use setTimeout to ensure state is set first)
        setTimeout(() => {
            runAutoPlayCycle();
        }, 0);
    }, [runAutoPlayCycle]);

    // Pause auto-play
    const pause = useCallback(() => {
        console.log('⏸️ Pausing auto-play');
        isPausedRef.current = true;
        setState(prev => ({ ...prev, isPaused: true }));
    }, []);

    // Resume auto-play
    const resume = useCallback(() => {
        console.log('▶️ Resuming auto-play');
        isPausedRef.current = false;
        setState(prev => ({ ...prev, isPaused: false }));
    }, []);

    // Stop auto-play completely
    const stop = useCallback(() => {
        console.log('⏹️ Stopping auto-play');
        cancelRef.current = true;
        isRunningRef.current = false;
        setState(prev => ({
            ...prev,
            isRunning: false,
            isPaused: false,
            phase: 'idle',
            typingText: '',
            highlightedWordIndex: -1,
            highlightTarget: null
        }));
    }, []);

    // Stop autoplay when tab becomes hidden
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && isRunningRef.current) {
                console.log('🙈 Tab hidden - stopping auto-play');
                stop();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [stop]);

    // Toggle between start and pause
    const toggle = useCallback(() => {
        console.log('🔄 Toggle called, isRunning:', isRunningRef.current, 'isPaused:', isPausedRef.current);
        if (!isRunningRef.current) {
            start();
        } else if (isPausedRef.current) {
            resume();
        } else {
            pause();
        }
    }, [start, resume, pause]);

    return {
        state: {
            ...state,
            conversationHistory,
            maxCount: MAX_AUTOPLAY_COUNT
        },
        actions: {
            start,
            pause,
            resume,
            stop,
            toggle,
            addToHistory,
            clearHistory
        }
    };
}
