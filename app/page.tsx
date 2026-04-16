'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { LandingPage } from '@/components/LandingPage';

function AuthTransitionScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const isAuthReady = useAppStore((state) => state.isAuthReady);

  useEffect(() => {
    if (isAuthReady && user) {
      router.replace('/feed');
    }
  }, [isAuthReady, router, user]);

  if (!isAuthReady) {
    return <AuthTransitionScreen />;
  }

  if (!user) {
    return <LandingPage />;
  }

  return <AuthTransitionScreen />;
}
