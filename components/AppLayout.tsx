
'use client';
import React from 'react';

import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import { Feed } from './Feed';
import { CreatePost } from './CreatePost';
import { BottomNav } from './BottomNav';
import '@/lib/i18n';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { TopNav } from './TopNav';
import { OnboardingFlow } from './OnboardingFlow';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const Sidebar = dynamic(() => import('./Sidebar').then((mod) => mod.Sidebar), {
  ssr: false,
});

const ContextDockDynamic = dynamic(() => import('@/components/dock/ContextDock').then((mod) => mod.ContextDock), {
  ssr: false,
});

const CallManager = dynamic(() => import('./CallManager').then((mod) => mod.CallManager), {
  ssr: false,
});

export function AppLayout({ 
  children, 
  wide = false, 
  hideSidebar = false, 
  hideRightPanel = false,
  plain = false
}: { 
  children?: React.ReactNode, 
  wide?: boolean,
  hideSidebar?: boolean,
  hideRightPanel?: boolean,
  plain?: boolean
}) {
  const { user, isAuthReady } = useRequireAuth();
  const focusMode = useAppStore((state) => state.focusMode);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (searchParams?.get('compose') !== '1') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const t = window.setTimeout(() => {
      document.getElementById('create-post-textarea')?.focus();
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchParams]);

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const showSidebar = !focusMode && !hideSidebar;
  const showRightPanel = !focusMode && !hideRightPanel;

  const gridColsClass = showSidebar
    ? showRightPanel
      ? 'grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_260px]'
      : 'grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]'
    : showRightPanel
      ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px]'
      : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)]';

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <CallManager />
      <OnboardingFlow />

      {/* Main Layout */}
      <div className={plain ? "" : "aura-container"}>
        {plain ? (
          <div className="pt-[56px] md:pt-[60px] min-h-screen w-full px-0">
            {children}
          </div>
        ) : (
          <div className={`w-full grid ${gridColsClass} gap-x-4 lg:gap-x-8`}>
            {/* Left Sidebar */}
            {showSidebar && (
              <aside className="hidden lg:flex lg:justify-start sticky top-0 h-screen pt-[84px]">
                <div className="w-[260px]">
                  <Sidebar />
                </div>
              </aside>
            )}

            {/* Main Content */}
            <main className="pb-[60px] md:pb-12 pt-[56px] md:pt-[60px] px-2 md:px-0">
              <div className={`w-full ${wide ? 'max-w-[1100px]' : 'max-w-[860px]'} mx-auto`}>
                {children || (
                  <div className="pt-2">
                    <CreatePost />
                    <div className="pt-2">
                      <Feed />
                    </div>
                  </div>
                )}
              </div>
            </main>

            {/* Right Panel */}
            {showRightPanel && (
              <aside className="hidden lg:flex lg:justify-end sticky top-0 h-screen pt-[84px]">
                <div className="hidden xl:block w-[260px]">
                  <ContextDockDynamic />
                </div>
                <div className="xl:hidden w-[260px]" />
              </aside>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
