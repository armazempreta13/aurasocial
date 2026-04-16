'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { AppLayout } from '@/components/AppLayout';
import { Onboarding } from '@/components/Onboarding';

function AuthTransitionScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

export default function FeedPage() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const profile = useAppStore((state) => state.profile);
  const isAuthReady = useAppStore((state) => state.isAuthReady);

  useEffect(() => {
    if (isAuthReady && !user) {
      router.replace('/');
    }
  }, [isAuthReady, router, user]);

  if (!isAuthReady || !user) {
    return <AuthTransitionScreen />;
  }

  if (profile && profile.onboardingCompleted === false) {
    return <Onboarding />;
  }

  return <AppLayout />;
}
