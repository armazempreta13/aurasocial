'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuraLogo } from '@/components/topnav/AuraLogo';
import { NotificationsDropdown } from '@/components/NotificationsDropdown';
import { ProfileDropdown } from '@/components/topnav/ProfileDropdown';

export function TopNav() {
  const { t } = useTranslation('common');
  const [q, setQ] = useState('');

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] z-50 bg-secondary/80 backdrop-blur-md border-b border-border">
      <div className="aura-container h-full flex items-center justify-between gap-4">
        <div className="hidden lg:block">
          <AuraLogo />
        </div>

        <div className="relative flex-1 min-w-0 max-w-[520px] md:max-w-[60vw]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('topnav.search_placeholder', 'Buscar no Aura')}
            className="aura-input w-full h-10 rounded-full pl-11 pr-12 text-[13px]"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 opacity-30 pointer-events-none">
            <kbd className="h-5 px-1.5 rounded border border-slate-300 bg-slate-50 text-[10px] font-bold text-slate-500">⌘</kbd>
            <kbd className="h-5 px-1.5 rounded border border-slate-300 bg-slate-50 text-[10px] font-bold text-slate-500">K</kbd>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationsDropdown />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}
