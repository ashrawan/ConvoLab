import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/theme-provider';

export interface UserMenuProps {
    onOpenSettings: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onOpenSettings }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);


    const { theme, setTheme } = useTheme();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer select-none"
            >
                <span className="text-sm opacity-70">👤</span>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-0 top-full mt-2 w-56 bg-popover text-popover-foreground rounded-lg border border-border shadow-md z-50 overflow-hidden"
                    >
                        <div className="p-2 space-y-1">
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                Guest User
                            </div>
                            <div className="h-px bg-border my-1" />

                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    // Placeholder for future login
                                }}
                                className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors opacity-50 cursor-not-allowed"
                            >
                                Sign In / Profile (Coming Soon)
                            </button>

                            <div className="h-px bg-border my-1" />

                            <div className="px-2 py-1">
                                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Theme</div>
                                <div className="flex bg-muted rounded-lg p-1 gap-1">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${theme === 'light'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                            }`}
                                    >
                                        Light
                                    </button>
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${theme === 'dark'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                            }`}
                                    >
                                        Dark
                                    </button>
                                    <button
                                        onClick={() => setTheme('system')}
                                        className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${theme === 'system'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                            }`}
                                    >
                                        Auto
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
