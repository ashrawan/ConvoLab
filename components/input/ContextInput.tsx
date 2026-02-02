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
    onHistoryClick?: () => void;
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
    onVideoVisibleChange,
    onHistoryClick
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
        <div className="relative flex flex-nowrap items-center gap-2 px-3 py-2 border-b border-border bg-background z-20">
            {/* Party Label */}
            <div className={`flex items-center gap-2 shrink-0 ${party === 'A' ? 'text-violet-700 dark:text-violet-400' : 'text-blue-700 dark:text-blue-400'}`}>
                {/* History Button - Left of "You" */}
                {party === 'A' && onHistoryClick && (
                    <button
                        onClick={onHistoryClick}
                        className="p-1 rounded hover:bg-violet-500/10 text-violet-700 dark:text-violet-400 transition-colors mr-1"
                        title="Knowledge Store"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h10A2.5 2.5 0 0 1 19 5.5v13A2.5 2.5 0 0 1 16.5 21h-10A2.5 2.5 0 0 1 4 18.5v-13Z" />
                            <path d="M8 7h7M8 11h7M8 15h7" />
                        </svg>
                    </button>
                )}

                <span className="font-semibold text-sm md:text-base">{party === 'A' ? 'You' : 'AI'}</span>

                {/* Video Toggle Icon - Only for Party A */}
                {party === 'A' && onVideoVisibleChange && (
                    <button
                        onClick={onVideoVisibleChange}
                        className={`w-6 h-6 flex items-center justify-center rounded transition ${videoVisible
                            ? 'bg-blue-500/20 text-blue-800 dark:text-blue-400'
                            : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                            }`}
                        title={videoVisible ? "Hide video" : "Show video"}
                    >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Context Input - Flexible with min-width to prevent overflow */}
            <div className="flex-1 min-w-0 relative group">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={party === 'A' ? 'Chat context...' : 'AI role...'}
                    className="w-full bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none px-2 py-1 rounded hover:bg-muted/30 focus:bg-muted/30 transition truncate"
                />
            </div>

            {/* Language Code Badges - Compact on mobile */}
            <div className="flex items-center gap-1 shrink-0">
                {selectedLanguages.slice(0, 1).map((lang) => (
                    <span
                        key={lang}
                        className="text-[10px] md:text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-800 dark:text-blue-400 font-medium"
                    >
                        {lang.toUpperCase()}
                    </span>
                ))}
                {selectedLanguages.length > 1 && (
                    <span className="text-[10px] md:text-xs text-muted-foreground">
                        +{selectedLanguages.length - 1}
                    </span>
                )}
            </div>

            {/* Settings Menu */}
            <div className="relative shrink-0" ref={menuRef}>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                    title="Language settings"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                    </svg>
                </button>

                {showMenu && (
                    <div className={`absolute top-full mt-1 bg-popover border border-border rounded-xl shadow-2xl z-50 py-2 w-[280px] max-w-[90vw] ${party === 'A' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
                        }`}>
                        {/* Selected Languages Section */}
                        {onLanguagesChange && selectedLanguages.length > 0 && (
                            <>
                                <div className="px-4 py-2">
                                    <p className="text-xs text-muted-foreground mb-2">
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
                                                    className="flex items-center justify-between px-3 py-1.5 bg-popover hover:bg-accent rounded-lg border border-transparent hover:border-border relative z-0"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm ${index === 0 ? 'text-blue-800 dark:text-blue-400 font-semibold' : 'text-foreground'
                                                            }`}>
                                                            {languageName}
                                                        </span>
                                                        {index === 0 && (
                                                            <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-800 dark:text-blue-400 rounded">
                                                                Primary
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {/* Playback Toggle - Show for all languages in both parties */}
                                                        <button
                                                            onClick={() => toggleAudio(lang)}
                                                            className={`p-1 rounded transition ${isAudioEnabled
                                                                ? 'text-blue-700 dark:text-blue-400 hover:bg-blue-500/10'
                                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                                }`}
                                                            title={isAudioEnabled ? 'Playback ON' : 'Playback OFF'}
                                                        >
                                                            {isAudioEnabled ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                                                    <path d="M8 5v14l11-7z" />
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <circle cx="12" cy="12" r="10" />
                                                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                                </svg>
                                                            )}
                                                        </button>

                                                        {/* Move Up */}
                                                        <button
                                                            onClick={() => moveLanguageUp(index)}
                                                            disabled={index === 0}
                                                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
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
                                                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
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
                            <div className="px-4 py-2 border-t border-border">
                                <p className="text-xs text-muted-foreground mb-2">
                                    {party === 'A' ? 'Add language to learn:' : 'Add language:'}
                                </p>

                                {/* Search Input */}
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search languages..."
                                    className="w-full bg-muted/20 border border-border rounded px-2 py-1 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 mb-2"
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
                                                    className={`w-full text-left px-3 py-1.5 text-sm rounded transition flex items-center justify-between ${isSelected ? 'bg-blue-500/10 text-blue-800 dark:text-blue-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                        }`}
                                                >
                                                    <span>{lang.name}</span>
                                                    {isSelected && (
                                                        <span className="text-blue-700 dark:text-blue-400 text-xs">✓</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    {languages.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.code.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                        <div className="text-xs text-muted-foreground text-center py-2">No languages found</div>
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
