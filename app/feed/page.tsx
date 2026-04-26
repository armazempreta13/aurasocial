'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { AppLayout } from '@/components/AppLayout';
import { OnboardingFlow } from '@/components/OnboardingFlow';

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
    if (isAuthReady) {
      if (!user) {
        router.replace('/'); // Redireciona para landing page se não estiver logado
      }
    }
  }, [isAuthReady, user, router]);

  // Enquanto está carregando a autenticação, mostra loading
  if (!isAuthReady) {
    return <AuthTransitionScreen />;
  }

  // Se não está logado, redireciona (enquanto o useEffect não completa)
  if (!user) {
    return <AuthTransitionScreen />;
  }

  // Se o usuário está logado mas não completou o onboarding, mostra o OnboardingFlow
  if (profile && profile.onboardingCompleted === false) {
    return <OnboardingFlow />;
  }

  return <AppLayout />;
}
