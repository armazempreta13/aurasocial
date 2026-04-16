'use client';

import Link from 'next/link';
import CommunitiesSection from '@/components/landing/CommunitiesSection';
import { PublicPageShell } from '@/components/public/PublicPageShell';

export default function PublicCommunitiesExplorePage() {
  return (
    <PublicPageShell
      title="Explore comunidades antes de entrar"
      description="Veja como a Aura organiza grupos por interesse, afinidade e contexto social sem exigir login logo no primeiro clique."
    >
      <CommunitiesSection />
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/?auth=signup"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[#6f63dd] px-6 text-sm font-semibold text-white transition hover:bg-[#5e53cd]"
        >
          Criar conta
        </Link>
        <Link
          href="/?auth=login"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-[#d6def6] bg-white px-6 text-sm font-semibold text-[#40458a] transition hover:border-[#bfc9ef]"
        >
          Entrar
        </Link>
      </div>
    </PublicPageShell>
  );
}
