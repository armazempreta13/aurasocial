'use client';

import { Focus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from 'react-i18next';

export function FocusModeToggle() {
  const { focusMode, toggleFocusMode } = useAppStore();
  const { t } = useTranslation('common');

  return (
    <button
      onClick={toggleFocusMode}
      className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
        focusMode 
          ? 'bg-primary text-white shadow-md' 
          : 'bg-white text-muted-foreground hover:bg-gray-50 border border-border/50'
      }`}
    >
      <Focus className="w-4 h-4" />
      {focusMode ? t('topnav.exit_focus', 'Exit Focus') : t('topnav.focus_mode', 'Focus Mode')}
    </button>
  );
}
