export interface NotebookDoc {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    source?: {
        partyAContext?: string;
        partyBContext?: string;
        messageCount?: number;
    };
}

export const NOTEBOOK_STORAGE_KEY = 'convolab_notebooks';

export const loadNotebooks = (): NotebookDoc[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(NOTEBOOK_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to load notebooks from storage', error);
        return [];
    }
};

export const saveNotebooks = (notebooks: NotebookDoc[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(notebooks));
};

export const upsertNotebook = (doc: NotebookDoc) => {
    const notebooks = loadNotebooks();
    const index = notebooks.findIndex(item => item.id === doc.id);
    if (index >= 0) {
        notebooks[index] = doc;
    } else {
        notebooks.unshift(doc);
    }
    saveNotebooks(notebooks);
};

export const getNotebookById = (id: string): NotebookDoc | null => {
    const notebooks = loadNotebooks();
    return notebooks.find(item => item.id === id) || null;
};

export const deleteNotebook = (id: string) => {
    const notebooks = loadNotebooks();
    const next = notebooks.filter(item => item.id !== id);
    saveNotebooks(next);
};

