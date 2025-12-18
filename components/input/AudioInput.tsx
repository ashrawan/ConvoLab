import { useState, useRef, useEffect } from 'react';

interface AudioInputProps {
    isActive: boolean;
    onToggle: () => void;
    onTranscript: (text: string) => void;
    language?: string;
}

export default function AudioInput({
    isActive,
    onToggle,
    onTranscript,
    language = 'en'
}: AudioInputProps) {
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (isActive && !recognitionRef.current) {
            startRecognition();
        } else if (!isActive && recognitionRef.current) {
            stopRecognition();
        }
    }, [isActive]);

    const startRecognition = () => {
        if (typeof window === 'undefined') return;
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === 'en' ? 'en-US' : language;

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcriptPiece = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcriptPiece + ' ';
                } else {
                    interimTranscript += transcriptPiece;
                }
            }

            if (finalTranscript) {
                onTranscript(finalTranscript.trim());
                setTranscript('');
            } else if (interimTranscript) {
                setTranscript(interimTranscript);
            }
        };

        recognition.onerror = (event: any) => {
            console.log('Recognition error:', event.error);
        };

        recognition.onend = () => {
            // Auto-restart if still active
            if (recognitionRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    console.log('Restart:', e);
                }
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
        } catch (e) {
            console.error('Start error:', e);
        }
    };

    const stopRecognition = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setTranscript('');
    };

    return (
        <>
            {/* Listening indicator */}
            {isActive && (
                <div className="absolute bottom-16 left-6 right-6 bg-primary/20 border border-primary/30 rounded-lg px-4 py-2 pointer-events-none z-10">
                    <p className="text-primary text-sm italic">{transcript || 'Listening...'}</p>
                </div>
            )}

            {/* Mic button - positioned within bottom controls by parent */}
            <button
                onClick={onToggle}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition ${isActive
                    ? 'bg-destructive text-destructive-foreground animate-pulse'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                    }`}
                title={isActive ? 'Stop listening' : 'Voice input'}
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
            </button>
        </>
    );
}
