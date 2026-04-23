'use client';

import dynamic from 'next/dynamic';
import React, { useEffect } from 'react';
import i18n from '@/lib/i18n';
import { initModerationSync } from '@/lib/moderation/utils';
import { SystemAlert } from './SystemAlert';

// Dynamic imports for all providers to ensure they don't crash SSR
const AuthProvider = dynamic(() => import('@/components/AuthProvider').then(m => m.AuthProvider), { ssr: false });
const ErrorBoundary = dynamic(() => import('@/components/ErrorBoundary').then(m => m.ErrorBoundary), { ssr: false });
const QueryProvider = dynamic(() => import('@/components/QueryProvider').then(m => m.QueryProvider), { ssr: false });
const SignalingProvider = dynamic(() => import('@/components/SignalingProvider').then(m => m.SignalingProvider), { ssr: false });
const ChatProvider = dynamic(() => import('@/components/chat/ChatProvider').then(m => m.ChatProvider), { ssr: false });

function I18nDocumentSync() {
  useEffect(() => {
    const applyLanguage = (lng: string) => {
      if (typeof document === 'undefined') return;
      document.documentElement.lang = lng?.startsWith('pt') ? 'pt-BR' : lng || 'pt-BR';
    };

    applyLanguage(i18n.resolvedLanguage || i18n.language || 'pt-BR');
    i18n.on('languageChanged', applyLanguage);

    return () => {
      i18n.off('languageChanged', applyLanguage);
    };
  }, []);

  return null;
}

function ModerationSync() {
  useEffect(() => {
    return initModerationSync();
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <I18nDocumentSync />
      <ModerationSync />
      <SystemAlert />
      <QueryProvider>
        <AuthProvider>
          <SignalingProvider>
            <ChatProvider>
              {children}
            </ChatProvider>
          </SignalingProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
