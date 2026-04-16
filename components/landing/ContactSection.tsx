'use client';

import type { LandingAuthMode } from '@/components/LandingPage';

type ContactSectionProps = {
  onNavigate: (sectionId: string) => void;
  onRequestAuth: (mode: LandingAuthMode) => void;
};

export default function ContactSection({
  onNavigate,
  onRequestAuth,
}: ContactSectionProps) {
  return (
    <section id="contact" className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-18">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.06)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Contato</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Entre na Aura do jeito mais rapido para voce.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Se voce quer conhecer o produto, entrar na sua conta ou comecar o cadastro agora, a landing ja te leva direto para o proximo passo sem telas mortas.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onRequestAuth('signup')}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#6f63dd] px-6 text-sm font-semibold text-white transition hover:bg-[#5e53cd]"
            >
              Criar conta
            </button>
            <button
              type="button"
              onClick={() => onRequestAuth('login')}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-[#d6def6] bg-white px-6 text-sm font-semibold text-[#40458a] transition hover:border-[#bfc9ef]"
            >
              Fazer login
            </button>
            <button
              type="button"
              onClick={() => onNavigate('communities')}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Ver comunidades
            </button>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_16px_48px_rgba(15,23,42,0.12)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">
            Navegacao publica
          </p>
          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => onNavigate('features')}
              className="flex w-full items-center justify-between rounded-2xl bg-white/8 px-4 py-4 text-left transition hover:bg-white/12"
            >
              <div>
                <p className="text-sm font-semibold text-white">Recursos da plataforma</p>
                <p className="mt-1 text-sm text-slate-300">
                  Veja como feed, reputacao e descoberta funcionam.
                </p>
              </div>
              <span className="text-sm font-semibold text-sky-300">Abrir</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('preview')}
              className="flex w-full items-center justify-between rounded-2xl bg-white/8 px-4 py-4 text-left transition hover:bg-white/12"
            >
              <div>
                <p className="text-sm font-semibold text-white">Produto</p>
                <p className="mt-1 text-sm text-slate-300">
                  Explore a previa publica da experiencia antes de entrar.
                </p>
              </div>
              <span className="text-sm font-semibold text-sky-300">Abrir</span>
            </button>

            <a
              href="mailto:contato@aura.social?subject=Contato%20Aura"
              className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-4 text-left transition hover:bg-white/12"
            >
              <div>
                <p className="text-sm font-semibold text-white">Falar com a equipe</p>
                <p className="mt-1 text-sm text-slate-300">
                  Abra seu cliente de email e envie sua mensagem diretamente.
                </p>
              </div>
              <span className="text-sm font-semibold text-sky-300">Email</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
