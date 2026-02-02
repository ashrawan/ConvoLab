export const makeOpenAIRequest = async (
    apiKey: string,
    endpoint: string,
    body: any
) => {
    const safeKey = apiKey.trim();
    const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${safeKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`OpenAI API Error: ${response.statusText}`);
    }

    return response.json();
};

export const makeAnthropicRequest = async (
    apiKey: string,
    body: any
) => {
    const url = 'https://api.anthropic.com/v1/messages';
    // console.log(`[Anthropic API] Calling: ${url} with model: ${body.model}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    // User added console.log(response) here, removing it to clean up and using our enhanced errors
    if (!response.ok) {
        let errorBody = await response.text();
        console.error(`[Anthropic API] Error ${response.status}: ${errorBody}`);
        throw new Error(`Anthropic API Error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
};

export const makeGoogleRequest = async (
    apiKey: string,
    model: string,
    prompt: string
) => {
    // Sanitize
    const safeKey = apiKey.trim();
    const safeModel = model.trim();

    // Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent?key=${safeKey}`;

    console.log(`[Google API] Calling: ${url.replace(safeKey, '***')}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        let errorBody = await response.text();
        console.error(`[Google API] Error ${response.status}: ${errorBody}`);
        throw new Error(`Google API Error: ${response.status} ${response.statusText} - ${errorBody.substring(0, 100)}`);
    }

    const data = await response.json();
    // Normalize response to return text content
    return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || ""
    };
};

export const makeOpenRouterRequest = async (
    apiKey: string,
    body: any
) => {
    const safeKey = apiKey.trim();
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${safeKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://convolab.ai', // Optional, required by OpenRouter for ranking
            'X-Title': 'ConvoLab'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`OpenRouter API Error: ${response.statusText}`);
    }

    return response.json();
};

export const makeGroqRequest = async (
    apiKey: string,
    body: any
) => {
    const safeKey = apiKey.trim();
    // Groq uses OpenAI-compatible API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${safeKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Groq API] Error ${response.status}: ${errorBody}`);
        throw new Error(`Groq API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
};
