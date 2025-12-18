import { useRef, useEffect } from 'react';
import { sequentialAudioPlayer } from '@/lib/utils/audio-player';
import { sttService } from '@/lib/services';

export function useAudioController(
    startMic: () => void,
    pauseMicOnAudio: boolean,
    setPauseMicOnAudio: (val: boolean) => void
) {
    const pauseMicOnAudioRef = useRef(pauseMicOnAudio);
    const isPausedForAudioRef = useRef(false);

    // Sync ref
    useEffect(() => {
        pauseMicOnAudioRef.current = pauseMicOnAudio;
    }, [pauseMicOnAudio]);

    // Setup callbacks
    useEffect(() => {
        sequentialAudioPlayer.setGlobalCallbacks(
            () => {
                // Pause mic when audio starts
                if (pauseMicOnAudioRef.current && sttService.isListening()) {
                    isPausedForAudioRef.current = true;
                    console.log('⏸️ Pausing STT for audio...');
                    sttService.stopListening();
                }
            },
            () => {
                // Resume mic when audio ends
                if (isPausedForAudioRef.current) {
                    console.log('▶️ Resuming STT after audio...');
                    isPausedForAudioRef.current = false;
                    // Restart using provided callback (which should have fresh config/refs)
                    startMic();
                }
            }
        );
    }, [startMic]); // Re-bind if startMic changes (should be stable via useCallback)
}
