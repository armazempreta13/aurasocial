'use client';

import Link from 'next/link';
import { ValueGrid } from '@/components/landing/ValueGrid';
import { PublicPageShell } from '@/components/public/PublicPageShell';

export default function ResourcesPage() {
  return (
    <PublicPageShell
      title="Recursos centrais da Aura"
      description="Entenda rapidamente como feed inteligente, reputacao e descoberta por interesse funcionam dentro da rede."
    >
      <ValueGrid />
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/product"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Ver produto
        </Link>
        <Link
          href="/?auth=signup"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[#6f63dd] px-6 text-sm font-semibold text-white transition hover:bg-[#5e53cd]"
        >
          Criar conta
        </Link>
      </div>
    </PublicPageShell>
  );
}
