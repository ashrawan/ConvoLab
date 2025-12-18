/**
 * Audio Service Types and Interfaces
 */

export interface TTSOptions {
    /** Callback when speech starts */
    onStart?: () => void;

    /** Callback when speech ends */
    onEnd?: () => void;

    /** Speech rate (0.1 to 10, default 1.0) */
    rate?: number;

    /** Speech pitch (0 to 2, default 1.0) */
    pitch?: number;

    /** Speech volume (0 to 1, default 1.0) */
    volume?: number;
}

export interface TTSProvider {
    /** Provider name for logging/debugging */
    name: string;

    /** Speak text in specified language */
    speak(text: string, lang: string, options?: TTSOptions): Promise<void>;

    /** Cancel ongoing speech */
    cancel(): void;

    /** Check if provider is available/supported */
    isAvailable(): boolean;

    /** Warmup the audio engine (critical for mobile auto-play) */
    warmup?(): void;
}

export interface STTOptions {
    /** Callback when transcription is received */
    onTranscript: (text: string, isFinal: boolean) => void;

    /** Callback when an error occurs */
    onError?: (error: Error) => void;
}

export interface STTProvider {
    /** Provider name for logging/debugging */
    name: string;

    /** Start listening for speech in specified language */
    startListening(lang: string, options: STTOptions): Promise<void>;

    /** Stop listening */
    stopListening(): void;

    /** Check if provider is available/supported */
    isAvailable(): boolean;

    /** Check if currently listening */
    isListening(): boolean;
}
