'use client';

import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import { Feed } from './Feed';
import { CreatePost } from './CreatePost';
import { TopNav } from './TopNav';
import { BottomNav } from './BottomNav';
import '@/lib/i18n';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const Sidebar = dynamic(() => import('./Sidebar').then((mod) => mod.Sidebar), {
  ssr: false,
});

const RightPanel = dynamic(() => import('./RightPanel').then((mod) => mod.RightPanel), {
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

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const showSidebar = !focusMode && !hideSidebar;
  const showRightPanel = !focusMode && !hideRightPanel;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <CallManager />

      {/* Main Layout */}
      <div className={plain ? "" : "pt-[64px] flex justify-center w-full max-w-[1440px] mx-auto relative border-x border-border/40 min-h-screen"}>
        {plain ? (
          <div className="pt-[64px] min-h-screen w-full">
            {children}
          </div>
        ) : (
          <>
            {/* Left Sidebar */}
            {showSidebar && (
              <div className="hidden xl:block w-[280px] fixed left-[max(0px,calc((100vw-1440px)/2))] top-[64px] h-[calc(100vh-64px)] overflow-y-auto p-6 scrollbar-hide">
                <Sidebar />
              </div>
            )}

            {/* Main Content */}
            <main className={`w-full ${wide ? 'max-w-[1000px]' : 'max-w-[640px]'} px-4 pb-20 md:pb-12 transition-all duration-300 ${focusMode || (hideSidebar && hideRightPanel) ? 'mx-auto' : ''} ${showSidebar ? 'xl:ml-[280px]' : ''} ${showRightPanel ? 'lg:mr-[320px]' : ''}`}>
              {children || (
                <div className="space-y-6 pt-6">
                  <CreatePost />
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Feed />
                  </div>
                </div>
              )}
            </main>

            {/* Right Panel */}
            {showRightPanel && (
              <div className="hidden lg:block w-[320px] fixed right-[max(0px,calc((100vw-1440px)/2))] top-[64px] h-[calc(100vh-64px)] overflow-y-auto p-6 scrollbar-hide">
                <RightPanel />
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
