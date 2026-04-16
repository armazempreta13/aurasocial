'use client';

import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import { Feed } from './Feed';
import { CreatePost } from './CreatePost';
import { TopNav } from './TopNav';
import '@/lib/i18n';

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
  hideRightPanel = false 
}: { 
  children?: React.ReactNode, 
  wide?: boolean,
  hideSidebar?: boolean,
  hideRightPanel?: boolean
}) {
  const focusMode = useAppStore((state) => state.focusMode);

  const showSidebar = !focusMode && !hideSidebar;
  const showRightPanel = !focusMode && !hideRightPanel;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <CallManager />

      {/* Main Layout */}
      <div className="pt-[64px] flex justify-center w-full max-w-[1440px] mx-auto relative border-x border-border/40 min-h-screen">
        {/* Left Sidebar */}
        {showSidebar && (
          <div className="hidden xl:block w-[280px] fixed left-[max(0px,calc((100vw-1440px)/2))] top-[64px] h-[calc(100vh-64px)] overflow-y-auto p-6 scrollbar-hide">
            <Sidebar />
          </div>
        )}

        {/* Main Content */}
        <main className={`w-full ${wide ? 'max-w-[1000px]' : 'max-w-[640px]'} px-4 pb-12 transition-all duration-300 ${focusMode || (hideSidebar && hideRightPanel) ? 'mx-auto' : ''} ${showSidebar ? 'xl:ml-[280px]' : ''} ${showRightPanel ? 'lg:mr-[320px]' : ''}`}>
          {children || (
            <div className="space-y-6 pt-6">
              <CreatePost />
              
              <div className="relative flex items-center justify-center my-12">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-100 dark:border-slate-800/10"></div>
                </div>
                <div className="relative">
                  <span className="bg-white px-6 py-2.5 rounded-full text-[12px] font-black text-[#7a63f1] uppercase tracking-[0.3em] flex items-center gap-3 border border-slate-100 shadow-[0_8px_20px_rgba(122,99,241,0.06)] backdrop-blur-3xl">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#7a63f1] to-[#6c55e0] animate-pulse"></span>
                    Intelligent Feed
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#7a63f1] to-[#6c55e0] animate-pulse"></span>
                  </span>
                </div>
              </div>

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
      </div>
    </div>
  );
}
