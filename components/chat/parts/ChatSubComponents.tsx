'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { tokens } from '../ChatWorkspace';

export function IconButton({
    onClick,
    title,
    children,
    size = 30,
}: {
    onClick?: () => void;
    title?: string;
    children: React.ReactNode;
    size?: number;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                border: `1px solid ${tokens.border}`,
                background: tokens.surface,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.textPri,
                transition: 'all 0.15s ease',
                outline: 'none',
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.background = tokens.accentBg;
                e.currentTarget.style.borderColor = tokens.accentBg;
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.background = tokens.surface;
                e.currentTarget.style.borderColor = tokens.border;
            }}
        >
            {children}
        </button>
    );
}

export function ComposeButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 6,
                background: tokens.accent,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: 'white',
                fontSize: 12,
                fontWeight: 600,
                transition: 'opacity 0.2s ease',
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
            <Plus size={14} strokeWidth={3} />
            <span>Nova</span>
        </button>
    );
}

export function ChatListSkeleton() {
    return (
        <div className="px-5 space-y-4 pt-4">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 items-center">
                    <div className="h-11 w-11 rounded-full bg-slate-100 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-2.5 w-1/3 bg-slate-100 rounded animate-pulse" />
                        <div className="h-2.5 w-2/3 bg-slate-50 rounded animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    );
}
