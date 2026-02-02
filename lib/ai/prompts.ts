/**
 * AI Logic and Prompts (Shared between Client/Server)
 * 
 * Ported from backend/services/multimodal/llm/llm_service.py
 */

export const getLangName = (code: string) => {
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

export const prompts = {
    // Generate Conversation Suggestions (Sparks)
    suggestions: (
        userInput: string,
        aiResponse: string,
        contextText: string,
        numSuggestions: number,
        targetLangName: string,
        languageCode: string
    ) => `${contextText}Current exchange:
User: ${userInput}
AI: ${aiResponse}

Task: generate ${numSuggestions} concise, natural replies the user could realistically say next.

Guidelines:
- Language: ${targetLangName} (${languageCode}) only.
- Replies must be complete (not continuations).
- 3-10 words each, human and conversational.
- Match the current tone and topic; do not introduce new topics.
- Vary intent: question, follow-up, agreement, clarification, polite pushback.
- Avoid repetition and filler.

Examples (style only):
"Tell me more about that"
"That makes sense"
"Can you give an example?"
"I see it differently"
"What should I try next?"

Output ONLY the replies, one per line. No numbering or extra text.`,

    // Auto Play Message
    autoPlay: (
        partyAContext: string,
        partyBContext: string,
        historyText: string,
        partyALangName: string
    ) => `You are roleplaying as: ${partyAContext}
You are speaking with: ${partyBContext}

${historyText}

Write your next message. Keep it concise, natural, and in character.

Requirements:
- Stay in character as ${partyAContext}.
- Respond to the partner's last message and keep the conversation moving.
- 1-2 sentences maximum, short and conversational.
- Language: ${partyALangName} only.
- No prefixes, labels, or quotes.

Your next message:`,

    // Context Extraction
    contextExtraction: (text: string) => `Analyze this request and extract concise, real-world roles and languages.

Request: "${text}"

Roles:
- Party A = The User (speaker)
- Party B = The AI (partner/tutor/interviewer)

Context Rules:
1. Keep each context short (6-14 words), specific, and human.
2. Prefer: role + situation + intent (tone if implied).
3. Reflect domain and depth when implied (tech, business, creative, personal).
4. Reflect user level when implied:
   - Beginner: "Curious beginner exploring [topic]"
   - Professional: "Working professional seeking practical [topic] guidance"
   - Expert/PhD: "Advanced practitioner exploring nuanced [topic] discussion"
5. Learning or guidance:
   - Party A: "Learner interested in [topic/skill]"
   - Party B: "Supportive expert guiding the learner clearly"
6. Creative work (art, music, writing, design):
   - Party A: "Creator developing [art/music/design] ideas"
   - Party B: "Creative mentor offering refined, practical feedback"
7. Roleplay or situational practice:
   - Party A: "Person in [situation]"
   - Party B: "Helpful counterpart in that situation"
8. Language practice:
   - Party A: "Student practicing [language]"
   - Party B: "Friendly tutor guiding conversation"
9. Emotional or reflective topics:
   - Party A: "Person seeking clarity about [topic]"
   - Party B: "Supportive listener offering gentle, practical guidance"
10. If unclear, use "User" and "Helpful Assistant".

Language Rules:
- Return ISO 639-1 codes in "languages".
- Default to ["en"] when unclear.

Output ONLY valid JSON in this exact shape:
{
  "party_a": { "context": "...", "languages": ["en"] },
  "party_b": { "context": "...", "languages": ["en"] }
}

Examples:
Request: "learn Spanish for travel"
{
  "party_a": { "context": "Student practicing Spanish for travel situations", "languages": ["es"] },
  "party_b": { "context": "Friendly tutor guiding travel conversations", "languages": ["es"] }
}

Request: "I am a senior engineer planning system design interviews"
{
  "party_a": { "context": "Senior engineer refining system design interview skills", "languages": ["en"] },
  "party_b": { "context": "Experienced interviewer giving concise, practical feedback", "languages": ["en"] }
}

Request: "help me with music composition ideas"
{
  "party_a": { "context": "Composer developing new musical ideas", "languages": ["en"] },
  "party_b": { "context": "Creative mentor offering structured musical feedback", "languages": ["en"] }
}

Request: "PhD student discussing causal inference assumptions"
{
  "party_a": { "context": "PhD researcher exploring causal inference assumptions", "languages": ["en"] },
  "party_b": { "context": "Methodology expert clarifying nuances and tradeoffs", "languages": ["en"] }
}

Request: "I want to practice product pitches with empathy"
{
  "party_a": { "context": "Founder practicing an empathetic product pitch", "languages": ["en"] },
  "party_b": { "context": "Seasoned coach offering clear, constructive feedback", "languages": ["en"] }
}

Request: "talk about mental health and stress"
{
  "party_a": { "context": "Person seeking support about stress and wellbeing", "languages": ["en"] },
  "party_b": { "context": "Supportive listener offering gentle, practical guidance", "languages": ["en"] }
}`,

    // Random Scenario (Surprise Me)
    scenarioRandom: () => `Generate a short, engaging real-world scenario for a roleplay conversation.

Requirements:
- One sentence, 8-16 words.
- Clearly implies the user's role and situation.
- Natural, everyday scenarios (travel, food, work, hobbies, relationships).
- No numbering, quotes, or labels.
- Avoid repeating earlier outputs.

Example: "You are ordering coffee at a busy cafe in Paris."`,

    // Multi-Language Translation
    translateMultiple: (text: string, targetLangs: string[]) => `Translate the text into multiple languages.

Text: "${text}"
Target Languages: ${targetLangs.join(', ')}

Return ONLY a valid JSON object where keys are 2-letter language codes (e.g., "en", "es") and values are translations.
{
  "code": "translation",
  ...
}`,

    // Smart Phrase Prediction
    predictPhrases: (
        partyContext: string,
        historyText: string,
        langName: string,
        count: number = 3
    ) => `Analyze the conversation history. You are acting as: ${partyContext}.

${historyText}

Generate ${count} short, natural things you might say next.
- Language: ${langName}
- Brief and conversational (1-6 words).
- Varied options (agreement, question, statement).

Return ONLY a valid JSON array of strings:
["Phrase 1", "Phrase 2", "Phrase 3"]`
};
