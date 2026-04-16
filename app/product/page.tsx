'use client';

import Link from 'next/link';
import ProductPreview from '@/components/landing/ProductPreview';
import { PublicPageShell } from '@/components/public/PublicPageShell';

export default function ProductPage() {
  return (
    <PublicPageShell
      title="Produto social com mais contexto"
      description="Uma visao publica da experiencia da Aura para quem quer entender o produto antes de entrar na rede."
    >
      <ProductPreview />
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/communities/explore"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Ver comunidades
        </Link>
        <Link
          href="/?auth=signup"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[#6f63dd] px-6 text-sm font-semibold text-white transition hover:bg-[#5e53cd]"
        >
          Comecar agora
        </Link>
      </div>
    </PublicPageShell>
  );
}
