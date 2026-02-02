import { NextRequest, NextResponse } from 'next/server';
import { prompts } from '@/lib/ai/prompts';
import { makeOpenAIRequest, makeAnthropicRequest, makeGoogleRequest, makeOpenRouterRequest, makeGroqRequest } from '@/lib/ai/providers';
import { getLLMRequestConfig } from '@/lib/ai/llm-request';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const { text, target_langs } = await req.json();

        if (!text || !target_langs || !Array.isArray(target_langs)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const { apiKey, model, provider } = getLLMRequestConfig(req);

        if (!apiKey) {
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            try {
                const pyRes = await fetch(`${backendUrl}/api/ai/translate/multiple`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({ text, target_langs })
                });
                if (!pyRes.ok) throw new Error('Backend failed');
                return NextResponse.json(await pyRes.json());
            } catch (err) {
                return NextResponse.json({ error: 'Configure API Key in Settings' }, { status: 401 });
            }
        }

        const prompt = prompts.translateMultiple(text, target_langs);
        let content = "";

        if (provider === 'anthropic') {
            const data = await makeAnthropicRequest(apiKey, {
                model,
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }]
            });
            content = data.content[0].text;
        } else if (provider === 'google') {
            const data = await makeGoogleRequest(apiKey, model, prompt);
            content = data.text;
        } else if (provider === 'openrouter') {
            const data = await makeOpenRouterRequest(apiKey, {
                model,
                messages: [{ role: "user", content: prompt }]
            });
            content = data.choices[0].message.content;
        } else if (provider === 'groq') {
            const data = await makeGroqRequest(apiKey, {
                model,
                messages: [{ role: "user", content: prompt }]
            });
            content = data.choices[0].message.content;
        } else {
            // OpenAI
            const data = await makeOpenAIRequest(apiKey, '/chat/completions', {
                model,
                max_tokens: 1000,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: "Output valid JSON only." },
                    { role: "user", content: prompt }
                ]
            });
            content = data.choices[0].message.content;
        }

        // Parse JSON
        try {
            const json = JSON.parse(content);
            return NextResponse.json({ translations: json });
        } catch (e) {
            // Fix JSON markdown
            const clean = content.replace(/```json\n|```/g, '');
            try {
                return NextResponse.json({ translations: JSON.parse(clean) });
            } catch (e2) {
                console.error("Translation Parse Error:", content);
                return NextResponse.json({ error: "Failed to parse translations" }, { status: 500 });
            }
        }

    } catch (error: any) {
        console.error("Translation API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
