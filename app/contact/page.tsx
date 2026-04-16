'use client';

import { useRouter } from 'next/navigation';
import ContactSection from '@/components/landing/ContactSection';
import { PublicPageShell } from '@/components/public/PublicPageShell';

export default function ContactPage() {
  const router = useRouter();

  const handleNavigate = (sectionId: string) => {
    if (sectionId === 'communities') {
      router.push('/communities/explore');
      return;
    }

    if (sectionId === 'features') {
      router.push('/resources');
      return;
    }

    if (sectionId === 'preview') {
      router.push('/product');
      return;
    }

    router.push('/');
  };

  const handleRequestAuth = (mode: 'login' | 'signup') => {
    router.push(`/?auth=${mode}`);
  };

  return (
    <PublicPageShell
      title="Contato e caminhos de entrada"
      description="Tudo o que parece interacao aqui leva a um destino real: explorar, entrar, cadastrar ou falar com a equipe."
    >
      <ContactSection onNavigate={handleNavigate} onRequestAuth={handleRequestAuth} />
    </PublicPageShell>
  );
}
