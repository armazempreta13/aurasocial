'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { LandingPage } from '@/components/LandingPage';

import dynamic from 'next/dynamic';

const HomeContent = dynamic(() => Promise.resolve(({ isAuthReady, user, router }: any) => {
  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" /></div>;
  }

  if (!user) {
    return <LandingPage />;
  }

  router.replace('/feed');
  return <div className="min-h-screen flex items-center justify-center bg-background"><div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" /></div>;
}), { ssr: false });

export default function Home() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const isAuthReady = useAppStore((state) => state.isAuthReady);

  return <HomeContent isAuthReady={isAuthReady} user={user} router={router} />;
}
