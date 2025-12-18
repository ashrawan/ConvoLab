'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PhrasePrediction } from '@/lib/services/llm';

interface PredictionGraphProps {
    currentWord: string;
    predictions: PhrasePrediction[];
    onWordSelect: (word: string) => void;
    isLoading: boolean;
    onTextInput: (text: string) => void;
    inputText: string;
}

/**
 * Standard, stable word “bubble” chart:
 * - Each word is a circle sized by probability
 * - Word + probability % inside
 * - No hover interactions (no flicker)
 * - Stable ordering and colors across streaming updates
 */
export default function PredictionGraph({
    currentWord,
    predictions,
    onWordSelect,
    isLoading,
    onTextInput,
    inputText,
}: PredictionGraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const orderRef = useRef<Map<string, number>>(new Map());
    const layoutRef = useRef<Array<{
        phrase: string;
        probability: number;
        x: number;
        y: number;
        r: number;
        fill: string;
        pct: string;
    }>>([]);
    const [layout, setLayout] = useState<typeof layoutRef.current>([]);
    const [isListening, setIsListening] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(false);
    const recognitionRef = useRef<any>(null);
    const onTextInputRef = useRef(onTextInput);

    // Keep the ref up to date
    useEffect(() => {
        onTextInputRef.current = onTextInput;
    }, [onTextInput]);

    // Check for voice support
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            setVoiceSupported(!!SpeechRecognition);

            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = false;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    onTextInputRef.current(transcript);
                    setIsListening(false);
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error);
                    setIsListening(false);
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
            }
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore if already stopped
                }
            }
        };
    }, []);

    // Stable, first-seen ordering across streaming updates
    useMemo(() => {
        for (const p of predictions) {
            if (!orderRef.current.has(p.phrase)) {
                orderRef.current.set(p.phrase, orderRef.current.size);
            }
        }
    }, [predictions]);

    const handleVoiceInput = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (error) {
                console.error('Failed to start voice recognition:', error);
            }
        }
    };

    const W = 800;
    const H = 300;

    const colorForWord = useMemo(() => {
        // Stable color per word (no re-mapping as items come/go)
        const colors = d3.schemeCategory10;
        const hash = (s: string) => {
            let h = 2166136261;
            for (let i = 0; i < s.length; i++) {
                h ^= s.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return h >>> 0;
        };
        return (word: string) => colors[hash(word) % colors.length]!;
    }, []);

    // Compute a “standard” distributed layout using circle packing,
    // but only once the stream is done to avoid items jumping around.
    useEffect(() => {
        if (!predictions.length) {
            layoutRef.current = [];
            setLayout([]);
            return;
        }

        // While streaming, keep the previous layout to prevent motion/flicker.
        if (isLoading && layoutRef.current.length > 0) {
            return;
        }

        const ordered = [...predictions].sort((a, b) => {
            const oa = orderRef.current.get(a.phrase) ?? 0;
            const ob = orderRef.current.get(b.phrase) ?? 0;
            return oa - ob;
        });

        // Circle pack uses "value" to determine area; ensure non-zero.
        const root = d3
            .hierarchy({ children: ordered } as any)
            .sum((d: any) => Math.max(1e-4, Number(d?.probability) || 0))
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

        const pack = d3.pack().size([W, H]).padding(6);
        const packed = pack(root as any);
        const leaves = packed.leaves() as Array<d3.HierarchyCircularNode<PhrasePrediction>>;

        const next = leaves.map((leaf) => {
            const p = leaf.data;
            return {
                phrase: p.phrase,
                probability: p.probability,
                x: leaf.x,
                y: leaf.y,
                r: Math.max(14, leaf.r),
                fill: colorForWord(p.phrase),
                pct: `${(p.probability * 100).toFixed(1)}%`,
            };
        });

        layoutRef.current = next;
        setLayout(next);
    }, [predictions, isLoading, colorForWord]);

    return (
        <div ref={containerRef} className="relative w-full h-full flex flex-col overflow-hidden p-2">
            {/* Prediction Graph */}
            <div className="flex-1 relative">
                <svg
                    className="w-full h-full"
                    viewBox={`0 0 ${W} ${H}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ pointerEvents: isLoading ? 'none' : 'auto' }}
                >
                    {layout.map((d) => {
                        const wordFont = Math.max(10, Math.min(d.r * 0.32, 22));
                        const pctFont = Math.max(8, Math.min(d.r * 0.22, 14));
                        const showPct = d.r >= 18;
                        return (
                            <g
                                key={d.phrase}
                                transform={`translate(${d.x},${d.y})`}
                                onClick={() => onWordSelect(d.phrase)}
                                className="cursor-pointer hover:opacity-90 transition-opacity"
                            >
                                <circle
                                    r={d.r}
                                    fill={d.fill}
                                    opacity={0.85}
                                    stroke="var(--border)"
                                    strokeWidth={2}
                                />
                                <text
                                    y={-d.r * 0.08}
                                    textAnchor="middle"
                                    fill="white"
                                    fontWeight={600}
                                    fontSize={wordFont}
                                    pointerEvents="none"
                                >
                                    {d.phrase}
                                </text>
                                {showPct && (
                                    <text
                                        y={d.r * 0.32}
                                        textAnchor="middle"
                                        fill="rgba(255,255,255,0.92)"
                                        fontWeight={500}
                                        fontSize={pctFont}
                                        pointerEvents="none"
                                    >
                                        {d.pct}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>

                {/* Loading overlay */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-40 rounded-xl">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-primary font-medium text-lg">
                                AI is thinking...
                            </span>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!currentWord && predictions.length === 0 && !isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50 z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-primary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {/* <p className="text-xl font-medium mb-2">Start typing or speak</p>
                        <p className="text-sm text-gray-500">AI will predict the next words as you type</p> */}
                    </div>
                )}

                {/* Predictions info */}
                {predictions.length > 0 && !isLoading && (
                    <div className="absolute bottom-4 right-4 px-4 py-2 bg-popover/80 backdrop-blur-sm rounded-lg border border-border">
                        <p className="text-xs text-muted-foreground">
                            {predictions.length} prediction{predictions.length !== 1 ? 's' : ''} • Click to select
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
