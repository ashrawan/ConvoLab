import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { AudioVisualizer } from '@/components/shared/AudioVisualizer';
import { getApiUrl } from '@/lib/config/api';
import { sendEvent } from '@/lib/analytics';

// Inline SVGs to avoid dependency issues
const SparklesIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
);

const LoaderIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

const ArrowRightIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </svg>
);

const MicIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const ShuffleIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M18 15L21 18M21 18L18 21M21 18H18.5689C17.6297 18 17.1601 18 16.7338 17.8705C16.3564 17.7559 16.0054 17.5681 15.7007 17.3176C15.3565 17.0348 15.096 16.644 14.575 15.8626L14.3333 15.5M18 3L21 6M21 6L18 9M21 6H18.5689C17.6297 6 17.1601 6 16.7338 6.12945C16.3564 6.24406 16.0054 6.43194 15.7007 6.68236C15.3565 6.96523 15.096 7.35597 14.575 8.13744L9.42496 15.8626C8.90398 16.644 8.64349 17.0348 8.29933 17.3176C7.99464 17.5681 7.64357 17.7559 7.2662 17.8705C6.83994 18 6.37033 18 5.43112 18H3M3 6H5.43112C6.37033 6 6.83994 6 7.2662 6.12945C7.64357 6.24406 7.99464 6.43194 8.29933 6.68236C8.64349 6.96523 8.90398 7.35597 9.42496 8.13744L9.66667 8.5" stroke="currentColor" />
    </svg>
);

interface PartySettings {
    context: string;
    languages: string[];
}

export interface ContextResponse {
    party_a: PartySettings;
    party_b: PartySettings;
}

interface ContextInputProps {
    onContextSet: (data: ContextResponse) => void;
    className?: string;
    isAutoPlaying?: boolean;
    isAutoPlayPaused?: boolean;
    onAutoPlayToggle?: () => void;
    autoplayCount?: number;
    maxAutoplayCount?: number;
}

export const ConvoContextInput: React.FC<ContextInputProps> = ({
    onContextSet,
    className,
    isAutoPlaying = false,
    isAutoPlayPaused = false,
    onAutoPlayToggle,
    autoplayCount,
    maxAutoplayCount
}) => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [submittedText, setSubmittedText] = useState('');

    const { isRecording, startRecording, stopRecording, mediaStream, error: audioError } = useAudioRecorder();
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);

    const handleSurpriseMe = async () => {
        setIsLoading(true);
        try {
            // Use dedicated endpoint for random scenarios to avoid roleplay bias
            const response = await fetch(getApiUrl('/api/ai/scenario/random'), {
                headers: {
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            if (!response.ok) throw new Error('Failed to generate context');

            const data = await response.json();

            if (data.scenario) {
                setInput(data.scenario);
                sendEvent({
                    action: 'conversation_spark',
                    params: { method: 'surprise_me' }
                });
            } else {
                throw new Error('Invalid response format');
            }

        } catch (err: any) {
            console.error(err);
            const fallbacks = ["Discussing travel plans", "Ordering food at a restaurant", "Talking about hobbies"];
            setInput(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(getApiUrl('/api/ai/context'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ text: input }),
            });

            if (!response.ok) {
                throw new Error('Failed to set context');
            }

            const data: ContextResponse = await response.json();
            onContextSet(data);
            setSubmittedText(input);
            setIsCollapsed(true);

            sendEvent({
                action: 'context_submitted',
                params: {
                    method: 'manual',
                    char_count: input.length
                }
            });

        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMicClick = async () => {
        if (isRecording) {
            // STOP Recording & Process
            setIsProcessingAudio(true);
            try {
                const blob = await stopRecording();
                if (blob) {
                    // Send to backend Whisper API
                    const formData = new FormData();
                    formData.append('audio', blob, 'recording.webm');

                    const res = await fetch(getApiUrl('/api/audio/stt'), {
                        method: 'POST',
                        headers: {
                            'ngrok-skip-browser-warning': 'true'
                        },
                        body: formData,
                    });

                    if (!res.ok) throw new Error('Transcription failed');

                    const data = await res.json();
                    if (data.text) {
                        setInput(prev => (prev ? `${prev} ${data.text}` : data.text));
                    }
                }
            } catch (err: any) {
                console.error('Mic processing error:', err);
                setError('Failed to process audio');
            } finally {
                setIsProcessingAudio(false);
            }
        } else {
            // START Recording
            setError(null);
            await startRecording();
        }
    };

    // Collapsed View
    if (isCollapsed) {
        return (
            <div className={`relative w-full max-w-2xl mx-auto mb-6 group ${className || ''}`}>
                <div className="flex items-center justify-center gap-2 bg-[#1E1E1F] border border-white/10 rounded-full px-4 py-3">
                    {/* Context Text - Clickable to Edit */}
                    <div
                        onClick={() => {
                            setIsCollapsed(false);
                            setInput(submittedText);
                        }}
                        className="flex items-center gap-3 flex-1 cursor-pointer hover:bg-white/5 rounded-full px-2 py-1 transition-all min-w-0"
                    >
                        <SparklesIcon className="w-4 h-4 text-purple-400 shrink-0" />
                        <span className="text-gray-300 text-xs md:text-sm font-light truncate">
                            {submittedText}
                        </span>
                        <span className="text-[10px] md:text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-md hover:bg-white/10 transition-colors shrink-0">
                            Edit
                        </span>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-6 bg-white/10" />

                    {/* Auto-Play Button */}
                    {onAutoPlayToggle && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAutoPlayToggle();
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${isAutoPlaying && !isAutoPlayPaused
                                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            {isAutoPlaying && !isAutoPlayPaused ? (
                                <>
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <rect x="6" y="4" width="4" height="16" rx="1" />
                                        <rect x="14" y="4" width="4" height="16" rx="1" />
                                    </svg>
                                    <span className="text-xs font-medium">Pause</span>
                                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                    <span className="text-xs font-medium">
                                        {isAutoPlayPaused ? 'Resume' : 'Auto-Play'}
                                    </span>
                                </>
                            )}
                        </button>
                    )}

                    {/* Auto-Play Count Indicator */}
                    {isAutoPlaying && autoplayCount !== undefined && maxAutoplayCount !== undefined && (
                        <>
                            <div className="w-px h-6 bg-white/10" />
                            <div className="relative group/counter">
                                <div className="px-2 py-1 text-[10px] font-mono font-medium text-gray-400 bg-white/5 rounded-md border border-white/5 cursor-help">
                                    {autoplayCount}/{maxAutoplayCount}
                                </div>
                                {/* Hover Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 border border-white/10 rounded-md text-[10px] text-gray-300 font-medium opacity-0 group-hover/counter:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl z-50">
                                    after {maxAutoplayCount - autoplayCount} messages auto-play will pause
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Expanded View
    return (
        <form
            onSubmit={handleSubmit}
            className={`relative w-full mx-auto group ${className || ''}`}
        >
            {/* Ambient Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-purple-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            <div className={`relative flex items-center bg-[#1E1E1F] border transition-all duration-300 rounded-full shadow-lg overflow-hidden ${isRecording ? 'border-blue-400/50 bg-[#151a25]' : 'border-white/10 hover:border-white/20 focus-within:border-purple-500/30'}`}>
                {/* Icon / Status */}
                <div className="pl-3 md:pl-5 text-purple-400">
                    <SparklesIcon className="w-4 h-4 md:w-5 md:h-5 opacity-80" />
                </div>

                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                        isProcessingAudio ? "Processing audio..." :
                            isLoading ? (input ? "Setting context..." : "Generating context...") :
                                isRecording ? "Listening..." :
                                    "Lets have a conversation... "
                    }
                    className="flex-1 bg-transparent border-none placeholder-gray-500 px-3 py-3 md:px-4 md:py-4 focus:outline-none focus:ring-0 text-sm md:text-base font-light tracking-wide text-white transition-colors duration-300"
                    disabled={isLoading || isProcessingAudio}
                    autoFocus
                />

                {/* Audio Visualizer - Centered absolutely */}
                <AudioVisualizer
                    stream={mediaStream}
                    isRecording={isRecording}
                    className="opacity-60 mix-blend-screen"
                />

                {/* Right Actions */}
                <div className="pr-2 flex items-center gap-1">
                    {/* Cancel Button (Visible only when Recording) */}
                    {isRecording && (
                        <button
                            type="button"
                            onClick={async () => {
                                // Just stop and reset, don't process
                                await stopRecording(); // Just to clean up streams
                                setInput(''); // Clear input
                            }}
                            className="p-2 md:p-3 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-all duration-300"
                            title="Cancel Recording"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    )}

                    {/* Surprise / Remix Button */}
                    {!isRecording && (
                        <button
                            type="button"
                            onClick={handleSurpriseMe}
                            disabled={isLoading || isProcessingAudio}
                            className="p-2 md:p-3 rounded-full hover:bg-white/5 text-gray-400 hover:text-purple-400 transition-all duration-300 group/surprise"
                            title={input ? "Remix this idea" : "Feeling Lucky (Conversation Context)"}
                        >
                            <ShuffleIcon className="transition-transform duration-700 group-hover/surprise:rotate-180" />
                        </button>
                    )}

                    {/* Mic/Process Button */}
                    <button
                        type="button"
                        onClick={handleMicClick}
                        disabled={isLoading || isProcessingAudio}
                        className={`p-2 md:p-3 rounded-full transition-all duration-300 ${isRecording
                            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                            : 'hover:bg-white/5 text-gray-400 hover:text-white'
                            }`}
                        title={isRecording ? "Finish & Process" : "Start Voice Input"}
                    >
                        {isProcessingAudio ? (
                            <LoaderIcon className="animate-spin text-purple-500" />
                        ) : isRecording ? (
                            <CheckIcon />
                        ) : (
                            <MicIcon />
                        )}
                    </button>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading || isRecording}
                        className="p-2 md:p-3 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 transform ml-1"
                    >
                        {isLoading ? (
                            <LoaderIcon className="animate-spin" />
                        ) : (
                            <ArrowRightIcon />
                        )}
                    </button>
                </div>

                {/* Loading Bar */}
                {(isLoading || isProcessingAudio) && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-transparent pointer-events-none">
                        <motion.div
                            className="h-full bg-gradient-to-r from-transparent via-purple-500 to-transparent"
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        />
                    </div>
                )}
            </div>

            {(error || audioError) && (
                <div className="absolute top-full left-0 right-0 mt-3 flex justify-center">
                    <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                        {error || audioError}
                    </span>
                </div>
            )}
        </form>
    );
};
