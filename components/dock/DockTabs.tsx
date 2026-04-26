'use client';

import { useMemo } from 'react';

export type DockTabId = 'discover' | 'communities' | 'messages';

export function DockTabs({
  active,
  onChange,
  counts,
}: {
  active: DockTabId;
  onChange: (tab: DockTabId) => void;
  counts?: Partial<Record<DockTabId, number>>;
}) {
  const tabs = useMemo(() => {
    return [
      { id: 'discover' as const, label: 'Descobrir' },
      { id: 'communities' as const, label: 'Comunidades' },
      { id: 'messages' as const, label: 'Mensagens' },
    ];
  }, []);

  return (
    <div className="aura-panel-soft p-1.5 flex items-center justify-between gap-1">
      {tabs.map((t) => {
        const isActive = active === t.id;
        const count = counts?.[t.id] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`h-[36px] flex-1 px-1.5 rounded-[14px] text-[11px] font-bold tracking-tight transition-colors flex items-center justify-center whitespace-nowrap ${
              isActive 
                ? 'bg-primary text-white shadow-sm' 
                : 'text-slate-500 hover:bg-secondary-hover hover:text-slate-900'
            }`}
          >
            {t.label}
            {count > 0 && (
              <span className={`ml-1 min-w-[14px] h-[14px] px-1 rounded-full text-[8px] font-black flex items-center justify-center ${
                isActive ? 'bg-white text-primary' : 'bg-primary text-white'
              }`}>
                {count > 99 ? '99+' : String(count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

