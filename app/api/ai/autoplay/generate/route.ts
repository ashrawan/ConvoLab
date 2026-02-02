import { NextRequest, NextResponse } from 'next/server';
import { prompts, getLangName } from '@/lib/ai/prompts';
import { makeOpenAIRequest, makeAnthropicRequest, makeGoogleRequest, makeOpenRouterRequest, makeGroqRequest } from '@/lib/ai/providers';
import { getLLMRequestConfig } from '@/lib/ai/llm-request';

export const runtime = 'edge';

const truncateNotebook = (content: string, maxChars: number = 3000) => {
    const normalized = content.trim();
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, maxChars)}\n...[truncated]`;
};

export async function POST(req: NextRequest) {
    try {
        const { party_a_context, party_b_context, party_a_lang, conversation_summary, recent_history, history, notebook } = await req.json();

        const { apiKey, model, provider } = getLLMRequestConfig(req);

        if (!apiKey) {
            // Fallback
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            try {
                const pyRes = await fetch(`${backendUrl}/api/ai/autoplay/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ party_a_context, party_b_context, party_a_lang, conversation_summary, recent_history, history, notebook })
                });
                return NextResponse.json(await pyRes.json(), { status: pyRes.status });
            } catch (err) {
                return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
            }
        }

        // --- Next.js Logic ---
        const effectiveHistory = (recent_history && recent_history.length > 0)
            ? recent_history
            : (history && history.length > 0)
                ? history
                : [];

        const historyText = (effectiveHistory && effectiveHistory.length > 0) ? "Recent conversation:\n" + effectiveHistory.map((msg: any) => {
            const role = (msg.role === 'party_a' || msg.role === 'user') ? 'You' : 'Response';
            return `${role}: ${msg.content}`;
        }).join('\n') : "No previous conversation history. You are starting the conversation.";

        const notebookSnippet = notebook?.content
            ? `\nNotebook reference (follow and explain this content):\nTitle: ${notebook.title || 'Untitled'}\n${truncateNotebook(notebook.content)}`
            : '';

        const langName = getLangName(party_a_lang);
        const prompt = prompts.autoPlay(
            party_a_context,
            party_b_context,
            `${historyText}${notebookSnippet}`,
            langName
        );

        let content = "";
        if (provider === 'anthropic') {
            const data = await makeAnthropicRequest(apiKey, {
                model,
                max_tokens: 150,
                messages: [{ role: 'user', content: prompt }],
                system: `You are a helpful roleplay assistant. Generate natural, in-character dialogue in ${langName}.`
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
            const data = await makeOpenAIRequest(apiKey, '/chat/completions', {
                model,
                max_tokens: 150,
                temperature: 0.8,
                messages: [
                    { role: "system", content: `You are a helpful roleplay assistant. Generate natural, in-character dialogue in ${langName}. Respond with ONLY the dialogue, no quotes or prefixes.` },
                    { role: "user", content: prompt }
                ]
            });
            content = data.choices[0].message.content;
        }

        // Clean up
        content = content.trim();
        if (content.startsWith('"') && content.endsWith('"')) content = content.slice(1, -1);
        if (content.startsWith("You:")) content = content.slice(4).trim();

        return NextResponse.json({ message: content });

    } catch (error: any) {
        console.error('Error in /api/ai/autoplay/generate:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
