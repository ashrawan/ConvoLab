'use client';
import { LANGUAGE_OPTIONS } from '@/lib/constants/languages';
import { motion, AnimatePresence } from 'framer-motion';

import React, { useState, useRef, useEffect } from 'react';

interface ContextInputProps {
    party: 'A' | 'B';
    value: string;
    onChange: (value: string) => void;
    onLanguagesChange?: (languages: string[]) => void;
    selectedLanguages?: string[];
    audioEnabledLanguages?: string[];
    onAudioEnabledChange?: (languages: string[]) => void;
    videoVisible?: boolean;
    onVideoVisibleChange?: () => void;
}

export default function ContextInput({
    party,
    value,
    onChange,
    onLanguagesChange,
    selectedLanguages = ['en'],
    audioEnabledLanguages = ['en'],
    onAudioEnabledChange,
    videoVisible = false,
    onVideoVisibleChange
}: ContextInputProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Refs
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const languages = LANGUAGE_OPTIONS;

    const toggleLanguage = (code: string) => {
        if (!onLanguagesChange) return;

        const newLanguages = selectedLanguages.includes(code)
            ? selectedLanguages.filter(l => l !== code)
            : [...selectedLanguages, code];

        // Ensure at least one language is selected
        if (newLanguages.length > 0) {
            onLanguagesChange(newLanguages);
        }
    };

    const moveLanguageUp = (index: number) => {
        if (!onLanguagesChange || index === 0) return;
        const newLanguages = [...selectedLanguages];
        [newLanguages[index - 1], newLanguages[index]] = [newLanguages[index], newLanguages[index - 1]];
        onLanguagesChange(newLanguages);
    };

    const moveLanguageDown = (index: number) => {
        if (!onLanguagesChange || index === selectedLanguages.length - 1) return;
        const newLanguages = [...selectedLanguages];
        [newLanguages[index], newLanguages[index + 1]] = [newLanguages[index + 1], newLanguages[index]];
        onLanguagesChange(newLanguages);
    };

    const removeLanguage = (lang: string) => {
        if (!onLanguagesChange || selectedLanguages.length === 1) return;
        const newLanguages = selectedLanguages.filter(l => l !== lang);
        onLanguagesChange(newLanguages);

        // Also remove from audio enabled if present
        if (onAudioEnabledChange && audioEnabledLanguages.includes(lang)) {
            onAudioEnabledChange(audioEnabledLanguages.filter(l => l !== lang));
        }
    };

    const toggleAudio = (lang: string) => {
        if (!onAudioEnabledChange) return;

        const newAudioEnabled = audioEnabledLanguages.includes(lang)
            ? audioEnabledLanguages.filter(l => l !== lang)
            : [...audioEnabledLanguages, lang];

        onAudioEnabledChange(newAudioEnabled);
    };

    const primaryLanguage = selectedLanguages[0] || 'en';

    return (
        <div className="relative flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0a0a0b]">
            {/* Party Label */}
            <div className={`flex items-center gap-2 min-w-[100px] ${party === 'A' ? 'text-violet-400' : 'text-emerald-400'
                }`}>
                <span className="font-semibold">{party === 'A' ? 'You' : 'Assistant'}</span>

                {/* Video Toggle Icon - Only for Party A, on the left */}
                {party === 'A' && onVideoVisibleChange && (
                    <button
                        onClick={onVideoVisibleChange}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition ${videoVisible
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                            }`}
                        title={videoVisible ? "Hide video" : "Show video"}
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                        </svg>
                    </button>
                )}

            </div>

            {/* Context Label */}
            <span className="text-xs text-gray-500">Context:</span>

            {/* Context Input */}
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={party === 'A' ? 'e.g., Chat with AI, Help me with ...' : 'e.g., Assist the user'}
                className="flex-1 bg-transparent text-sm placeholder:text-gray-600 focus:outline-none px-3 py-1.5 rounded-lg hover:bg-white/5 focus:bg-white/5 transition"
            />

            {/* Language Code Badges */}
            <div className="flex items-center gap-1">
                {selectedLanguages.slice(0, 3).map((lang, idx) => (
                    <span
                        key={lang}
                        className={`text-xs px-2 py-0.5 rounded ${idx === 0
                            ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                            : 'bg-white/10 text-gray-400'
                            }`}
                        title={idx === 0 ? 'Primary language' : ''}
                    >
                        {lang.toUpperCase()}
                    </span>
                ))}
                {selectedLanguages.length > 3 && (
                    <span className="text-xs px-2 py-0.5 bg-white/10 rounded text-gray-400">
                        +{selectedLanguages.length - 3}
                    </span>
                )}
            </div>

            {/* Settings Menu */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition"
                    title="Language settings"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                    </svg>
                </button>

                {/* Dropdown Menu */}
                {showMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-[#1a1a1d] border border-white/10 rounded-xl shadow-xl z-30 py-2 min-w-[300px]">
                        {/* Selected Languages Section */}
                        {onLanguagesChange && selectedLanguages.length > 0 && (
                            <>
                                <div className="px-4 py-2">
                                    <p className="text-xs text-gray-500 mb-2">
                                        {party === 'A' ? 'Languages you know/learning:' : 'Response languages:'}
                                    </p>
                                    <div className="space-y-1 mt-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar relative">
                                        {selectedLanguages.map((lang, index) => {
                                            const isAudioEnabled = audioEnabledLanguages.includes(lang);
                                            const languageName = languages.find(l => l.code === lang)?.name || lang;
                                            return (
                                                <motion.div
                                                    layout
                                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                    key={lang}
                                                    className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1d] hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 relative z-0"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm ${index === 0 ? 'text-emerald-300 font-semibold' : 'text-gray-300'
                                                            }`}>
                                                            {languageName}
                                                        </span>
                                                        {index === 0 && (
                                                            <span className="text-xs px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                                                                Primary
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {/* Audio Toggle - Show for all languages in both parties */}
                                                        <button
                                                            onClick={() => toggleAudio(lang)}
                                                            className={`p-1 rounded transition ${isAudioEnabled
                                                                ? 'text-emerald-400 hover:bg-emerald-500/10'
                                                                : 'text-gray-600 hover:bg-white/5 hover:text-gray-400'
                                                                }`}
                                                            title={isAudioEnabled ? 'Auto-play ON' : 'Auto-play OFF'}
                                                        >
                                                            {isAudioEnabled ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                                    <line x1="23" y1="9" x2="17" y2="15"></line>
                                                                    <line x1="17" y1="9" x2="23" y2="15"></line>
                                                                </svg>
                                                            )}
                                                        </button>

                                                        {/* Move Up */}
                                                        <button
                                                            onClick={() => moveLanguageUp(index)}
                                                            disabled={index === 0}
                                                            className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                                                            title="Move up"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="12" y1="19" x2="12" y2="5"></line>
                                                                <polyline points="5 12 12 5 19 12"></polyline>
                                                            </svg>
                                                        </button>

                                                        {/* Move Down */}
                                                        <button
                                                            onClick={() => moveLanguageDown(index)}
                                                            disabled={index === selectedLanguages.length - 1}
                                                            className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                                                            title="Move down"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                                <polyline points="19 12 12 19 5 12"></polyline>
                                                            </svg>
                                                        </button>

                                                        {/* Remove */}
                                                        <button
                                                            onClick={() => removeLanguage(lang)}
                                                            disabled={selectedLanguages.length === 1}
                                                            className="p-1 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                                                            title="Remove language"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>

                            </>
                        )}

                        {/* Add Language Section */}
                        {onLanguagesChange && (
                            <div className="px-4 py-2 border-t border-white/10">
                                <p className="text-xs text-gray-500 mb-2">
                                    {party === 'A' ? 'Add language to learn:' : 'Add language:'}
                                </p>

                                {/* Search Input */}
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search languages..."
                                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 mb-2"
                                />

                                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                                    {languages
                                        .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.code.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map(lang => {
                                            const isSelected = selectedLanguages.includes(lang.code);
                                            return (
                                                <button
                                                    key={lang.code}
                                                    onClick={() => toggleLanguage(lang.code)}
                                                    className={`w-full text-left px-3 py-1.5 text-sm rounded transition flex items-center justify-between ${isSelected ? 'bg-emerald-500/10 text-emerald-300' : 'text-gray-400 hover:bg-white/5 hover:text-gray-300'
                                                        }`}
                                                >
                                                    <span>{lang.name}</span>
                                                    {isSelected && (
                                                        <span className="text-emerald-400 text-xs">✓</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    {languages.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.code.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                        <div className="text-xs text-gray-500 text-center py-2">No languages found</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
}
