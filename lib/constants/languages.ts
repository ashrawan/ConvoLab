export const LANGUAGE_NAMES: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'zh-cn': 'Chinese (Simplified)',
    'zh-tw': 'Chinese (Traditional)',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'ru': 'Russian',
    'nl': 'Dutch',
    'tr': 'Turkish',
    'pl': 'Polish',
    'vi': 'Vietnamese',
    'th': 'Thai',
    'id': 'Indonesian'
};

export const AVAILABLE_LANGUAGES = Object.keys(LANGUAGE_NAMES);

export const LANGUAGE_OPTIONS = Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
    code,
    name
}));
