import { useState, useRef, useCallback, useEffect } from 'react';

export type SimulationPhase =
    | 'idle'
    | 'generating_input'
    | 'typing_input'
    | 'submitting'
    | 'party_a_audio'
    | 'waiting_party_b'
    | 'party_b_audio'
    | 'highlighting_a'
    | 'highlighting_a'
    | 'highlighting_b'
    | 'highlighting_b'
    | 'delay_a'
    | 'delay_b';

export interface SimulationDelegate {
    // Core Actions
    predictNextMessage: (history: any[], summary: string) => Promise<string | null>;
    typeMessage: (text: string) => Promise<boolean>; // Returns true if completed, false if cancelled
    submitMessage: () => Promise<{ text: string, translations: Record<string, string> } | void>;
    waitForPartyBResponse: () => Promise<{ response: string, translations: Record<string, string> } | null>;

    // Audio Actions
    playPartyAAudio: (text: string, translations: Record<string, string>) => Promise<void>;
    playPartyBAudio: (text: string, translations: Record<string, string>) => Promise<void>;

    // Visual Actions
    highlightText: (text: string, role: 'party_a' | 'party_b', wpm: number) => Promise<void>;
    waitWithCountdown: (role: 'party_a' | 'party_b', ms: number) => Promise<void>;

    // Utils
    addToHistory: (role: 'party_a' | 'party_b', content: string) => void;
    warmupAudio?: () => void;
}

export interface UseSimulationManagerProps {
    delegate: SimulationDelegate;
    maxCycles?: number;
    playbackMode: 'audio' | 'highlight' | 'manual';
    delayMultiplier: number;
    readingSpeed: number; // needed for calc
}

export function useSimulationManager({ delegate, maxCycles = 5, playbackMode, delayMultiplier, readingSpeed }: UseSimulationManagerProps) {
    const [state, setState] = useState({
        isRunning: false,
        isPaused: false,
        phase: 'idle' as SimulationPhase,
        cycleCount: 0,
        currentTypingText: '', // For UI display
        highlightTarget: null as 'party_a' | 'party_b' | null,
    });

    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    const delegateRef = useRef(delegate);
    useEffect(() => { delegateRef.current = delegate; }, [delegate]);

    // Refs for settings to ensure immediate updates in loop
    const modeRef = useRef(playbackMode);
    useEffect(() => { modeRef.current = playbackMode; }, [playbackMode]);

    const speedRef = useRef(readingSpeed);
    useEffect(() => { speedRef.current = readingSpeed; }, [readingSpeed]);

    const delayRef = useRef(delayMultiplier);
    useEffect(() => { delayRef.current = delayMultiplier; }, [delayMultiplier]);

    const cancelRef = useRef(false);

    // ============================================================================
    // Helper: Wait / Checks
    // ============================================================================
    const waitIfPaused = async () => {
        while (stateRef.current.isPaused && !cancelRef.current) {
            await new Promise(r => setTimeout(r, 200));
        }
    };

    const safeDelay = async (ms: number) => {
        if (cancelRef.current) return;
        await new Promise(r => setTimeout(r, ms));
    };

    // ============================================================================
    // Main Loop
    // ============================================================================
    const runSimulationLoop = useCallback(async () => {
        console.log('🏁 Simulation Loop Started');

        let currentCycle = 0;

        try {
            while (stateRef.current.isRunning && !cancelRef.current) {
                await waitIfPaused();
                if (cancelRef.current) break;

                // ------------------------------------------------------------
                // Phase 1: Predict / Generate Next Message for Party A
                // ------------------------------------------------------------
                setState(prev => ({ ...prev, phase: 'generating_input' }));
                console.log('Phase: Generating Input');

                // We'll let the delegate handle history/summary logic
                // But generally we might want to pass the *current local history* if we managed it here.
                // For now, assume delegate can access the history it needs (e.g. from props or by passed arg).
                // Let's rely on delegate's internal access to history for prediction.

                const nextMessage = await delegateRef.current.predictNextMessage([], ''); // Args handled by delegate implementation

                if (!nextMessage || cancelRef.current) {
                    console.log('⚠️ No message generated or cancelled');
                    break;
                }

                stateRef.current.cycleCount = currentCycle + 1; // Update ref count logic if needed or just use local
                setState(prev => ({ ...prev, cycleCount: currentCycle + 1 }));

                // ------------------------------------------------------------
                // Phase 2: Type Message
                // ------------------------------------------------------------
                setState(prev => ({ ...prev, phase: 'typing_input' }));
                console.log('Phase: Typing Input');

                const typingFinished = await delegateRef.current.typeMessage(nextMessage);
                if (!typingFinished || cancelRef.current) break;

                // ------------------------------------------------------------
                // Phase 3: Submit & Party A Audio
                // ------------------------------------------------------------
                setState(prev => ({ ...prev, phase: 'submitting' }));
                console.log('Phase: Submitting');

                delegateRef.current.addToHistory('party_a', nextMessage);
                const submissionResult = await delegateRef.current.submitMessage();

                await waitIfPaused();
                if (cancelRef.current) break;

                const currentMode = modeRef.current;
                const currentSpeed = speedRef.current;
                const currentDelayMult = delayRef.current;

                // Audio or Highlight or Delay
                if (currentMode === 'audio' && submissionResult) {
                    setState(prev => ({ ...prev, phase: 'party_a_audio' }));
                    await delegateRef.current.playPartyAAudio(submissionResult.text, submissionResult.translations);
                } else if (currentMode === 'highlight') {
                    setState(prev => ({ ...prev, phase: 'highlighting_a', highlightTarget: 'party_a' }));
                    await delegateRef.current.highlightText(nextMessage, 'party_a', currentSpeed);
                    setState(prev => ({ ...prev, highlightTarget: null }));
                } else if (currentMode === 'manual') {
                    setState(prev => ({ ...prev, phase: 'delay_a' }));
                    // Just wait based on text length * delayMultiplier
                    const wordCount = nextMessage.split(' ').length;
                    const baseDelay = wordCount * 200; // 200ms per word rough base ~300wpm
                    const delay = baseDelay * currentDelayMult;
                    await delegateRef.current.waitWithCountdown('party_a', Math.max(1000, delay));
                }

                await safeDelay(500);
                if (cancelRef.current) break;

                // ------------------------------------------------------------
                // Phase 4: Wait for Party B Response
                // ------------------------------------------------------------
                setState(prev => ({ ...prev, phase: 'waiting_party_b' }));
                console.log('Phase: Waiting for Party B');

                const partyBResult = await delegateRef.current.waitForPartyBResponse();
                if (!partyBResult || cancelRef.current) {
                    console.log('⚠️ Party B did not respond');
                    // Potentially continue or break? Breaking is safer.
                    break;
                }

                delegateRef.current.addToHistory('party_b', partyBResult.response);

                // ------------------------------------------------------------
                // Phase 5: Party B Audio
                // ------------------------------------------------------------
                const currentModeB = modeRef.current;
                const currentSpeedB = speedRef.current;
                const currentDelayMultB = delayRef.current;

                if (currentModeB === 'audio') {
                    setState(prev => ({ ...prev, phase: 'party_b_audio' }));
                    await delegateRef.current.playPartyBAudio(partyBResult.response, partyBResult.translations);
                } else if (currentModeB === 'highlight') {
                    setState(prev => ({ ...prev, phase: 'highlighting_b', highlightTarget: 'party_b' }));
                    await delegateRef.current.highlightText(partyBResult.response, 'party_b', currentSpeedB);
                    setState(prev => ({ ...prev, highlightTarget: null }));
                } else if (currentModeB === 'manual') {
                    setState(prev => ({ ...prev, phase: 'delay_b' }));
                    const wordCount = partyBResult.response.split(' ').length;
                    const baseDelay = wordCount * 200;
                    const delay = baseDelay * currentDelayMultB;
                    await delegateRef.current.waitWithCountdown('party_b', Math.max(1000, delay));
                }

                currentCycle++;
                if (currentCycle >= maxCycles) {
                    console.log('🛑 Max cycles reached');
                    break;
                }

                await safeDelay(1000);
            }
        } catch (e) {
            console.error('Simulation Loop Error:', e);
        } finally {
            console.log('🛑 Simulation Ended');
            cancelRef.current = false;
            setState(prev => ({ ...prev, isRunning: false, phase: 'idle', highlightTarget: null }));
        }
    }, [maxCycles]);

    // ============================================================================
    // Controls
    // ============================================================================
    const start = useCallback(() => {
        if (stateRef.current.isRunning) return;

        cancelRef.current = false;
        setState(prev => ({ ...prev, isRunning: true, isPaused: false, cycleCount: 0 }));

        // Warmup
        delegateRef.current.warmupAudio?.();

        // Launch Loop
        setTimeout(runSimulationLoop, 0);
    }, [runSimulationLoop]);

    const stop = useCallback(() => {
        cancelRef.current = true;
        setState(prev => ({ ...prev, isRunning: false, phase: 'idle' }));
    }, []);

    const pause = useCallback(() => {
        setState(prev => ({ ...prev, isPaused: true }));
    }, []);

    const resume = useCallback(() => {
        setState(prev => ({ ...prev, isPaused: false }));
    }, []);

    const toggle = useCallback(() => {
        if (stateRef.current.isRunning) {
            if (stateRef.current.isPaused) resume();
            else pause();
        } else {
            start();
        }
    }, [start, pause, resume]);

    return {
        state: state,
        actions: { start, stop, pause, resume, toggle }
    };
}
