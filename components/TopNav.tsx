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
    <header className="fixed top-0 left-0 right-0 h-[56px] md:h-[60px] z-50 bg-secondary/80 backdrop-blur-md border-b border-border">
      <div className="h-full flex items-center justify-between gap-2 md:gap-4 px-3 md:px-6 lg:px-8">
        {/* Logo - hidden on mobile */}
        <div className="hidden lg:block flex-shrink-0">
          <AuraLogo />
        </div>

        {/* Search - responsive */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('topnav.search_placeholder', 'Buscar')}
            className="aura-input w-full h-9 md:h-10 rounded-full pl-9 md:pl-11 pr-3 text-xs md:text-[13px]"
          />
          <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 opacity-30 pointer-events-none">
            <kbd className="h-5 px-1.5 rounded border border-slate-300 bg-slate-50 text-[10px] font-bold text-slate-500">⌘</kbd>
            <kbd className="h-5 px-1.5 rounded border border-slate-300 bg-slate-50 text-[10px] font-bold text-slate-500">K</kbd>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <NotificationsDropdown />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}
