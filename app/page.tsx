'use client';

import React, { useRef, useEffect, useState } from 'react';
import PartyAPanel from '@/components/party-a/PartyAPanel';
import PartyBPanel from '@/components/party-b/PartyBPanel';
import { TTSSettings } from '@/components/shared/TTSSettings';
import { ConvoContextInput } from '@/components/shared/ConvoContextInput';
import { Footer } from '@/components/shared/Footer';
import { usePartyA } from '@/hooks/usePartyA';
import { usePartyB } from '@/hooks/usePartyB';
import { useAudioController } from '@/hooks/useAudioController';
import { useSimulationManager, SimulationDelegate } from '@/hooks/useSimulationManager';
import { chatService } from '@/lib/services/llm';
import { sequentialAudioPlayer } from '@/lib/utils/audio-player';

// ============================================================================
// Two-Party Human ↔ AI Communication Interface
// ============================================================================

export default function Home() {
  // ============================================================================
  // Common Logic (Autoplay Policy)
  // ============================================================================
  const hasUserInteractedRef = useRef<boolean>(false);

  useEffect(() => {
    const markInteraction = () => {
      if (!hasUserInteractedRef.current) {
        console.log('👆 User interaction detected - autoplay enabled');
        hasUserInteractedRef.current = true;
      }
    };
    window.addEventListener('click', markInteraction, { once: true });
    window.addEventListener('keydown', markInteraction, { once: true });
    window.addEventListener('touchstart', markInteraction, { once: true });
    return () => {
      window.removeEventListener('click', markInteraction);
      window.removeEventListener('keydown', markInteraction);
      window.removeEventListener('touchstart', markInteraction);
    };
  }, []);

  // ============================================================================
  // State & Logic Wiring (Hooks)
  // ============================================================================

  // Auto-play setting (enabled by default)
  // Auto-play setting (enabled by default)
  const [playbackMode, setPlaybackMode] = useState<'audio' | 'highlight' | 'manual'>('audio');
  const [delayMultiplier, setDelayMultiplier] = useState(2);
  const [pauseMicOnAudio, setPauseMicOnAudio] = useState(true);
  const [readingSpeed, setReadingSpeed] = useState(180); // WPM
  const [showTypingEffect, setShowTypingEffect] = useState(true);
  const [autoPlayActive, setAutoPlayActive] = useState(false);

  // 5. Initialize Auto-Play Mode (Order matters: defined here to use state below, but needs careful ordering with usePartyA)
  // Actually, we need to pass `isRunning` to usePartyA, but `useAutoPlay` isn't initialized yet.
  // Cyclic dependency solution: Use a separate state for isAutoPlaying or ref.
  // We already have `autoPlayActive` state synced from `autoPlayMode.state.isRunning`.
  // Use `autoPlayActive` to control the props passed to Party A/B.

  // 1. Initialize Party A (Human Input)
  // Pass isSimulationControlled=autoPlayActive so hooks skip auto-play when simulation controls playback
  const partyA = usePartyA(playbackMode, readingSpeed, pauseMicOnAudio, autoPlayActive);

  // 2. Initialize Party B (AI Output)
  const partyB = usePartyB(
    partyA.state.input,
    partyA.state.languages[0] || 'en',
    hasUserInteractedRef.current,
    playbackMode,
    readingSpeed,
    autoPlayActive // isSimulationControlled
  );

  // 3. Logic Bridge: Connect Party A Submission to Party B Generation
  // AND Manage History for Manual Interactions
  const prevIsGeneratingRef = useRef(false);

  useEffect(() => {
    // 1. Handle Party A Submission
    if (partyA.state.submission) {
      const text = partyA.state.submission.text;
      if (text) {
        // If MANUAL input (not auto-play), add to history
        // If MANUAL input (not auto-play), add to history
        if (!simulationManager.state.isRunning) {
          conversationHistoryRef.current.push({ role: 'party_a', content: text });
        }

        // Generate Party B response with full context & history
        partyB.actions.generateResponse(
          text,
          conversationHistoryRef.current, // Shared history
          partyA.state.context // Party A context
        );
      }
    }
  }, [partyA.state.submission]);

  // 2. Handle Party B Completion (Add to History)
  useEffect(() => {
    const wasGenerating = prevIsGeneratingRef.current;
    const isGenerating = partyB.state.isGenerating;

    if (wasGenerating && !isGenerating) {
      // Just finished generating
      // Just finished generating
      if (partyB.state.response) {
        if (!simulationManager.state.isRunning) {
          conversationHistoryRef.current.push({ role: 'party_b', content: partyB.state.response });
        }
      }
    }

    prevIsGeneratingRef.current = isGenerating;
  }, [partyB.state.isGenerating, partyB.state.response]);

  // 4. Initialize Audio Controller (Pause Mic on Audio)
  useAudioController(partyA.actions.startAudio, pauseMicOnAudio, setPauseMicOnAudio);

  // 5. Initialize Simulation Manager
  // ============================================================================

  // History for Simulation Context
  const conversationHistoryRef = useRef<{ role: string, content: string }[]>([]);

  // Refs for Party B state (for proper polling in waitForPartyBResponse)
  const partyBResponseRef = useRef(partyB.state.response);
  const partyBIsGeneratingRef = useRef(partyB.state.isGenerating);
  const partyBIsTranslatingRef = useRef(partyB.state.isTranslating);
  const partyBTranslationsRef = useRef(partyB.state.translations);

  useEffect(() => {
    partyBResponseRef.current = partyB.state.response;
    partyBIsGeneratingRef.current = partyB.state.isGenerating;
    partyBIsTranslatingRef.current = partyB.state.isTranslating;
    partyBTranslationsRef.current = partyB.state.translations;
  }, [partyB.state.response, partyB.state.isGenerating, partyB.state.isTranslating, partyB.state.translations]);

  // Typing Sound
  const typingSoundRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    // Only client-side
    if (typeof window !== 'undefined') {
      typingSoundRef.current = new Audio('/sounds/keyboard-typing.mp3');
      typingSoundRef.current.loop = true;
      typingSoundRef.current.volume = 0.4;
    }
  }, []);

  const delegate: SimulationDelegate = {
    predictNextMessage: async (history, summary) => {
      // We use the local ref history + context
      try {
        // Construct prompt similar to useAutoPlay logic
        const currentHistory = conversationHistoryRef.current;
        const response = await chatService.generateNextMessage({
          party_a_context: partyA.state.context,
          party_b_context: partyB.state.context, // Party B context is what Party A is "reacting" to in a way? No, Party A just talks.
          // Actually, for "Auto Play", we want Party A to generate a message relevant to the conversation.
          // usage: generateNextMessage(params)
          // params: { system_prompt?, history, ... }

          // Let's rely on the service ability or default logic.
          // We need to pass the history.
          party_a_lang: partyA.state.languages[0] || 'en',
          history: currentHistory.map(h => ({
            role: h.role === 'party_a' ? 'user' : 'model',
            content: h.content
          }))
        });
        return response.message;
      } catch (e) {
        console.error("Prediction failed", e);
        return null;
      }
    },
    typeMessage: async (text) => {
      // Simple typing effect
      if (!text) return true;
      if (!isSimulationRunningRef.current) return false;

      if (!showTypingEffect) {
        partyA.actions.setInput(text);
        return true;
      }

      // Play Sound
      if (typingSoundRef.current) {
        try {
          typingSoundRef.current.currentTime = 0;
          await typingSoundRef.current.play();
        } catch (e) { console.warn("Audio play failed", e); }
      }

      const msPerChar = 60000 / (readingSpeed * 5); // Rough WPM to char delay
      let current = '';
      for (let i = 0; i < text.length; i++) {
        if (!isSimulationRunningRef.current) break;
        current += text[i];
        partyA.actions.setInput(current);
        // Check for randomness or strict speed
        await new Promise(r => setTimeout(r, msPerChar));
      }

      // Stop Sound
      if (typingSoundRef.current) {
        typingSoundRef.current.pause();
        typingSoundRef.current.currentTime = 0;
      }

      return isSimulationRunningRef.current;
    },
    submitMessage: async () => {
      return partyA.actions.handleManualSubmit();
    },
    getPartyBResponse: () => {
      return partyBResponseRef.current;
    },
    waitForPartyBResponse: async (previousResponse: string) => {
      // Poll for Party B response completion checking against previous known state
      // This handles cases where response generation might be extremely fast or already in progress
      console.log(`Waiting for Party B response... (Previous: "${previousResponse.substring(0, 20)}...")`);

      let attempts = 0;
      while (attempts < 600) { // 60s timeout
        const currentResponse = partyBResponseRef.current;
        const isGenerating = partyBIsGeneratingRef.current;
        const isTranslating = partyBIsTranslatingRef.current;

        // Check if we have a NEW response (different from previous) and generation/translation is complete
        // Also check if currentResponse is truthy/valid
        if (currentResponse && !isGenerating && !isTranslating && currentResponse !== previousResponse) {
          console.log(`Got new Party B response: "${currentResponse.substring(0, 20)}..."`);
          return { response: currentResponse, translations: partyBTranslationsRef.current };
        }
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      return null;
    },
    playPartyAAudio: async (text, translations) => {
      await partyA.actions.playSequence(text, translations);
    },
    playPartyBAudio: async (text, translations) => {
      await partyB.actions.playSequence(text, translations);
    },
    highlightText: async (text, role, wpm) => {
      if (role === 'party_a') {
        await partyA.actions.simulatePlayback(text, wpm, 'lastSent');
      } else {
        await partyB.actions.simulatePlayback(text, wpm, 'response');
      }
    },
    waitWithCountdown: async (role, ms) => {
      const setStatus = role === 'party_a' ? partyA.actions.setCustomStatus : partyB.actions.setCustomStatus;
      const startTime = Date.now();

      while (Date.now() - startTime < ms) {
        // Double check cancellation
        if (!isSimulationRunningRef.current) break;

        const remainingSec = Math.ceil((ms - (Date.now() - startTime)) / 1000);
        setStatus(`Reading... (${remainingSec}s)`);
        await new Promise(r => setTimeout(r, 200));
      }
      setStatus(null);
    },
    addToHistory: (role, content) => {
      conversationHistoryRef.current.push({ role, content });
      // If we wanted to expose this to the UI, we'd need a state.
      // For now, it's internal to the simulation flow.
    },
    warmupAudio: () => {
      sequentialAudioPlayer.resumeContext();
    }
  };

  var isSimulationRunningRef = useRef(false);

  const simulationManager = useSimulationManager({
    delegate,
    playbackMode,
    delayMultiplier,
    readingSpeed,
    maxCycles: 10 // Default
  });

  // Keep Ref in sync
  useEffect(() => {
    isSimulationRunningRef.current = simulationManager.state.isRunning;

    // If we just stopped, ensure we kill any active highlight/delay on parties
    if (!simulationManager.state.isRunning) {
      partyA.actions.stopSimulation();
      partyB.actions.stopSimulation();
    }
  }, [simulationManager.state.isRunning]);

  // 6. Sync auto-play active state
  useEffect(() => {
    setAutoPlayActive(simulationManager.state.isRunning);
  }, [simulationManager.state.isRunning]);

  // 7. Global Warmup Listener
  useEffect(() => {
    const handleWarmup = () => {
      // Unlock audio engines
      sequentialAudioPlayer.resumeContext();
    };

    window.addEventListener('click', handleWarmup, { once: true });
    window.addEventListener('touchstart', handleWarmup, { once: true });
    window.addEventListener('keydown', handleWarmup, { once: true });

    return () => {
      window.removeEventListener('click', handleWarmup);
      window.removeEventListener('touchstart', handleWarmup);
      window.removeEventListener('keydown', handleWarmup);
    };
  }, []);

  // Determine highlight target and indices
  const highlightTarget = simulationManager.state.highlightTarget;
  // We aren't implementing granular word highlighting in the manager yet, so these can be null or simple.
  // The simulation state has highlightTarget.


  // ============================================================================
  // Helpers
  // ============================================================================

  const handleContextSet = (data: any) => {
    // 0. Reset State (Clean Slate)
    simulationManager.actions.stop();
    // Clear history ref
    conversationHistoryRef.current = [];

    partyA.actions.stopAllAudio();
    partyB.actions.stopAllAudio();
    partyA.actions.reset();
    partyB.actions.reset();

    // 1. Update Party A
    if (data.party_a) {
      partyA.actions.setContext(data.party_a.context);
      if (data.party_a.languages && data.party_a.languages.length > 0) {
        partyA.actions.setLanguages(data.party_a.languages);
      }
    }

    // 2. Update Party B
    if (data.party_b) {
      partyB.actions.setContext(data.party_b.context);
      if (data.party_b.languages && data.party_b.languages.length > 0) {
        partyB.actions.setLanguages(data.party_b.languages);
      }
    }
  };

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <main className="h-screen bg-background text-foreground flex flex-col overflow-y-auto lg:overflow-hidden font-sans selection:bg-primary/30">
      {/* Minimal Header */}
      {/* Minimal Header */}
      {/* Unified Header & Context Input */}
      <div className="sticky top-0 z-50 pt-4 pb-4 px-3 md:px-8 bg-background/95 backdrop-blur-xl border-b border-border">
        <ConvoContextInput
          onContextSet={handleContextSet}
          className="shadow-2xl shadow-primary/10"
          isAutoPlaying={simulationManager.state.isRunning}
          isAutoPlayPaused={simulationManager.state.isPaused}
          onAutoPlayToggle={() => {
            simulationManager.actions.toggle();
          }}
          autoplayCount={simulationManager.state.cycleCount}
          maxAutoplayCount={10}

          // Left: Brand
          brandContent={
            <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
              {/* Desktop Logo */}
              <div className="hidden md:flex items-center gap-3">
                <img src="/icon.svg" alt="ConvoLab Logo" className="w-6 h-6 rounded-md shadow-[0_0_15px_rgba(139,92,246,0.4)]" />
                <h1 className="text-base font-semibold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                  Convo Lab
                </h1>
              </div>
              {/* Mobile Logo */}
              <div className="md:hidden flex items-center">
                <h1 className="text-sm font-bold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                  CL
                </h1>
              </div>
            </div>
          }

          // Right: Settings
          rightContent={
            <div className="flex items-center gap-4">
              <TTSSettings
                pauseMicOnAudio={pauseMicOnAudio}
                onPauseMicChange={setPauseMicOnAudio}
                playbackMode={playbackMode}
                onPlaybackModeChange={setPlaybackMode}
                readingSpeed={readingSpeed}
                onReadingSpeedChange={setReadingSpeed}
                delayMultiplier={delayMultiplier}
                onDelayMultiplierChange={setDelayMultiplier}
                showTypingEffect={showTypingEffect}
                onShowTypingEffectChange={setShowTypingEffect}
              />
              <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
                <span className="text-sm opacity-70">👤</span>
              </div>
            </div>
          }
        />
      </div>

      {/* Main Content - Two Column Split (Always Side-by-Side) */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* PARTY A (HUMAN) - LEFT SIDE */}
        <PartyAPanel
          context={partyA.state.context}
          onContextChange={partyA.actions.setContext}
          languages={partyA.state.languages}
          onLanguagesChange={partyA.actions.setLanguages}
          audioEnabledLanguages={partyA.state.audioEnabledLanguages}
          onAudioEnabledChange={partyA.actions.setAudioEnabledLanguages}
          currentlyPlayingKey={partyA.state.playbackState?.key || null}
          highlightedWordIndex={partyA.state.playbackState?.wordIndex ?? -1}
          input={partyA.state.input}
          onInputChange={partyA.actions.handleInput}
          onSubmit={() => {
            partyA.actions.handleManualSubmit();
          }}
          audioActive={partyA.state.audioActive}
          onToggleAudio={() => {
            sequentialAudioPlayer.resumeContext();
            if (partyA.state.audioActive) {
              partyA.actions.stopAudio();
            } else {
              partyA.actions.startAudio();
            }
          }}
          audioTranscript={partyA.state.audioTranscript}
          lastSubmission={partyA.state.submission}
          buildMode={partyA.state.buildMode}
          onBuildModeToggle={() => partyA.actions.setBuildMode(!partyA.state.buildMode)}
          predictions={partyA.state.predictions}
          isLoadingPredictions={partyA.state.isLoading}
          onSelectPhrase={(phrase) => {
            if (simulationManager.state.isRunning) simulationManager.actions.stop();
            partyA.actions.handleWordSelect(phrase);
          }}
          translations={partyA.state.translations}
          lastSentTranslations={partyA.state.lastSentTranslations}
          isTranslating={partyA.state.isTranslating}
          onPlayAudio={(text, lang, key) => {
            partyA.actions.playAudio(text, lang, key);
          }}
          onStopAudio={() => {
            partyA.actions.stopAllAudio();
            if (simulationManager.state.isRunning) simulationManager.actions.stop();
          }}
          images={partyA.state.images}
          videoActive={partyA.state.videoActive}
          onVideoToggle={partyA.actions.toggleVideo}
          videoRef={partyA.state.videoRef}
          isPhrasesCollapsed={partyA.state.isPhrasesCollapsed}
          onTogglePhrases={() => partyA.actions.setIsPhrasesCollapsed(!partyA.state.isPhrasesCollapsed)}
          isTranslationsCollapsed={partyA.state.isTranslationsCollapsed}
          onToggleTranslations={() => partyA.actions.setIsTranslationsCollapsed(!partyA.state.isTranslationsCollapsed)}
          customStatus={partyA.state.customStatus}
        />

        {/* PARTY B (AI) - RIGHT SIDE */}
        <PartyBPanel
          context={partyB.state.context}
          onContextChange={partyB.actions.setContext}
          languages={partyB.state.languages}
          onLanguagesChange={partyB.actions.setLanguages}
          audioEnabledLanguages={partyB.state.audioEnabledLanguages}
          onAudioEnabledChange={partyB.actions.setAudioEnabledLanguages}
          currentlyPlayingKey={partyB.state.playbackState?.key || null}
          highlightedWordIndex={partyB.state.playbackState?.wordIndex ?? -1}
          response={partyB.state.response}
          isGenerating={partyB.state.isGenerating}
          translations={partyB.state.translations}
          isTranslating={partyB.state.isTranslating}
          onPlayAudio={partyB.actions.playAudio}
          onStopAudio={partyB.actions.stopAllAudio}
          customStatus={partyB.state.customStatus}
          suggestions={partyB.state.conversationSuggestions}
          isLoadingSuggestions={partyB.state.suggestionsLoading}
          onSelectSuggestion={(phrase) => {
            if (simulationManager.state.isRunning) simulationManager.actions.stop();
            partyA.actions.submitPhrase(phrase);
          }}
          images={partyB.state.images}
          videoActive={partyB.state.videoActive}
          videoRef={partyB.state.videoRef}
          isSparksCollapsed={partyB.state.isSparksCollapsed}
          onToggleSparks={() => partyB.actions.setIsSparksCollapsed(!partyB.state.isSparksCollapsed)}
          isTranslationsCollapsed={partyB.state.isTranslationsCollapsed}
          onToggleTranslations={() => partyB.actions.setIsTranslationsCollapsed(!partyB.state.isTranslationsCollapsed)}
        />
      </div>
      <Footer />
    </main>
  );
}
