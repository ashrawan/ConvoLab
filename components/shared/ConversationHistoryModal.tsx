import React, { useState, useEffect } from 'react';
import { chatService } from '@/lib/services/llm';
import { NotebookDoc, upsertNotebook } from '@/lib/utils/notebook-storage';

// Inline Icons to replace Lucide
const Icons = {
    X: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    MessageSquare: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
    ),
    ChevronDown: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    ),
    ChevronRight: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
    ),
    Globe: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    Notebook: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5.5A2.5 2.5 0 016.5 3h10A2.5 2.5 0 0119 5.5v13A2.5 2.5 0 0116.5 21h-10A2.5 2.5 0 014 18.5v-13z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h7M8 11h7M8 15h7" />
        </svg>
    )
};


interface HistoryItem {
    role: string;
    content: string;
    translations?: Record<string, string>;
}

interface ConversationHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: HistoryItem[];
    partyAContext?: string;
    partyBContext?: string;
}

const createNotebookId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const extractTitle = (markdown: string) => {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : '';
};

export function ConversationHistoryModal({ isOpen, onClose, history, partyAContext, partyBContext }: ConversationHistoryModalProps) {
    const [isNotebookGenerating, setIsNotebookGenerating] = useState(false);
    const [notebookError, setNotebookError] = useState<string | null>(null);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            // Lock body scroll
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const handleGenerateNotebook = async () => {
        if (history.length === 0 || isNotebookGenerating) return;
        setNotebookError(null);
        setIsNotebookGenerating(true);
        const pendingTab = window.open('about:blank', '_blank', 'noopener,noreferrer');

        try {
            const response = await chatService.generateNotebook({
                history: history.map(({ role, content }) => ({ role, content })),
                party_a_context: partyAContext,
                party_b_context: partyBContext
            });
            const markdown = (response.markdown || '').trim();
            if (!markdown) {
                throw new Error('Notebook generation returned empty content.');
            }

            const id = createNotebookId();
            const now = new Date().toISOString();
            const title = extractTitle(markdown) || 'Conversation Notebook';
            const notebook: NotebookDoc = {
                id,
                title,
                content: markdown,
                createdAt: now,
                updatedAt: now,
                source: {
                    partyAContext,
                    partyBContext,
                    messageCount: history.length
                }
            };

            upsertNotebook(notebook);
            const targetUrl = `/notebook/${id}`;
            if (pendingTab) {
                pendingTab.location.href = targetUrl;
            } else {
                window.open(targetUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to generate notebook.';
            setNotebookError(message);
            if (pendingTab) pendingTab.close();
        } finally {
            setIsNotebookGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-4xl max-h-[85vh] bg-card border border-border/70 rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/70 bg-muted/50 dark:bg-muted/20 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <Icons.MessageSquare className="w-5 h-5 text-primary" />
                        <h2 className="font-semibold text-lg">Current Conversation</h2>
                        <span className="text-xs font-mono bg-muted/60 px-2 py-0.5 rounded text-muted-foreground ml-2">
                            {history.length} messages
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGenerateNotebook}
                            disabled={isNotebookGenerating || history.length === 0}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-background/80 hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <Icons.Notebook className="w-4 h-4" />
                            {isNotebookGenerating ? 'Generating...' : 'Notebook'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                        >
                            <Icons.X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-background/80 dark:bg-background/40">
                    {notebookError && (
                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            {notebookError}
                        </div>
                    )}
                    {history.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <Icons.MessageSquare className="w-8 h-8 opacity-20" />
                            <p>No conversation history yet.</p>
                            <button
                                onClick={handleGenerateNotebook}
                                disabled={history.length === 0 || isNotebookGenerating}
                                className="text-xs font-semibold px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isNotebookGenerating ? 'Generating...' : 'Generate notebook'}
                            </button>
                        </div>
                    ) : (
                        history.map((item, idx) => (
                            <HistoryMessage key={idx} item={item} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function HistoryMessage({ item }: { item: HistoryItem }) {
    const isPartyA = item.role === 'party_a' || item.role === 'user';
    const [isTranslationsOpen, setIsTranslationsOpen] = useState(false);
    const hasTranslations = item.translations && Object.keys(item.translations).length > 0;

    return (
        <div className={`group flex flex-col max-w-[85%] ${isPartyA ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
            {/* Sender Label */}
            <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 px-1 text-muted-foreground opacity-80 ${isPartyA ? 'text-right' : 'text-left'}`}>
                {isPartyA ? 'You' : 'Response'}
            </span>

            {/* Bubble */}
            <div className={`relative px-4 py-3 rounded-2xl shadow-sm border ${isPartyA
                ? 'bg-primary text-primary-foreground border-primary/20 rounded-tr-sm'
                : 'bg-background text-foreground border-border/80 rounded-tl-sm'
                }`}>
                <p className="whitespace-pre-wrap leading-relaxed">
                    {item.content}
                </p>

                {/* Translation Toggle */}
                {hasTranslations && (
                    <button
                        onClick={() => setIsTranslationsOpen(!isTranslationsOpen)}
                        className={`mt-2 flex items-center gap-1.5 text-xs font-medium transition-colors ${isPartyA ? 'text-primary-foreground/70 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Icons.Globe className="w-3 h-3" />
                        <span>Translations</span>
                        {isTranslationsOpen ? <Icons.ChevronDown className="w-3 h-3" /> : <Icons.ChevronRight className="w-3 h-3" />}
                    </button>
                )}
            </div>

            {/* Collapsible Translations */}
            {hasTranslations && isTranslationsOpen && (
                <div className={`mt-2 w-full space-y-1.5 animate-in slide-in-from-top-2 duration-200 ${isPartyA ? 'text-right' : 'text-left'}`}>
                    {Object.entries(item.translations!).map(([lang, text]) => (
                        <div key={lang} className={`text-sm p-2 rounded-lg border shadow-sm ${isPartyA ? 'ml-auto bg-primary/10 border-primary/30' : 'mr-auto bg-muted/70 dark:bg-background/60 border-border/60'} inline-block max-w-full text-left`}>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] uppercase font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded">{lang}</span>
                            </div>
                            <p className="text-foreground leading-snug">{text}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
