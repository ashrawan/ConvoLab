import { NextRequest, NextResponse } from 'next/server';
import { getLLMRequestConfig } from '@/lib/ai/llm-request';

export const runtime = 'edge';

const truncateNotebook = (content: string, maxChars: number = 4000) => {
    const normalized = content.trim();
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, maxChars)}\n...[truncated]`;
};

export async function POST(req: NextRequest) {
    try {
        const { message, party_a_context, party_b_context, source_lang, return_lang, history, stream, notebook } = await req.json();

        // Get API Key and Model from Headers
        const { apiKey, model, provider } = getLLMRequestConfig(req);

        if (!apiKey) {
            // Fallback to Python Backend
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            try {
                const body = { message, party_a_context, party_b_context, source_lang, return_lang, history, stream, notebook };
                const pyRes = await fetch(`${backendUrl}/api/ai/respond`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body)
                });

                if (stream) {
                    if (!pyRes.ok) {
                        const raw = await pyRes.text();
                        return NextResponse.json(
                            { error: 'Backend Error', details: raw || pyRes.statusText },
                            { status: pyRes.status }
                        );
                    }
                    return new NextResponse(pyRes.body, { status: pyRes.status });
                } else {
                    const data = await pyRes.json();
                    return NextResponse.json(data, { status: pyRes.status });
                }
            } catch (err: any) {
                return NextResponse.json(
                    { error: 'Failed to connect to backend and no API key provided.', details: err.message },
                    { status: 502 }
                );
            }
        }

        // Language Mapping
        const getLangName = (code: string) => {
            const names: Record<string, string> = {
                'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
                'it': 'Italian', 'pt': 'Portuguese', 'zh': 'Chinese', 'ja': 'Japanese',
                'ko': 'Korean', 'ar': 'Arabic', 'hi': 'Hindi', 'ru': 'Russian',
                'nl': 'Dutch', 'tr': 'Turkish', 'pl': 'Polish', 'vi': 'Vietnamese',
                'th': 'Thai', 'id': 'Indonesian', 'zh-cn': 'Chinese (Simplified)',
                'zh-tw': 'Chinese (Traditional)'
            };
            return names[code.toLowerCase()] || names[code.split('-')[0]] || 'English';
        };

        const returnLangName = getLangName(return_lang || 'en');
        const sourceLangName = getLangName(source_lang || 'en');

        // Construct System Prompt
        let roleDescription = "";
        if (party_b_context) {
            roleDescription += `You are roleplaying as: ${party_b_context}.\n`;
        } else {
            roleDescription += "You are a helpful AI assistant.\n";
        }

        if (party_a_context) {
            roleDescription += `You are speaking with: ${party_a_context}.\n`;
        }

        let languageInstruction = `- Respond ONLY in ${returnLangName}`;
        if (source_lang?.toLowerCase() !== return_lang?.toLowerCase()) {
            languageInstruction += `\n- NOTE: User is speaking in ${sourceLangName} (${source_lang}), but you MUST respond in ${returnLangName}.`;
        }

        const notebookSnippet = notebook?.content
            ? `Notebook reference (use this as ground truth):\nTitle: ${notebook.title || 'Untitled'}\n${truncateNotebook(notebook.content)}\n`
            : '';
        const notebookRule = notebook?.content
            ? '- If a notebook reference is provided, ground responses in it and explain it clearly.'
            : '';

        const systemPrompt = `${roleDescription}
${notebookSnippet}

You are a high-signal, human-sounding partner who adapts to the user's level and domain.

Guidelines:
${languageInstruction}
${notebookRule}
- Match the user's expertise, needs, and tone (beginner, professional, expert, creative, emotional).
- Be concise and clear; default to 1-4 short sentences unless asked for depth.
- Be practical and specific; avoid fluff or generic advice.
- If the request is ambiguous, ask one short clarifying question.
- If the topic is emotional, respond with empathy and gentle, grounded guidance.
- If the topic is technical, provide the precise code snippets or examples or explanations in the response.
- Stay in character or needs or goals and use conversation history for continuity.

IMPORTANT: Always respond in ${returnLangName}, even if the user writes in another language. Do NOT use ${sourceLangName}.`;

        // Construct Messages
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        if (history && Array.isArray(history)) {
            const recentHistory = history.slice(-20);
            for (const msg of recentHistory) {
                let role = msg.role || 'user';
                if (role === 'party_a') role = 'user';
                if (role === 'party_b') role = 'assistant';
                messages.push({ role, content: msg.content || '' });
            }
        }

        messages.push({ role: 'user', content: message });

        let upstreamResponse: Response;

        // Call Provider
        if (provider === 'anthropic') {
            const anthropicKey = apiKey;
            const system = messages.find(m => m.role === 'system')?.content;
            const userMessages = messages.filter(m => m.role !== 'system');

            const body = {
                model: model,
                system: system,
                messages: userMessages,
                max_tokens: 1024,
                stream: stream
            };

            upstreamResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': anthropicKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify(body)
            });

        } else if (provider === 'google') {
            const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
            const body = { model, messages, temperature: 0.7, stream };

            upstreamResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

        } else {
            // OpenAI Compatible (OpenAI, OpenRouter, Groq)
            let apiUrl = 'https://api.openai.com/v1/chat/completions';
            if (provider === 'openrouter') apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            if (provider === 'groq') apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

            const body = { model, messages, temperature: 0.7, stream };
            const headers: Record<string, string> = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            };
            if (provider === 'openrouter') {
                headers['HTTP-Referer'] = 'https://convolab.ai';
                headers['X-Title'] = 'ConvoLab';
            }

            upstreamResponse = await fetch(apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
        }


        if (!upstreamResponse.ok) {
            const err = await upstreamResponse.text();
            return NextResponse.json({ error: `${provider} Provider Error: ${upstreamResponse.statusText}`, details: err }, { status: upstreamResponse.status });
        }

        // Handle Streaming or JSON
        if (stream) {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();

            const readable = new ReadableStream({
                async start(controller) {
                    const reader = upstreamResponse.body?.getReader();
                    if (!reader) {
                        controller.close();
                        return;
                    }

                    let buffer = '';
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || ''; // Keep incomplete line

                            for (const line of lines) {
                                let textContent = '';

                                if (provider === 'anthropic') {
                                    // Anthropic SSE
                                    if (line.startsWith('data: ')) {
                                        const data = line.slice(6);
                                        try {
                                            const json = JSON.parse(data);
                                            if (json.type === 'content_block_delta' && json.delta?.text) {
                                                textContent = json.delta.text;
                                            }
                                        } catch (e) { }
                                    }
                                } else {
                                    // OpenAI / OpenRouter / Google SSE
                                    if (line.startsWith('data: ')) {
                                        const data = line.slice(6).trim();
                                        if (data === '[DONE]') continue;
                                        try {
                                            const json = JSON.parse(data);
                                            const content = json.choices?.[0]?.delta?.content;
                                            if (content) textContent = content;
                                        } catch (e) { }
                                    }
                                }

                                if (textContent) {
                                    controller.enqueue(encoder.encode(textContent));
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Streaming Error:', e);
                        controller.error(e);
                    } finally {
                        controller.close();
                    }
                }
            });

            return new NextResponse(readable, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });

        } else {
            // Non-Streaming Response
            const data = await upstreamResponse.json();
            let content = "";

            if (provider === 'anthropic') {
                content = data.content?.[0]?.text || "";
            } else {
                content = data.choices?.[0]?.message?.content || "";
            }

            return NextResponse.json({ response: content });
        }

    } catch (error: any) {
        console.error('Error in /api/ai/respond:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
