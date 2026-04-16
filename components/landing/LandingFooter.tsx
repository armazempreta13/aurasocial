'use client';

import { Logo } from '@/components/Logo';
import type { LandingAuthMode } from '@/components/LandingPage';

const sectionLinks = [
  { sectionId: 'features', label: 'Diferenciais' },
  { sectionId: 'communities', label: 'Comunidades' },
  { sectionId: 'preview', label: 'Produto' },
  { sectionId: 'contact', label: 'Contato' },
  { sectionId: 'cta', label: 'Comecar agora' },
];

type LandingFooterProps = {
  onNavigate: (sectionId: string) => void;
  onRequestAuth: (mode: LandingAuthMode) => void;
};

export default function LandingFooter({
  onNavigate,
  onRequestAuth,
}: LandingFooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('top')}
            className="rounded-2xl outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-[#6f63dd]/15"
          >
            <Logo className="h-9" />
          </button>
          <p className="mt-3 text-sm text-slate-500">
            A rede social moderna para comunidades, relevancia e conteudo de qualidade.
          </p>
        </div>

        <nav className="flex flex-wrap gap-4 text-sm text-slate-600">
          <button
            type="button"
            onClick={() => onRequestAuth('signup')}
            className="transition hover:text-slate-950"
          >
            Criar conta
          </button>
          <button
            type="button"
            onClick={() => onRequestAuth('login')}
            className="transition hover:text-slate-950"
          >
            Entrar
          </button>
          {sectionLinks.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => onNavigate(link.sectionId)}
              className="transition hover:text-slate-950"
            >
              {link.label}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  );
}
