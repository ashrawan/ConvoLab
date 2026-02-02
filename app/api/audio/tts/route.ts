import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// NOTE: This endpoint ONLY works if user provides an OpenAI Key.
// Anthropic does not have TTS.
// If using Python backend, we use other providers (ElevenLabs, Google, etc).

export async function POST(req: NextRequest) {
    try {
        const { text, lang, voice, speed, stability, model } = await req.json();

        const apiKey = req.headers.get('x-api-key') || process.env.OPENAI_API_KEY;
        const provider = req.headers.get('x-provider') || 'openai';

        // Fallback to Python if no key or if provider is NOT OpenAI (unless we add more TTS providers here)
        // Or if user specifically wants the Python backend audio.
        // For "Offline Mode" implies using OpenAI directly if configured.

        if (!apiKey) {
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            try {
                const pyRes = await fetch(`${backendUrl}/api/audio/tts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, lang, voice, speed })
                });

                // Forward blob
                return new NextResponse(pyRes.body, {
                    headers: { 'Content-Type': 'audio/mpeg' }
                });
            } catch (err) {
                return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
            }
        }

        if (provider === 'elevenlabs') {
            // ElevenLabs TTS
            // https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
            const voiceId = voice || '21m00Tcm4TlvDq8ikWAM'; // Default voice
            const modelId = model || 'eleven_multilingual_v2';
            const parsedStability = typeof stability === 'number' ? stability : parseFloat(stability);
            const parsedSpeed = typeof speed === 'number' ? speed : parseFloat(speed);
            const elevenLabsStability = Number.isFinite(parsedStability) ? parsedStability : 0.35;
            const elevenLabsSpeed = Number.isFinite(parsedSpeed) ? parsedSpeed : 0.9;
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: modelId,
                    voice_settings: {
                        stability: elevenLabsStability,
                        similarity_boost: 0.5,
                        speed: elevenLabsSpeed
                    }
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`ElevenLabs TTS Failed: ${err}`);
            }

            return new NextResponse(response.body, {
                headers: { 'Content-Type': 'audio/mpeg' }
            });
        }

        // OpenAI TTS
        const openaiModel = model || 'tts-1';
        const parsedSpeed = typeof speed === 'number' ? speed : parseFloat(speed);
        const openaiSpeed = Number.isFinite(parsedSpeed) ? parsedSpeed : 1.0;
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: openaiModel,
                input: text,
                voice: voice || 'alloy', // Default OpenAI voice
                speed: openaiSpeed
            })
        });

        if (!response.ok) throw new Error("OpenAI TTS Failed");

        return new NextResponse(response.body, {
            headers: { 'Content-Type': 'audio/mpeg' }
        });

    } catch (error: any) {
        console.error("TTS Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
