import { NextRequest, NextResponse } from 'next/server';
import { prompts } from '@/lib/ai/prompts';
import { makeOpenAIRequest, makeAnthropicRequest, makeGoogleRequest, makeOpenRouterRequest, makeGroqRequest } from '@/lib/ai/providers';
import { getLLMRequestConfig } from '@/lib/ai/llm-request';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const { party_context, history, lang_name } = await req.json();

        // Basic validation
        if (!history) {
            return NextResponse.json({ error: 'History required' }, { status: 400 });
        }

        const { apiKey, model, provider } = getLLMRequestConfig(req);

        if (!apiKey) {
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            try {
                const pyRes = await fetch(`${backendUrl}/api/ai/predict/phrases`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({ party_context, history, lang_name })
                });
                if (!pyRes.ok) throw new Error('Backend failed');
                return NextResponse.json(await pyRes.json());
            } catch (err) {
                return NextResponse.json({ error: 'Configure API Key in Settings' }, { status: 401 });
            }
        }

        // Format history text for prompt
        let historyText = "";
        if (typeof history === 'string') {
            historyText = history;
        } else if (Array.isArray(history)) {
            historyText = history.map((h: any) => `${h.role || h.user ? 'User' : 'AI'}: ${h.content || h.text}`).join('\n');
        }

        const prompt = prompts.predictPhrases(party_context || "User", historyText, lang_name || "English");
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
            // OpenAI
            const data = await makeOpenAIRequest(apiKey, '/chat/completions', {
                model,
                max_tokens: 300,
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
            // Ensure array
            const phrases = Array.isArray(json) ? json : (json.phrases || json.predictions || []);
            return NextResponse.json({ phrases });
        } catch (e) {
            // Try to find array in text
            const match = content.match(/\[[\s\S]*\]/);
            if (match) {
                try {
                    return NextResponse.json({ phrases: JSON.parse(match[0]) });
                } catch (e2) { }
            }
            console.error("Predict Parse Error:", content);
            return NextResponse.json({ phrases: [] }); // Fail gracefully
        }

    } catch (error: any) {
        console.error("Predict API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
