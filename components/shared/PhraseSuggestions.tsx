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
                <div className="text-sm text-gray-500">Loading suggestions...</div>
            </div>
        );
    }

    if (predictions.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-600 text-sm italic">Start typing to see phrase suggestions</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-3">
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
                    className="px-4 py-3 rounded-lg bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/40 transition text-left"
                >
                    <div className="text-sm text-gray-300 hover:text-violet-300">
                        {pred.phrase}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        {Math.round(pred.probability * 100)}% match
                    </div>
                </button>
            ))}
        </div>
    );
}
