import { NextRequest, NextResponse } from 'next/server';
import { prompts } from '@/lib/ai/prompts';
import { makeOpenAIRequest, makeAnthropicRequest, makeGoogleRequest, makeOpenRouterRequest, makeGroqRequest } from '@/lib/ai/providers';
import { getLLMRequestConfig } from '@/lib/ai/llm-request';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    try {
        const { apiKey, model, provider } = getLLMRequestConfig(req);

        if (!apiKey) {
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            try {
                // Try legacy backend if no key
                const pyRes = await fetch(`${backendUrl}/api/ai/scenario/random`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                if (!pyRes.ok) throw new Error('Backend failed');
                return NextResponse.json(await pyRes.json());
            } catch (err) {
                return NextResponse.json({ error: 'Configure API Key in Settings' }, { status: 401 });
            }
        }

        const prompt = prompts.scenarioRandom();
        let scenario = "";

        if (provider === 'anthropic') {
            const data = await makeAnthropicRequest(apiKey, {
                model,
                max_tokens: 150,
                messages: [{ role: 'user', content: prompt }]
            });
            scenario = data.content[0].text;
        } else if (provider === 'google') {
            const data = await makeGoogleRequest(apiKey, model, prompt);
            scenario = data.text;
        } else if (provider === 'openrouter') {
            const data = await makeOpenRouterRequest(apiKey, {
                model,
                messages: [{ role: "user", content: prompt }]
            });
            scenario = data.choices[0].message.content;
        } else if (provider === 'groq') {
            const data = await makeGroqRequest(apiKey, {
                model,
                messages: [{ role: "user", content: prompt }]
            });
            scenario = data.choices[0].message.content;
        } else {
            // OpenAI
            const data = await makeOpenAIRequest(apiKey, '/chat/completions', {
                model,
                max_tokens: 150,
                messages: [{ role: "user", content: prompt }]
            });
            scenario = data.choices[0].message.content;
        }

        return NextResponse.json({ scenario: scenario.trim() });

    } catch (error: any) {
        console.error("Scenario API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
