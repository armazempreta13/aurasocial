'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SquarePen } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { NewMessageModal } from './NewMessageModal';

export function NewMessageFloatingButton({
  fixed = true,
  className = '',
  variant = 'default',
}: {
  fixed?: boolean;
  className?: string;
  variant?: 'default' | 'bubble';
}) {
  const user = useAppStore((state) => state.user);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const wrapperClassName = fixed
    ? `pointer-events-auto fixed bottom-6 right-6 z-[100] flex flex-col items-end ${className}`
    : `pointer-events-auto relative z-[100] flex flex-col items-end ${className}`;

  const buttonClassName =
    variant === 'bubble'
      ? `flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground shadow-sm ring-1 ring-black/5 transition-colors hover:bg-muted/70 focus:outline-none focus:ring-4 focus:ring-primary/20 ${
          isOpen ? 'bg-muted/60' : ''
        }`
      : `flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7c3aed] text-white shadow-[0_12px_32px_rgba(124,58,237,0.28)] transition-all duration-300 hover:scale-105 hover:bg-[#8b5cf6] focus:outline-none focus:ring-4 focus:ring-[#7c3aed]/30 ${
          isOpen ? 'rotate-90 bg-[#6d28d9]' : ''
        }`;

  return (
    <div ref={containerRef} className={wrapperClassName}>
      <NewMessageModal isOpen={isOpen} onClose={() => setIsOpen(false)} />

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName}
        title="Nova mensagem"
        aria-label="Nova mensagem"
      >
        <SquarePen size={20} className="stroke-[2]" />
      </button>
    </div>
  );
}

