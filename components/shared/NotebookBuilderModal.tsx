import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatService } from '@/lib/services/llm';
import { NotebookDoc, upsertNotebook } from '@/lib/utils/notebook-storage';

interface NotebookBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved?: (doc: NotebookDoc) => void;
    initialNotebook?: NotebookDoc | null;
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

export const NotebookBuilderModal: React.FC<NotebookBuilderModalProps> = ({
    isOpen,
    onClose,
    onSaved,
    initialNotebook
}) => {
    const [content, setContent] = useState('');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'both'>('both');

    useEffect(() => {
        if (!isOpen) return;
        setContent(initialNotebook?.content || '');
        setPrompt('');
        setError(null);
        setViewMode('both');
    }, [isOpen, initialNotebook]);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const handleGenerate = async () => {
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt) {
            setError('Add a prompt to generate a notebook.');
            return;
        }

        setIsGenerating(true);
        setError(null);
        try {
            const response = await chatService.generateNotebook({
                history: [{ role: 'party_a', content: trimmedPrompt }]
            });
            const markdown = (response.markdown || '').trim();
            if (!markdown) {
                throw new Error('Notebook generation returned empty content.');
            }
            setContent(markdown);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate notebook.';
            setError(message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        const trimmedContent = content.trim();
        if (!trimmedContent) {
            setError('Add notebook content before saving.');
            return;
        }

        const now = new Date().toISOString();
        const inferredTitle = extractTitle(trimmedContent);
        const resolvedTitle = inferredTitle || initialNotebook?.title || 'Untitled Notebook';

        const doc: NotebookDoc = {
            id: initialNotebook?.id ?? createNotebookId(),
            title: resolvedTitle,
            content: trimmedContent,
            createdAt: initialNotebook?.createdAt ?? now,
            updatedAt: now,
            source: initialNotebook?.source
        };

        upsertNotebook(doc);
        onSaved?.(doc);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-[96vw] h-[90vh] max-w-none bg-card border border-border/70 rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-border/70 bg-muted/40 rounded-t-xl">
                    <div>
                        <h2 className="text-base font-semibold">Notebook Builder</h2>
                        <p className="text-[11px] text-muted-foreground">Paste markdown or generate one from a prompt.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        aria-label="Close notebook builder"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 flex flex-col gap-4 p-5 overflow-hidden relative">
                    {isGenerating && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-transparent pointer-events-none">
                            <div className="h-full bg-gradient-to-r from-transparent via-primary/70 to-transparent animate-pulse" />
                        </div>
                    )}
                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <input
                                    value={prompt}
                                    onChange={(event) => setPrompt(event.target.value)}
                                    placeholder="Describe the notebook you want to build..."
                                    className="flex-1 rounded-lg border border-border bg-background p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="px-4 py-2.5 text-xs font-semibold rounded-lg border border-border bg-background/80 hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isGenerating ? 'Generating...' : 'Generate'}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 rounded-full border border-border bg-background/70 p-1 shrink-0">
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

                    <div
                        className={`grid gap-4 flex-1 min-h-0 ${viewMode === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}
                    >
                        {(viewMode === 'edit' || viewMode === 'both') && (
                            <div className="flex flex-col gap-2 min-h-0">
                                <label className="text-sm font-medium">Markdown</label>
                                <textarea
                                    value={content}
                                    onChange={(event) => setContent(event.target.value)}
                                    placeholder="# Notebook title \n\n Write or paste your markdown here..."
                                    className="flex-1 min-h-0 w-full rounded-lg border border-border bg-background p-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                                />
                            </div>
                        )}
                        {(viewMode === 'preview' || viewMode === 'both') && (
                            <div className="flex flex-col gap-2 min-h-0">
                                <label className="text-sm font-medium">Preview</label>
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
                                        {content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 p-4 border-t border-border/70 bg-background">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm transition-all active:scale-95"
                    >
                        Save Notebook
                    </button>
                </div>
            </div>
        </div>
    );
};

