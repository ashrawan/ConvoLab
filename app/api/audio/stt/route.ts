import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get('audio') as Blob;

        if (!audioFile) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        const provider = req.headers.get('x-provider') || 'openai';
        const apiKey = req.headers.get('x-api-key');

        if (!apiKey) {
            // Fallback to local backend if no key provided
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            try {
                // Determine boundary if needed or just forward formData
                // Node fetch might need headers manipulation for FormData
                // Simplest is generic fetch
                const pyRes = await fetch(`${backendUrl}/api/audio/stt`, {
                    method: 'POST',
                    body: formData as any,
                    headers: { 'x-provider': provider }
                });
                return NextResponse.json(await pyRes.json(), { status: pyRes.status });
            } catch (err) {
                return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
            }
        }

        if (provider === 'deepgram') {
            const response = await fetch('https://api.deepgram.com/v1/listen?smart_format=true&model=nova-2', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${apiKey}`,
                    'Content-Type': audioFile.type || 'audio/webm'
                },
                body: audioFile
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Deepgram STT Failed: ${err}`);
            }

            const data = await response.json();
            const transcript = data.results?.channels[0]?.alternatives[0]?.transcript || "";
            return NextResponse.json({ text: transcript, language: 'en' });
        }

        // Default: OpenAI Whisper
        // We need to reconstruct formData for OpenAI
        const openAIFormData = new FormData();
        openAIFormData.append('file', audioFile, 'audio.webm');
        openAIFormData.append('model', 'whisper-1');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            body: openAIFormData
        });

        if (!response.ok) throw new Error("OpenAI STT Failed");
        const data = await response.json();

        return NextResponse.json({ text: data.text, language: 'en' }); // Whisper auto-detects but returns text

    } catch (error: any) {
        console.error("STT Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
