'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getNotebookById, NotebookDoc, upsertNotebook } from '@/lib/utils/notebook-storage';

const formatDate = (value: string) => {
    try {
        return new Date(value).toLocaleString();
    } catch {
        return value;
    }
};

export default function NotebookPage() {
    const params = useParams();
    const notebookId = useMemo(() => {
        const raw = params?.id;
        return Array.isArray(raw) ? raw[0] : raw;
    }, [params]);

    const [doc, setDoc] = useState<NotebookDoc | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!notebookId) return;
        const loaded = getNotebookById(notebookId);
        if (loaded) {
            setDoc(loaded);
            setStatus('ready');
        } else {
            setStatus('missing');
        }
    }, [notebookId]);

    useEffect(() => {
        if (!doc) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setIsSaving(true);
        saveTimerRef.current = setTimeout(() => {
            upsertNotebook(doc);
            setIsSaving(false);
        }, 500);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [doc?.title, doc?.content, doc?.updatedAt]);

    const handleTitleChange = (value: string) => {
        setDoc((prev) => prev ? { ...prev, title: value, updatedAt: new Date().toISOString() } : prev);
    };

    const handleContentChange = (value: string) => {
        setDoc((prev) => prev ? { ...prev, content: value, updatedAt: new Date().toISOString() } : prev);
    };

    const handleCopy = async () => {
        if (!doc?.content) return;
        try {
            await navigator.clipboard.writeText(doc.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (error) {
            console.error('Failed to copy notebook content', error);
        }
    };

    const handleDownload = () => {
        if (!doc) return;
        const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${doc.title || 'notebook'}.md`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (status === 'missing') {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
                <div className="max-w-lg text-center space-y-3">
                    <h1 className="text-2xl font-semibold">Notebook not found</h1>
                    <p className="text-muted-foreground">
                        This notebook does not exist in local storage. Generate a new one from the conversation history.
                    </p>
                </div>
            </div>
        );
    }

    if (!doc) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
                <div className="text-sm text-muted-foreground">Loading notebook...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
                <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            value={doc.title}
                            onChange={(event) => handleTitleChange(event.target.value)}
                            className="flex-1 min-w-[220px] text-xl font-semibold bg-transparent border-b border-border/60 focus:outline-none focus:border-primary"
                            placeholder="Notebook title"
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{isSaving ? 'Saving...' : 'Saved'}</span>
                            <span>•</span>
                            <span>Updated {formatDate(doc.updatedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={handleCopy}
                                className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors"
                            >
                                {copied ? 'Copied' : 'Copy markdown'}
                            </button>
                            <button
                                onClick={handleDownload}
                                className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors"
                            >
                                Download
                            </button>
                        </div>
                    </div>
                    {doc.source && (
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                            {doc.source.messageCount !== undefined && (
                                <span>{doc.source.messageCount} messages</span>
                            )}
                            {doc.source.partyAContext && (
                                <span>• {doc.source.partyAContext}</span>
                            )}
                            {doc.source.partyBContext && (
                                <span>• {doc.source.partyBContext}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Markdown</div>
                    <textarea
                        value={doc.content}
                        onChange={(event) => handleContentChange(event.target.value)}
                        className="min-h-[70vh] w-full rounded-lg border border-border bg-card/60 p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/50 resize-vertical"
                        spellCheck={false}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</div>
                    <div className="min-h-[70vh] w-full rounded-lg border border-border bg-card/60 p-5 overflow-y-auto custom-scrollbar">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ children }) => <h1 className="text-2xl font-semibold mb-3 mt-4">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-xl font-semibold mb-2 mt-4">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-3">{children}</h3>,
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
                            {doc.content}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </div>
    );
}

