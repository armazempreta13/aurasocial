'use client';

import { useMemo, useState } from 'react';
import { RightPanelLeft } from '@/components/RightPanelLeft';
import { RightPanelRight } from '@/components/RightPanelRight';
import { DockTabs, DockTabId } from './DockTabs';
import { CommunitiesDock } from './CommunitiesDock';
import { useChat } from '@/components/chat/ChatProvider';

export function ContextDock() {
  const { unreadTotal } = useChat();
  const [tab, setTab] = useState<DockTabId>('discover');

  const counts = useMemo(() => {
    return { messages: unreadTotal || 0 };
  }, [unreadTotal]);

  return (
    <div className="w-[260px] flex flex-col gap-6">
      <DockTabs active={tab} onChange={setTab} counts={counts} />

      {tab === 'discover' ? (
        <RightPanelLeft />
      ) : null}

      {tab === 'communities' ? (
        <div className="flex flex-col gap-6 pb-12">
          <CommunitiesDock />
        </div>
      ) : null}

      {tab === 'messages' ? (
        <RightPanelRight />
      ) : null}
    </div>
  );
}
