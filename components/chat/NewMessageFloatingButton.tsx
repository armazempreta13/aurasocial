'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SquarePen } from 'lucide-react';
import { NewMessageModal } from './NewMessageModal';

export function NewMessageFloatingButton() {
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

  return (
    <div ref={containerRef} className="pointer-events-auto fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {/* O Popover de Nova Mensagem */}
      <NewMessageModal isOpen={isOpen} onClose={() => setIsOpen(false)} />

      {/* Botão Flutuante de Nova Mensagem (Design Roxo Aura) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7c3aed] text-white shadow-[0_12px_32px_rgba(124,58,237,0.28)] transition-all duration-300 hover:scale-105 hover:bg-[#8b5cf6] focus:outline-none focus:ring-4 focus:ring-[#7c3aed]/30 ${
          isOpen ? 'rotate-90 bg-[#6d28d9]' : ''
        }`}
        title="Nova mensagem"
      >
        <SquarePen size={20} className="stroke-[2]" />
      </button>
    </div>
  );
}
