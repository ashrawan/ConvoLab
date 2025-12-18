'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ResizableDividerProps {
    onResize: (delta: number) => void;
    className?: string;
}

export function ResizableDivider({ onResize, className = '' }: ResizableDividerProps) {
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        startY.current = e.clientY;
    }, []);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientY - startY.current;
            startY.current = e.clientY;
            onResize(delta);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, onResize]);

    return (
        <div
            onMouseDown={handleMouseDown}
            className={`
                h-2 cursor-row-resize flex items-center justify-center 
                hover:bg-white/10 transition-colors group
                ${isDragging ? 'bg-violet-500/20' : ''}
                ${className}
            `}
        >
            <div className={`
                w-12 h-1 rounded-full transition-colors
                ${isDragging ? 'bg-violet-400' : 'bg-white/20 group-hover:bg-white/40'}
            `} />
        </div>
    );
}
