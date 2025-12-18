import { useState, useRef, useEffect, useMemo } from 'react';
import { LANGUAGE_NAMES } from '@/lib/constants/languages';

interface LanguageSelectorProps {
    availableLanguages: string[];
    selectedLanguages: string[];
    onLanguagesChange: (languages: string[]) => void;
    primaryLanguage?: string;
    label?: string;
}

export default function LanguageSelector({
    availableLanguages,
    selectedLanguages,
    onLanguagesChange,
    primaryLanguage,
    label = "Select languages"
}: LanguageSelectorProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
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

    // Reset search when menu closes
    useEffect(() => {
        if (!showMenu) setSearchQuery('');
    }, [showMenu]);

    const toggleLanguage = (lang: string) => {
        const newSelection = selectedLanguages.includes(lang)
            ? selectedLanguages.filter(l => l !== lang)
            : [...selectedLanguages, lang];

        // Keep at least the primary language selected
        if (newSelection.length === 0 && primaryLanguage) {
            newSelection.push(primaryLanguage);
        }

        onLanguagesChange(newSelection);
    };

    // 1. Get display name helper
    const getDisplayName = (code: string) => LANGUAGE_NAMES[code.toLowerCase()] || code;

    // 2. Memoized filtered & sorted languages
    const filteredLanguages = useMemo(() => {
        // First sort alphabetically
        const sorted = [...availableLanguages].sort((a, b) =>
            getDisplayName(a).localeCompare(getDisplayName(b))
        );

        // Then filter by search
        if (!searchQuery.trim()) return sorted;

        const query = searchQuery.toLowerCase();
        return sorted.filter(lang =>
            getDisplayName(lang).toLowerCase().includes(query) ||
            lang.toLowerCase().includes(query)
        );
    }, [availableLanguages, searchQuery]);

    return (
        <div className="relative inline-block" ref={menuRef}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                title={label}
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                </svg>
            </button>

            {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-xl z-30 py-2 min-w-[240px] flex flex-col">
                    <div className="px-4 py-2 border-b border-border">
                        <p className="text-xs text-muted-foreground mb-2">{label}</p>
                        {/* Search Input */}
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="w-full bg-muted/20 border border-border rounded px-2 py-1 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-primary/50"
                            autoFocus
                        />
                    </div>

                    <div className="max-h-64 overflow-y-auto py-1">
                        {filteredLanguages.length > 0 ? (
                            filteredLanguages.map((lang) => {
                                const isSelected = selectedLanguages.includes(lang);
                                const isPrimary = lang === primaryLanguage;

                                return (
                                    <button
                                        key={lang}
                                        onClick={() => toggleLanguage(lang)}
                                        className={`w-full text-left px-4 py-2 text-sm transition flex items-center gap-2 ${isSelected
                                            ? 'bg-primary/20 text-primary'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                    >
                                        <span className="flex-1 truncate">{getDisplayName(lang)}</span>
                                        {isPrimary && <span className="text-xs text-primary shrink-0">★</span>}
                                        {isSelected && <span className="text-primary shrink-0">✓</span>}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                                No languages found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
