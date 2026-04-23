'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { tokens } from '../ChatWorkspace';

export function EmptyState() {
    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f6fb',
        }}>
            <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#ede9fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
            }}>
                <MessageSquare size={22} className="text-[#7c6fcd]" strokeWidth={2.5} />
            </div>
            
            <h2 style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#1a1f3a',
                marginBottom: 4,
            }}>
                Selecione uma conversa
            </h2>
            
            <p style={{
                fontSize: 12.5,
                color: '#adb5d0',
                fontWeight: 500,
            }}>
                ou inicie uma nova
            </p>
        </div>
    );
}
