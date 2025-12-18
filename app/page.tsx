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
import { useAutoPlay } from '@/hooks/useAutoPlay';

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
  const [autoPlay, setAutoPlay] = useState(true);
  const [pauseMicOnAudio, setPauseMicOnAudio] = useState(true);
  const [readingSpeed, setReadingSpeed] = useState(180); // WPM
  const [showTypingEffect, setShowTypingEffect] = useState(true);
  const [autoPlayActive, setAutoPlayActive] = useState(false);

  // 1. Initialize Party A (Human Input) - pass autoPlay and pauseMicOnAudio
  const partyA = usePartyA(autoPlay, pauseMicOnAudio);

  // 2. Initialize Party B (AI Output) - pass autoPlay and autoPlayActive to disable suggestions
  const partyB = usePartyB(
    partyA.state.input,
    partyA.state.languages[0] || 'en',
    hasUserInteractedRef.current,
    autoPlay,
    autoPlayActive
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
        if (!autoPlayMode.state.isRunning) {
          autoPlayMode.actions.addToHistory('party_a', text);
        }

        // Generate Party B response with full context & history
        partyB.actions.generateResponse(
          text,
          autoPlayMode.state.conversationHistory, // Shared history
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
      if (partyB.state.response) {
        autoPlayMode.actions.addToHistory('party_b', partyB.state.response);
      }
    }

    prevIsGeneratingRef.current = isGenerating;
  }, [partyB.state.isGenerating, partyB.state.response]);

  // 4. Initialize Audio Controller (Pause Mic on Audio)
  useAudioController(partyA.actions.startAudio, pauseMicOnAudio, setPauseMicOnAudio);

  // 5. Initialize Auto-Play Mode
  const autoPlayMode = useAutoPlay({
    partyAContext: partyA.state.context,
    partyBContext: partyB.state.context,
    partyBResponse: partyB.state.response, // Pass Party B response for highlighting
    partyALang: partyA.state.languages[0] || 'en',
    autoPlayAudio: autoPlay,
    readingSpeed,
    onSetInput: partyA.actions.setInput,
    onSubmit: partyA.actions.handleManualSubmit,
    isPartyBResponding: partyB.state.isGenerating,
    isPartyBTranslating: partyB.state.isTranslating,
    isAudioPlaying: !!partyB.state.currentlyPlayingKey,
    isPartyAAudioPlaying: !!partyA.state.currentlyPlayingKey,
    showTypingEffect
  });

  // 6. Sync auto-play active state
  useEffect(() => {
    setAutoPlayActive(autoPlayMode.state.isRunning);
  }, [autoPlayMode.state.isRunning]);

  // 7. Global Warmup Listener
  useEffect(() => {
    const handleWarmup = () => {
      // Unlock audio engines on first interaction
      autoPlayMode.actions.warmup();
    };

    window.addEventListener('click', handleWarmup, { once: true });
    window.addEventListener('touchstart', handleWarmup, { once: true });
    window.addEventListener('keydown', handleWarmup, { once: true });

    return () => {
      window.removeEventListener('click', handleWarmup);
      window.removeEventListener('touchstart', handleWarmup);
      window.removeEventListener('keydown', handleWarmup);
    };
  }, [autoPlayMode.actions.warmup]);

  // Determine highlight target and indices
  const highlightTarget = autoPlayMode.state.highlightTarget;
  const highlightIndex = autoPlayMode.state.highlightedWordIndex;
  const partyAHighlightIndex = highlightTarget === 'party_a' ? highlightIndex : -1;
  const partyBHighlightIndex = highlightTarget === 'party_b' ? highlightIndex : -1;

  // ============================================================================
  // Helpers
  // ============================================================================

  const handleContextSet = (data: any) => {
    // 0. Reset State (Clean Slate)
    autoPlayMode.actions.stop();
    autoPlayMode.actions.clearHistory();
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
    <main className="h-screen bg-[#0f0f10] text-white flex flex-col overflow-y-auto lg:overflow-hidden font-sans selection:bg-purple-500/30">
      {/* Minimal Header */}
      {/* Minimal Header */}
      {/* Unified Header & Context Input */}
      <div className="sticky top-0 z-50 pt-4 pb-4 px-3 md:px-8 bg-[#0f0f10]/95 backdrop-blur-xl border-b border-white/5">
        <ConvoContextInput
          onContextSet={handleContextSet}
          className="shadow-2xl shadow-purple-900/10"
          isAutoPlaying={autoPlayMode.state.isRunning}
          isAutoPlayPaused={autoPlayMode.state.isPaused}
          onAutoPlayToggle={() => {
            autoPlayMode.actions.warmup();
            autoPlayMode.actions.toggle();
          }}
          autoplayCount={autoPlayMode.state.count}
          maxAutoplayCount={autoPlayMode.state.maxCount}

          // Left: Brand
          brandContent={
            <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
              {/* Desktop Logo */}
              <div className="hidden md:flex items-center gap-3">
                <img src="/icon.svg" alt="ConvoLab Logo" className="w-6 h-6 rounded-md shadow-[0_0_15px_rgba(168,85,247,0.4)]" />
                <h1 className="text-base font-semibold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
                  Convo Lab
                </h1>
              </div>
              {/* Mobile Logo */}
              <div className="md:hidden flex items-center">
                <h1 className="text-sm font-bold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
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
                autoPlay={autoPlay}
                onAutoPlayChange={setAutoPlay}
                readingSpeed={readingSpeed}
                onReadingSpeedChange={setReadingSpeed}
                showTypingEffect={showTypingEffect}
                onShowTypingEffectChange={setShowTypingEffect}
              />
              <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
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
          currentlyPlayingKey={partyA.state.currentlyPlayingKey}
          highlightedWordIndex={partyAHighlightIndex}
          input={partyA.state.input}
          onInputChange={partyA.actions.handleInput}
          onSubmit={() => {
            autoPlayMode.actions.warmup();
            partyA.actions.handleManualSubmit();
          }}
          audioActive={partyA.state.audioActive}
          onToggleAudio={() => {
            autoPlayMode.actions.warmup();
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
            autoPlayMode.actions.warmup();
            partyA.actions.handleWordSelect(phrase);
          }}
          translations={partyA.state.translations}
          lastSentTranslations={partyA.state.lastSentTranslations}
          isTranslating={partyA.state.isTranslating}
          onPlayAudio={(text, lang, key) => {
            autoPlayMode.actions.warmup();
            partyA.actions.playAudio(text, lang, key);
          }}
          onStopAudio={() => {
            partyA.actions.stopAllAudio();
            if (autoPlayMode.state.isRunning) autoPlayMode.actions.stop();
          }}
          images={partyA.state.images}
          videoActive={partyA.state.videoActive}
          onVideoToggle={partyA.actions.toggleVideo}
          videoRef={partyA.state.videoRef}
          isPhrasesCollapsed={partyA.state.isPhrasesCollapsed}
          onTogglePhrases={() => partyA.actions.setIsPhrasesCollapsed(!partyA.state.isPhrasesCollapsed)}
          isTranslationsCollapsed={partyA.state.isTranslationsCollapsed}
          onToggleTranslations={() => partyA.actions.setIsTranslationsCollapsed(!partyA.state.isTranslationsCollapsed)}
        />

        {/* PARTY B (AI) - RIGHT SIDE */}
        <PartyBPanel
          context={partyB.state.context}
          onContextChange={partyB.actions.setContext}
          languages={partyB.state.languages}
          onLanguagesChange={partyB.actions.setLanguages}
          audioEnabledLanguages={partyB.state.audioEnabledLanguages}
          onAudioEnabledChange={partyB.actions.setAudioEnabledLanguages}
          currentlyPlayingKey={partyB.state.currentlyPlayingKey}
          highlightedWordIndex={partyBHighlightIndex}
          response={partyB.state.response}
          isGenerating={partyB.state.isGenerating}
          translations={partyB.state.translations}
          isTranslating={partyB.state.isTranslating}
          onPlayAudio={(text, lang, key) => {
            autoPlayMode.actions.warmup();
            partyB.actions.playAudio(text, lang, key);
          }}
          onStopAudio={() => {
            partyB.actions.stopAllAudio();
            if (autoPlayMode.state.isRunning) autoPlayMode.actions.stop();
          }}
          suggestions={partyB.state.conversationSuggestions}
          isLoadingSuggestions={partyB.state.suggestionsLoading}
          onSelectSuggestion={(phrase) => {
            autoPlayMode.actions.warmup();
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
