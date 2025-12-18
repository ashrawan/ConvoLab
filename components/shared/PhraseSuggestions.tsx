import { PhrasePrediction } from '@/lib/services/llm';
import { sendEvent } from '@/lib/analytics';

interface PhraseSuggestionsProps {
    predictions: PhrasePrediction[];
    isLoading: boolean;
    onSelectPhrase: (phrase: string) => void;
}

export default function PhraseSuggestions({
    predictions,
    isLoading,
    onSelectPhrase
}: PhraseSuggestionsProps) {
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-sm text-muted-foreground">Loading suggestions...</div>
            </div>
        );
    }

    if (predictions.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground text-sm italic">Start typing to see phrase suggestions</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {predictions.map((pred, idx) => (
                <button
                    key={idx}
                    onClick={() => {
                        onSelectPhrase(pred.phrase);
                        sendEvent({
                            action: 'suggestion_selected',
                            params: {
                                confidence: pred.probability,
                                index: idx
                            }
                        });
                    }}
                    className="px-4 py-3 rounded-lg bg-card hover:bg-primary/20 border border-border hover:border-primary/40 transition text-left"
                >
                    <div className="text-xs md:text-sm text-card-foreground hover:text-primary truncate">
                        {pred.phrase}
                    </div>
                    <div className="text-[10px] md:text-xs text-muted-foreground mt-1">
                        {Math.round(pred.probability * 100)}% match
                    </div>
                </button>
            ))}
        </div>
    );
}
