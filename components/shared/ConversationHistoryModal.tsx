import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatService } from '@/lib/services/llm';
import { NotebookDoc, deleteNotebook, loadNotebooks, upsertNotebook } from '@/lib/utils/notebook-storage';

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
    const [activeTab, setActiveTab] = useState<'history' | 'notebook'>('history');
    const [isNotebookGenerating, setIsNotebookGenerating] = useState(false);
    const [notebookError, setNotebookError] = useState<string | null>(null);
    const [notebooks, setNotebooks] = useState<NotebookDoc[]>([]);
    const [draftId, setDraftId] = useState<string | null>(null);
    const [draftContent, setDraftContent] = useState('');
    const [draftTitle, setDraftTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'both'>('both');
    const [conversationPrompt, setConversationPrompt] = useState('');
    const [notebookPrompt, setNotebookPrompt] = useState('');
    const [selectedNotebookIds, setSelectedNotebookIds] = useState<string[]>([]);

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

    useEffect(() => {
        if (!isOpen) return;
        setNotebooks(loadNotebooks());
        setSelectedNotebookIds([]);
    }, [isOpen]);

    const existingDraft = notebooks.find((item) => item.id === draftId) || null;
    const resolvedTitle = draftTitle || extractTitle(draftContent) || 'Conversation Notebook';

    const handleGenerateNotebook = async (prompt?: string) => {
        if (history.length === 0 || isNotebookGenerating) return;
        setNotebookError(null);
        setIsNotebookGenerating(true);

        try {
            const promptText = prompt?.trim();
            const historyPayload = promptText
                ? [...history.map(({ role, content }) => ({ role, content })), { role: 'party_a', content: promptText }]
                : history.map(({ role, content }) => ({ role, content }));
            const response = await chatService.generateNotebook({
                history: historyPayload,
                party_a_context: partyAContext,
                party_b_context: partyBContext
            });
            const markdown = (response.markdown || '').trim();
            if (!markdown) {
                throw new Error('Notebook generation returned empty content.');
            }
            setDraftId(null);
            setDraftContent(markdown);
            setDraftTitle(extractTitle(markdown));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to generate notebook.';
            setNotebookError(message);
        } finally {
            setIsNotebookGenerating(false);
        }
    };

    const handleGenerateAndSave = async () => {
        if (history.length === 0 || isNotebookGenerating) return;
        setNotebookError(null);
        setIsNotebookGenerating(true);
        setIsSaving(true);

        try {
            const promptText = conversationPrompt.trim();
            const historyPayload = promptText
                ? [...history.map(({ role, content }) => ({ role, content })), { role: 'party_a', content: promptText }]
                : history.map(({ role, content }) => ({ role, content }));
            const response = await chatService.generateNotebook({
                history: historyPayload,
                party_a_context: partyAContext,
                party_b_context: partyBContext
            });
            const markdown = (response.markdown || '').trim();
            if (!markdown) {
                throw new Error('Notebook generation returned empty content.');
            }

            const now = new Date().toISOString();
            const id = createNotebookId();
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
            setNotebooks(loadNotebooks());
            setDraftId(id);
            setDraftContent(markdown);
            setDraftTitle(title);
            setActiveTab('notebook');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to generate notebook.';
            setNotebookError(message);
        } finally {
            setIsNotebookGenerating(false);
            setIsSaving(false);
        }
    };

    const handleSelectNotebook = (doc: NotebookDoc) => {
        setDraftId(doc.id);
        setDraftContent(doc.content);
        setDraftTitle(doc.title);
        setNotebookError(null);
        setNotebookPrompt('');
    };

    const handleSaveNotebook = () => {
        const trimmed = draftContent.trim();
        if (!trimmed) {
            setNotebookError('Add notebook content before saving.');
            return;
        }
        setIsSaving(true);
        const now = new Date().toISOString();
        const id = draftId ?? createNotebookId();
        const notebook: NotebookDoc = {
            id,
            title: resolvedTitle,
            content: trimmed,
            createdAt: existingDraft?.createdAt ?? now,
            updatedAt: now,
            source: existingDraft?.source ?? {
                partyAContext,
                partyBContext,
                messageCount: history.length
            }
        };
        upsertNotebook(notebook);
        setDraftId(id);
        setDraftTitle(resolvedTitle);
        setNotebooks(loadNotebooks());
        setIsSaving(false);
    };

    const handleDeleteNotebook = (id: string) => {
        const confirmed = window.confirm('Delete this notebook? This cannot be undone.');
        if (!confirmed) return;
        deleteNotebook(id);
        const refreshed = loadNotebooks();
        setNotebooks(refreshed);
        if (draftId === id) {
            setDraftId(null);
            setDraftContent('');
            setDraftTitle('');
        }
    };

    const toggleNotebookSelection = (id: string) => {
        setSelectedNotebookIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedNotebookIds.length === notebooks.length) {
            setSelectedNotebookIds([]);
        } else {
            setSelectedNotebookIds(notebooks.map(item => item.id));
        }
    };

    const handleDeleteSelected = () => {
        if (selectedNotebookIds.length === 0) return;
        const confirmed = window.confirm(`Delete ${selectedNotebookIds.length} notebook(s)? This cannot be undone.`);
        if (!confirmed) return;
        selectedNotebookIds.forEach(deleteNotebook);
        const refreshed = loadNotebooks();
        setNotebooks(refreshed);
        if (draftId && selectedNotebookIds.includes(draftId)) {
            setDraftId(null);
            setDraftContent('');
            setDraftTitle('');
        }
        setSelectedNotebookIds([]);
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-[96vw] h-[90vh] max-w-none bg-card border border-border/70 rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-border/70 bg-muted/50 dark:bg-muted/20 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <Icons.MessageSquare className="w-5 h-5 text-primary" />
                        <h2 className="font-semibold text-base">Knowledge Store</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                    >
                        <Icons.X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/70 bg-background/80">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors flex items-center gap-2 ${activeTab === 'history'
                                ? 'bg-primary/20 text-primary border-primary/30'
                                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                        >
                            Conversation
                            <span className="text-[10px] font-mono bg-muted/60 px-2 py-0.5 rounded text-muted-foreground">
                                {history.length} messages
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('notebook')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${activeTab === 'notebook'
                                ? 'bg-primary/20 text-primary border-primary/30'
                                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                        >
                            Notebook
                        </button>
                        
                    </div>
                    {activeTab === 'history' && history.length > 0 && (
                        <button
                            onClick={handleGenerateAndSave}
                            disabled={isNotebookGenerating || isSaving}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isNotebookGenerating || isSaving ? 'Generating...' : 'Generate notebook from conversation'}
                        </button>
                    )}
                    {activeTab === 'notebook' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSaveNotebook}
                                disabled={isSaving}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Saving...' : 'Save Notebook'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                {activeTab === 'history' ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-background/80 dark:bg-background/40 relative">
                        {isNotebookGenerating && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-transparent pointer-events-none">
                                <div className="h-full bg-gradient-to-r from-transparent via-primary/70 to-transparent animate-pulse" />
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <input
                                value={conversationPrompt}
                                onChange={(event) => setConversationPrompt(event.target.value)}
                                placeholder="Optional prompt to guide the notebook..."
                                className="flex-1 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                            <button
                                onClick={handleGenerateAndSave}
                                disabled={history.length === 0 || isNotebookGenerating || isSaving}
                                className="px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isNotebookGenerating || isSaving ? 'Generating...' : 'Generate notebook'}
                            </button>
                        </div>
                        {history.length === 0 ? (
                            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                                <Icons.MessageSquare className="w-8 h-8 opacity-20" />
                                <p>No conversation history yet.</p>
                            </div>
                        ) : (
                            history.map((item, idx) => (
                                <HistoryMessage key={idx} item={item} />
                            ))
                        )}
                    </div>
                ) : (
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 p-4 overflow-hidden bg-background/80 dark:bg-background/40 relative">
                        {isNotebookGenerating && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-transparent pointer-events-none">
                                <div className="h-full bg-gradient-to-r from-transparent via-primary/70 to-transparent animate-pulse" />
                            </div>
                        )}
                        {/* Manage Notebooks */}
                        <div className="flex flex-col gap-3 border border-border/70 rounded-lg p-3 bg-muted/20 overflow-hidden">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manage</span>
                                    {notebooks.length > 0 && (
                                        <button
                                            onClick={handleSelectAll}
                                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border border-border hover:bg-muted transition-colors"
                                            title={selectedNotebookIds.length === notebooks.length ? 'Clear selection' : 'Select all'}
                                        >
                                            <span className="inline-flex w-3 h-3 items-center justify-center rounded border border-border text-[9px]">
                                                {selectedNotebookIds.length === notebooks.length ? '✓' : ''}
                                            </span>
                                            All
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleDeleteSelected}
                                        disabled={selectedNotebookIds.length === 0}
                                        className="text-[10px] font-semibold px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Delete selected"
                                    >
                                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18" />
                                            <path d="M8 6V4h8v2" />
                                            <path d="M6 6l1 14h10l1-14" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDraftId(null);
                                            setDraftContent('');
                                            setDraftTitle('');
                                            setNotebookPrompt('');
                                        }}
                                        className="text-[10px] font-semibold px-2 py-1 rounded-md border border-border hover:bg-muted transition-colors"
                                    >
                                        New
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                                {notebooks.length === 0 && (
                                    <div className="text-xs text-muted-foreground">No notebooks yet.</div>
                                )}
                                {notebooks.map((notebook) => (
                                    <div
                                        key={notebook.id}
                                        className={`rounded-lg border p-2 text-xs transition-colors cursor-pointer ${draftId === notebook.id
                                            ? 'border-primary/40 bg-primary/10'
                                            : 'border-border bg-background/70 hover:bg-muted/40'
                                            }`}
                                        onClick={() => handleSelectNotebook(notebook)}
                                    >
                                        <div className="flex items-start gap-2">
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    toggleNotebookSelection(notebook.id);
                                                }}
                                                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${selectedNotebookIds.includes(notebook.id)
                                                    ? 'bg-primary/20 border-primary/40 text-primary'
                                                    : 'border-border text-muted-foreground'
                                                    }`}
                                                title="Select notebook"
                                            >
                                                {selectedNotebookIds.includes(notebook.id) && (
                                                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M9 16.2l-3.5-3.5-1.4 1.4L9 19 20.3 7.7l-1.4-1.4z" />
                                                    </svg>
                                                )}
                                            </button>
                                            <div className="min-w-0">
                                                <div className="font-semibold text-foreground truncate">
                                                    {notebook.title || 'Untitled Notebook'}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1">
                                                    Updated {new Date(notebook.updatedAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleSelectNotebook(notebook);
                                                }}
                                                className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-border hover:bg-muted transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleDeleteNotebook(notebook.id);
                                                }}
                                                className="p-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                title="Delete notebook"
                                            >
                                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M3 6h18" />
                                                    <path d="M8 6V4h8v2" />
                                                    <path d="M6 6l1 14h10l1-14" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Editor + Preview */}
                        <div className="flex flex-col gap-3 overflow-hidden">
                            {notebookError && (
                                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                                    {notebookError}
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-3">
                                <input
                                    value={draftTitle}
                                    onChange={(event) => setDraftTitle(event.target.value)}
                                    placeholder={resolvedTitle}
                                    className="flex-1 rounded-md border border-border bg-background/40 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                                <div className="flex items-center gap-1 rounded-full border border-border bg-background/70 p-1">
                                    {(['edit', 'preview', 'both'] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => setViewMode(mode)}
                                            className={`px-2.5 py-1 text-[10px] font-semibold rounded-full transition-colors ${viewMode === mode
                                                ? 'bg-primary/20 text-primary border border-primary/30'
                                                : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                        >
                                            {mode === 'edit' ? 'Edit' : mode === 'preview' ? 'Preview' : 'Both'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {!draftId && (
                                <div className="flex items-center gap-2">
                                    <input
                                        value={notebookPrompt}
                                        onChange={(event) => setNotebookPrompt(event.target.value)}
                                        placeholder="Prompt to build a notebook..."
                                        className="flex-1 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                                    />
                                    <button
                                        onClick={() => handleGenerateNotebook(notebookPrompt)}
                                        disabled={isNotebookGenerating}
                                        className="px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-background/80 hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {isNotebookGenerating ? 'Generating...' : 'Generate'}
                                    </button>
                                </div>
                            )}
                            <div
                                className={`grid gap-4 flex-1 min-h-0 ${viewMode === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}
                            >
                                {(viewMode === 'edit' || viewMode === 'both') && (
                                    <div className="flex flex-col gap-2 min-h-0">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Markdown</span>
                                        <textarea
                                            value={draftContent}
                                            onChange={(event) => setDraftContent(event.target.value)}
                                            placeholder="# Notebook title\n\nWrite or paste your markdown here..."
                                            className="flex-1 min-h-0 w-full rounded-lg border border-border bg-card/60 p-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                                        />
                                    </div>
                                )}
                                {(viewMode === 'preview' || viewMode === 'both') && (
                                    <div className="flex flex-col gap-2 min-h-0">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</span>
                                        <div className="flex-1 min-h-0 w-full rounded-lg border border-border bg-card/60 p-4 overflow-y-auto custom-scrollbar">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h1: ({ children }) => <h1 className="text-xl font-semibold mb-3 mt-4">{children}</h1>,
                                                    h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 mt-4">{children}</h2>,
                                                    h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-3">{children}</h3>,
                                                    p: ({ children }) => <p className="text-sm leading-relaxed text-foreground/90">{children}</p>,
                                                    ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 text-sm">{children}</ul>,
                                                    ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 text-sm">{children}</ol>,
                                                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                                    code: ({ children }) => <code className="px-1 py-0.5 rounded bg-muted text-xs">{children}</code>,
                                                    pre: ({ children }) => (
                                                        <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs leading-relaxed">{children}</pre>
                                                    ),
                                                    blockquote: ({ children }) => (
                                                        <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground italic">{children}</blockquote>
                                                    )
                                                }}
                                            >
                                                {draftContent}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
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
            <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 px-1 text-muted-foreground opacity-80 flex items-center gap-1 ${isPartyA ? 'text-right' : 'text-left'}`}>
                {isPartyA ? (
                    <>
                        <Icons.Notebook className="w-3 h-3" />
                        You
                    </>
                ) : (
                    <>
                        <Icons.MessageSquare className="w-3 h-3" />
                        Response
                    </>
                )}
            </span>

            {/* Bubble */}
            <div className={`relative px-4 py-3 rounded-2xl shadow-sm border ${isPartyA
                ? 'bg-primary text-primary-foreground border-primary/20 rounded-tr-sm'
                : 'bg-background text-foreground border-border/80 rounded-tl-sm'
                }`}>
                <div className="whitespace-pre-wrap leading-relaxed prose prose-invert max-w-none">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
                            li: ({ children }) => <li>{children}</li>,
                            code: ({ children }) => <code className="px-1 py-0.5 rounded bg-muted text-xs">{children}</code>,
                            pre: ({ children }) => (
                                <pre className="bg-muted/40 p-3 rounded-md overflow-x-auto text-xs leading-relaxed">{children}</pre>
                            )
                        }}
                    >
                        {item.content}
                    </ReactMarkdown>
                </div>

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
