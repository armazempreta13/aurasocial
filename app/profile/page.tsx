'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function ProfileRedirect() {
  const router = useRouter();
  const { profile } = useAppStore();

  useEffect(() => {
    if (profile?.uid) {
      router.replace(`/profile/${profile.uid}`);
    } else {
      router.replace('/');
    }
  }, [profile, router]);

  return null;
}
