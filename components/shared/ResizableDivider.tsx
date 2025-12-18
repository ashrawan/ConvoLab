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
                hover:bg-muted transition-colors group
                ${isDragging ? 'bg-primary/20' : ''}
                ${className}
            `}
        >
            <div className={`
                w-12 h-1 rounded-full transition-colors
                ${isDragging ? 'bg-primary' : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/50'}
            `} />
        </div>
    );
}
