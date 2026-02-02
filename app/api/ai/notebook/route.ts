import { NextRequest, NextResponse } from 'next/server';
import { getLLMRequestConfig } from '@/lib/ai/llm-request';
import { makeAnthropicRequest, makeGoogleRequest, makeGroqRequest, makeOpenAIRequest, makeOpenRouterRequest } from '@/lib/ai/providers';

export const runtime = 'edge';

const buildHistoryText = (history: Array<{ role: string; content: string }>) => {
    return history
        .map((item) => {
            const role = item.role === 'party_a' ? 'User' : item.role === 'party_b' ? 'Assistant' : item.role;
            return `${role}: ${item.content}`.trim();
        })
        .join('\n');
};

const buildSystemPrompt = (partyAContext?: string, partyBContext?: string) => {
    const contextLines = [
        partyAContext ? `User context: ${partyAContext}` : null,
        partyBContext ? `Assistant context: ${partyBContext}` : null
    ].filter(Boolean).join('\n');

    return `You are ConvoLab's Notebook Builder: a precise researcher, instructor, and technical writer.
Your job is to convert the conversation into a concise, comprehensive Markdown notebook that levels the user up by one step.

${contextLines}

Core intent:
- Infer domain, subtopics, user goal, constraints, and current expertise.
- Write for the user's level, then teach one level above it.
- Connect ideas, expand vision, and make the content actionable.

Internal method (do not reveal):
1) Extract signals: domain, level, goals, constraints, preferences, tone.
2) Fill gaps with accurate, standard knowledge and best practices.
3) Choose the best structure for this specific user and topic (optimize for clarity, readability, and engagement).
4) Create a learning arc that fits the chosen structure: foundations → depth → application.
5) Write the final notebook with tight structure and zero fluff.

Output rules:
- Output ONLY the final Markdown document (no analysis, no preamble, no meta).
- Write in the user's primary language inferred from the conversation; if unclear, use English.
- Be comprehensive but concise; optimize for clarity and utility.
- Use short paragraphs, headings, and bullets where helpful.
- Include examples, pitfalls, and next steps.
- If technical: include code snippets, formulas, pseudocode, or checklists.
- If non-technical: include frameworks, heuristics, decision criteria, and practice drills.
- Include credible references or links in a short "References" section at the end (3-7 items).
- Prefer canonical sources (official docs, textbooks, standards); avoid hallucinated links.

Structure guidance (required, evidence-based, and adaptive):
- Use a proven learning flow: orient the reader, build foundations, deepen understanding, apply with examples, then reinforce with practice/next steps.
- Always include a clear title.
- Tailor the flow to the user's level, goals, and interests.
- Choose the minimum set of sections needed to support that flow.
- Headings should reflect the topic (not a generic template).
- Keep the structure consistent and easy to follow, but avoid forced sections.`;
};

export async function POST(req: NextRequest) {
    try {
        const { history = [], party_a_context, party_b_context } = await req.json();

        const { apiKey, model, provider } = getLLMRequestConfig(req);

        if (!apiKey) {
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            try {
                const pyRes = await fetch(`${backendUrl}/api/ai/notebook`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ history, party_a_context, party_b_context })
                });
                return NextResponse.json(await pyRes.json(), { status: pyRes.status });
            } catch (err: any) {
                return NextResponse.json(
                    { error: 'Backend unavailable and no API key provided.', details: err.message },
                    { status: 503 }
                );
            }
        }

        const historyText = buildHistoryText(history);
        const systemPrompt = buildSystemPrompt(party_a_context, party_b_context);
        const userPrompt = `Conversation history:
${historyText}

Write the notebook now.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        let content = '';

        if (provider === 'anthropic') {
            const data = await makeAnthropicRequest(apiKey, {
                model,
                max_tokens: 2000,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }]
            });
            content = data.content?.[0]?.text || '';
        } else if (provider === 'google') {
            const data = await makeGoogleRequest(apiKey, model, `${systemPrompt}\n\n${userPrompt}`);
            content = data.text || '';
        } else if (provider === 'openrouter') {
            const data = await makeOpenRouterRequest(apiKey, { model, messages, temperature: 0.4 });
            content = data.choices?.[0]?.message?.content || '';
        } else if (provider === 'groq') {
            const data = await makeGroqRequest(apiKey, { model, messages, temperature: 0.4 });
            content = data.choices?.[0]?.message?.content || '';
        } else {
            const data = await makeOpenAIRequest(apiKey, '/chat/completions', { model, messages, temperature: 0.4 });
            content = data.choices?.[0]?.message?.content || '';
        }

        let markdown = (content || '').trim();
        markdown = markdown.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '').trim();

        return NextResponse.json({ markdown });
    } catch (error: any) {
        console.error('Error in /api/ai/notebook:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}

