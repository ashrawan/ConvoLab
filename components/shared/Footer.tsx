import React from 'react';

export const Footer = () => {
    return (
        <footer className="w-full py-6 px-6 border-t border-border bg-card text-[8px] md:text-[10px] uppercase tracking-widest text-center text-muted-foreground flex items-center justify-center gap-4">
            <span>ConvoLab AI</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>Experience and Explore the Real-World Conversations.</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>© {new Date().getFullYear()}</span>
        </footer>
    );
};
