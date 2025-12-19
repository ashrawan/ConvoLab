
import { useState, useCallback, useRef } from 'react';

export interface UseAudioRecorderReturn {
    isRecording: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
    audioBlob: Blob | null;
    mediaStream: MediaStream | null;
    reset: () => void;
    error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm' // Standard for Chrome/Firefox. Safari 14.1+ supports it too, or audio/mp4.
            });

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop()); // Clean up
            };

            mediaRecorder.start();
            setMediaStream(stream);
            setIsRecording(true);
            setError(null);

        } catch (err: unknown) {
            console.error('Error starting recording:', err);
            setError((err as Error).message || 'Could not access microphone');
            setIsRecording(false);
        }
    }, []);

    const stopRecording = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                resolve(null);
                return;
            }

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
                setIsRecording(false);
                resolve(blob);
            };

            mediaRecorderRef.current.stop();
        });
    }, []);

    const reset = useCallback(() => {
        setAudioBlob(null);
        setError(null);
        setIsRecording(false);
        setMediaStream(null);
        chunksRef.current = [];
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        audioBlob,
        mediaStream, // Expose stream for visualization
        reset,
        error
    };
}
