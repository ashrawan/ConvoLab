import { NextRequest, NextResponse } from 'next/server';
import { prompts } from '@/lib/ai/prompts';
import { makeOpenAIRequest, makeAnthropicRequest, makeGoogleRequest, makeOpenRouterRequest, makeGroqRequest } from '@/lib/ai/providers';
import { getLLMRequestConfig } from '@/lib/ai/llm-request';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        const { apiKey, model, provider } = getLLMRequestConfig(req);

        if (!apiKey) {
            // Fallback
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            try {
                const pyRes = await fetch(`${backendUrl}/api/ai/context`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });
                return NextResponse.json(await pyRes.json(), { status: pyRes.status });
            } catch (err) {
                return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
            }
        }

        const prompt = prompts.contextExtraction(text);
        let content = "";

        if (provider === 'anthropic') {
            const data = await makeAnthropicRequest(apiKey, {
                model,
                max_tokens: 300,
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
            // OpenAI (default)
            const data = await makeOpenAIRequest(apiKey, '/chat/completions', {
                model,
                max_tokens: 300,
                temperature: 0.2, // Low temp for JSON
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
            return NextResponse.json(json);
        } catch (e) {
            // Cleanup markdown
            const clean = content.replace(/```json\n|```/g, '').trim();
            try {
                return NextResponse.json(JSON.parse(clean));
            } catch (e2) {
                console.error("Failed to parse JSON context:", content);
                // Default fallback
                return NextResponse.json({
                    party_a: { context: "User", languages: ["en"] },
                    party_b: { context: "Assistant", languages: ["en"] }
                });
            }
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
