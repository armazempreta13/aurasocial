'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export function useRequireAuth(redirectTo: string = '/?auth=login') {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const isAuthReady = useAppStore((state) => state.isAuthReady);

  useEffect(() => {
    if (isAuthReady && !user) router.replace(redirectTo);
  }, [isAuthReady, user, router, redirectTo]);

  return { user, isAuthReady };
}

