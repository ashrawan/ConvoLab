'use client';

import React from 'react';

interface PhrasePrediction {
    phrase: string;
    probability: number;
    translations: Record<string, string>;
}

interface PredictionListProps {
    predictions: PhrasePrediction[];
    onPhraseSelect: (phrase: string) => void;
    isLoading: boolean;
    targetLanguages: string[];
}

export default function PredictionList({
    predictions,
    onPhraseSelect,
    isLoading,
    targetLanguages
}: PredictionListProps) {
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Loading suggestions...</p>
                </div>
            </div>
        );
    }

    if (predictions.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <p className="text-muted-foreground text-sm italic">Start typing to see phrase suggestions</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">Suggested Phrases</div>
            {predictions.map((pred, idx) => (
                <button
                    key={idx}
                    onClick={() => onPhraseSelect(pred.phrase)}
                    className="w-full text-left px-4 py-3 rounded-lg bg-card hover:bg-primary/20 border border-border hover:border-primary/30 transition group"
                >
                    {/* Main phrase */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <div className="text-base text-card-foreground font-medium group-hover:text-primary transition">
                                {pred.phrase}
                            </div>

                            {/* Translations */}
                            {targetLanguages.length > 0 && pred.translations && Object.keys(pred.translations).length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {targetLanguages.map((lang) => {
                                        const translation = pred.translations[lang];
                                        if (!translation) return null;

                                        return (
                                            <div key={lang} className="flex items-center gap-2 text-xs">
                                                <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded font-mono">
                                                    {lang.toUpperCase()}
                                                </span>
                                                <span className="text-muted-foreground">{translation}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Probability indicator */}
                        <div className="text-xs text-muted-foreground">
                            {Math.round(pred.probability * 100)}%
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}
