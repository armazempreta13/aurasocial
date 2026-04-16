'use client';

import { ArrowRight } from 'lucide-react';
import type { LandingAuthMode } from '@/components/LandingPage';

type FinalCTAProps = {
  onRequestAuth: (mode: LandingAuthMode) => void;
};

export default function FinalCTA({ onRequestAuth }: FinalCTAProps) {

  return (
    <section id="cta" className="px-5 py-14 sm:px-6 lg:px-8 lg:py-18">
      <div className="mx-auto max-w-6xl rounded-[36px] bg-slate-950 px-6 py-10 text-white shadow-[0_30px_90px_rgba(15,23,42,0.2)] sm:px-8 lg:px-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Comece agora</p>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              Crie sua conta e organize sua experiência social desde o primeiro acesso.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Menos ruído, mais comunidade, mais descoberta relevante. Cadastro rápido e entrada imediata.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRequestAuth('signup')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Criar conta grátis
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
