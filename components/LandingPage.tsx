'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { HeroSection } from './landing/HeroSection';

export type LandingAuthMode = 'login' | 'signup';

export function LandingPage() {
  const searchParams = useSearchParams();
  const [authMode, setAuthMode] = useState<LandingAuthMode>('login');
  const [authFocusNonce, setAuthFocusNonce] = useState(0);
  
  useEffect(() => {
    const requestedAuth = searchParams?.get('auth');
    if (requestedAuth === 'login' || requestedAuth === 'signup') {
      setAuthMode(requestedAuth);
      setAuthFocusNonce((current) => current + 1);
    }
  }, [searchParams]);

  const requestAuth = (mode: LandingAuthMode) => {
    setAuthMode(mode);
    setAuthFocusNonce((current) => current + 1);

    requestAnimationFrame(() => {
      document.getElementById('auth-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <HeroSection
        requestedAuthMode={authMode}
        authFocusNonce={authFocusNonce}
        onRequestAuth={requestAuth}
      />
    </main>
  );
}
