import React from 'react';

export const Footer = () => {
    return (
        <footer className="w-full py-6 px-6 border-t border-white/5 bg-[#0f0f10] text-[8px] md:text-[10px] uppercase tracking-widest text-center text-white/20 flex items-center justify-center gap-4">
            <span>ConvoLab AI</span>
            <span className="w-1 h-1 rounded-full bg-white/10"></span>
            <span>Experimenting and Simulating the Real-World Communication.</span>
            <span className="w-1 h-1 rounded-full bg-white/10"></span>
            <span>© {new Date().getFullYear()}</span>
        </footer>
    );
};
