
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    stream: MediaStream | null;
    isRecording: boolean;
    className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isRecording, className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    useEffect(() => {
        if (!stream || !isRecording || !canvasRef.current) return;

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        source.connect(analyser);
        analyser.fftSize = 256;

        analyserRef.current = analyser;
        sourceRef.current = source;

        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height); // Transparent clear

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;

                // Gradient or solid color
                canvasCtx.fillStyle = `rgba(255, 255, 255, ${barHeight / 100})`;
                canvasCtx.fillRect(x, canvas.height / 2 - barHeight / 2, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (sourceRef.current) sourceRef.current.disconnect();
            if (audioContext.state !== 'closed') audioContext.close();
        };
    }, [stream, isRecording]);

    if (!isRecording) return null;

    return (
        <canvas
            ref={canvasRef}
            width={200}
            height={40}
            className={`absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none ${className || ''}`}
        />
    );
};
