import { NextRequest, NextResponse } from 'next/server';
import { getLangName, prompts } from '@/lib/ai/prompts';
import { makeOpenAIRequest, makeAnthropicRequest, makeGoogleRequest, makeOpenRouterRequest, makeGroqRequest } from '@/lib/ai/providers';
import { getLLMRequestConfig } from '@/lib/ai/llm-request';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const { conversation_history, source_lang = 'en', num_suggestions = 6 } = await req.json();

        const { apiKey, model, provider } = getLLMRequestConfig(req);

        if (!apiKey) {
            // Fallback to Python Backend if configured
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            try {
                const pyRes = await fetch(`${backendUrl}/api/ai/suggestions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ conversation_history, source_lang, num_suggestions })
                });
                const data = await pyRes.json();
                return NextResponse.json(data, { status: pyRes.status });
            } catch (err) {
                return NextResponse.json({ suggestions: [], count: 0 }, { status: 200 }); // Graceful fail
            }
        }

        // --- Execute Logic on Next.js ---

        if (!conversation_history || conversation_history.length === 0) {
            return NextResponse.json({ suggestions: [], count: 0 });
        }

        const lastExchange = conversation_history[conversation_history.length - 1];
        const user_input = lastExchange.user;
        const ai_response = lastExchange.ai;

        // Context
        let contextText = "";
        if (conversation_history.length > 1) {
            contextText = "Previous conversation:\n";
            for (let i = 0; i < conversation_history.length - 1; i++) {
                contextText += `User: ${conversation_history[i].user || ''}\nAI: ${conversation_history[i].ai || ''}\n`;
            }
            contextText += "\n";
        }

        const targetLangName = getLangName(source_lang);
        const prompt = prompts.suggestions(user_input, ai_response, contextText, num_suggestions, targetLangName, source_lang);
        const systemMsg = `You are an AI conversation assistant specializing in generating engaging, natural conversation replies in ${targetLangName}.`;

        let content = "";

        if (provider === 'anthropic') {
            const data = await makeAnthropicRequest(apiKey, {
                model,
                max_tokens: 300,
                messages: [{ role: 'user', content: prompt }],
                system: systemMsg
            });
            content = data.content[0].text;
        } else if (provider === 'google') {
            const data = await makeGoogleRequest(apiKey, model, `${systemMsg}\n\n${prompt}`);
            content = data.text;
        } else if (provider === 'openrouter') {
            const data = await makeOpenRouterRequest(apiKey, {
                model,
                messages: [
                    { role: "system", content: systemMsg },
                    { role: "user", content: prompt }
                ]
            });
            content = data.choices[0].message.content;
        } else if (provider === 'groq') {
            const data = await makeGroqRequest(apiKey, {
                model,
                messages: [
                    { role: "system", content: systemMsg },
                    { role: "user", content: prompt }
                ]
            });
            content = data.choices[0].message.content;
        } else {
            // OpenAI (default)
            const data = await makeOpenAIRequest(apiKey, '/chat/completions', {
                model,
                max_tokens: 300,
                temperature: 0.9,
                messages: [
                    { role: "system", content: systemMsg },
                    { role: "user", content: prompt }
                ]
            });
            content = data.choices[0].message.content;
        }


        // Parse Output
        const suggestions = content.split('\n')
            .map(line => line.replace(/^[\d\.\-\*\s]+/, "").trim()) // Remove "1. ", "- ", etc
            .map(line => line.replace(/^["']|["']$/g, "")) // Remove quotes
            .filter(line => line.length > 2 && !line.toLowerCase().startsWith("sure") && !line.toLowerCase().startsWith("here"));

        return NextResponse.json({
            suggestions: suggestions.slice(0, num_suggestions),
            count: suggestions.length
        });

    } catch (error: any) {
        console.error('Error in /api/ai/suggestions:', error);
        return NextResponse.json({ suggestions: [], count: 0 }, { status: 500 });
    }
}
