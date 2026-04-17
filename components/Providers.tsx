'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamic imports for all providers to ensure they don't crash SSR
const AuthProvider = dynamic(() => import('@/components/AuthProvider').then(m => m.AuthProvider), { ssr: false });
const ErrorBoundary = dynamic(() => import('@/components/ErrorBoundary').then(m => m.ErrorBoundary), { ssr: false });
const QueryProvider = dynamic(() => import('@/components/QueryProvider').then(m => m.QueryProvider), { ssr: false });
const SignalingProvider = dynamic(() => import('@/components/SignalingProvider').then(m => m.SignalingProvider), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <SignalingProvider>
            {children}
          </SignalingProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
