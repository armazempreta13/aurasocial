'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { LandingPage } from '@/components/LandingPage';
import dynamic from 'next/dynamic';

function HomePageContent() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const isAuthReady = useAppStore((state) => state.isAuthReady);

  useEffect(() => {
    if (isAuthReady && user) {
      router.replace('/feed');
    }
  }, [isAuthReady, user, router]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  // Fallback while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

// Force client-side only to avoid hydration mismatch with Auth state
const Home = dynamic(() => Promise.resolve(HomePageContent), { ssr: false });

export default Home;
