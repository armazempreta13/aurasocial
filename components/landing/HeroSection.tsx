'use client';

import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { LandingAuthPanel } from './LandingAuthPanel';
import type { LandingAuthMode } from '@/components/LandingPage';

type HeroSectionProps = {
  requestedAuthMode: LandingAuthMode;
  authFocusNonce: number;
  onRequestAuth: (mode: LandingAuthMode) => void;
};

export function HeroSection({
  requestedAuthMode,
  authFocusNonce,
  onRequestAuth,
}: HeroSectionProps) {
  return (
    <section
      id="top"
      className="relative min-h-screen overflow-hidden bg-[#f4f7ff] text-slate-950"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.16),_transparent_25%),radial-gradient(circle_at_bottom_left,_rgba(244,114,182,0.12),_transparent_24%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]" />

      <div className="relative mx-auto flex h-full min-h-screen max-w-[1480px] flex-col px-6 py-6 sm:px-10 xl:px-12">
        <header className="flex justify-end rounded-[24px] border border-white/60 bg-white/35 px-5 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onRequestAuth('login')}
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => onRequestAuth('signup')}
              className="rounded-xl bg-[#6f63dd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5e53cd]"
            >
              Começar
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 items-center gap-8 py-6 lg:grid-cols-12 lg:gap-6">
          <div className="order-1 flex h-full items-center lg:col-span-4">
            <div className="max-w-[480px]">
              <h1 className="text-[3.55rem] font-black leading-[0.98] tracking-[-0.065em] text-[#2e3277] sm:text-[4.2rem] xl:text-[4.7rem]">
                Descubra sua rede
                <br />
                com <span className="text-[#ff68b3]">conteúdo</span>
                <br />
                <span className="text-[#ff68b3]">relevante</span>
              </h1>

              <p className="mt-6 max-w-[420px] text-[16px] leading-7 text-slate-500">
                Aura une feed inteligente, comunidades e reputação para transformar sua experiência social em algo mais bonito, mais útil e mais leve.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onRequestAuth('signup')}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#6f63dd] px-6 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(111,99,221,0.24)] transition hover:bg-[#5e53cd]"
                >
                  Criar conta
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRequestAuth('login')}
                  className="inline-flex h-12 items-center rounded-xl border border-[#d6def6] bg-white px-6 text-sm font-semibold text-[#40458a] transition hover:border-[#bfc9ef]"
                >
                  Entrar
                </button>
              </div>
            </div>
          </div>

          <div className="order-2 relative flex h-full min-h-[560px] items-center lg:col-span-4">
            <PhoneVisual />
          </div>

          <div className="order-3 flex h-full items-center justify-end lg:col-span-4">
            <div className="w-full max-w-[460px] lg:-mt-2">
              <LandingAuthPanel
                requestedMode={requestedAuthMode}
                focusNonce={authFocusNonce}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const THEMES = [
  {
    phoneBorder: 'border-[#8cc7ff]',
    phoneBg: 'bg-[linear-gradient(180deg,#bff2ff_0%,#a7e8ff_18%,#ff92c5_48%,#ffd880_73%,#8cc9ff_100%)]',
    screenBg: 'bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.9),transparent_18%),linear-gradient(180deg,#8be1ff_0%,#6fc1ff_32%,#ff7aba_68%,#ffd56f_100%)]',
    bubbles: [
      { className: 'left-[6%] top-[26%] w-[188px]', color: 'bg-[#7a67f1] text-white', delay: 0, anim: 'float-slow' },
      { className: 'left-[55%] top-[19%] w-[176px]', color: 'bg-[#ff68b3] text-white', delay: 0.3, anim: 'float-medium' },
      { className: 'left-[9%] top-[51%] w-[170px]', color: 'bg-[#ffd463] text-[#584120]', delay: 0.6, anim: 'float-fast' },
      { className: 'left-[48%] top-[51%] w-[188px]', color: 'bg-[#7a67f1] text-white', delay: 0.9, anim: 'float-slow' },
    ],
    hearts: [
      { className: 'left-[5%] top-[67%]', delay: 0.2 },
      { className: 'left-[67%] top-[12%]', delay: 0.5 },
      { className: 'left-[76%] top-[44%]', delay: 0.8 },
      { className: 'left-[59%] top-[77%]', delay: 1.1 },
      { className: 'left-[18%] top-[81%]', delay: 1.4 },
    ]
  },
  {
    phoneBorder: 'border-[#4a3e9c]',
    phoneBg: 'bg-[linear-gradient(180deg,#1c1242_0%,#3b266d_48%,#7a458f_100%)]',
    screenBg: 'bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.1),transparent_18%),linear-gradient(180deg,#2d1f4a_0%,#5a3a7b_68%,#9f5f9e_100%)]',
    bubbles: [
      { className: 'left-[-4%] top-[15%] w-[160px]', color: 'bg-[#00f0ff] text-slate-900', delay: 0, anim: 'float-fast' },
      { className: 'left-[60%] top-[30%] w-[190px]', color: 'bg-[#ff0055] text-white', delay: 0.4, anim: 'float-slow' },
      { className: 'left-[2%] top-[60%] w-[180px]', color: 'bg-[#b620e0] text-white', delay: 0.8, anim: 'float-medium' },
      { className: 'left-[55%] top-[70%] w-[170px]', color: 'bg-[#f7df1e] text-slate-900', delay: 1.2, anim: 'float-slow' },
    ],
    hearts: [
      { className: 'left-[10%] top-[8%]', delay: 0.3 },
      { className: 'left-[80%] top-[20%]', delay: 0.7 },
      { className: 'left-[15%] top-[85%]', delay: 1.1 },
      { className: 'left-[70%] top-[55%]', delay: 1.5 },
      { className: 'left-[85%] top-[80%]', delay: 1.9 },
    ]
  },
  {
    phoneBorder: 'border-[#a8e6cf]',
    phoneBg: 'bg-[linear-gradient(180deg,#dcedc1_0%,#a8e6cf_48%,#ffd3b5_100%)]',
    screenBg: 'bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.8),transparent_18%),linear-gradient(180deg,#c0f0d8_0%,#9cf2cd_40%,#ffc4a3_100%)]',
    bubbles: [
      { className: 'left-[20%] top-[10%] w-[180px]', color: 'bg-[#ff8b94] text-white', delay: 0.1, anim: 'float-slow' },
      { className: 'left-[45%] top-[35%] w-[160px]', color: 'bg-[#ffaaa5] text-white', delay: 0.5, anim: 'float-medium' },
      { className: 'left-[5%] top-[65%] w-[190px]', color: 'bg-[#6b5b95] text-white', delay: 0.9, anim: 'float-fast' },
      { className: 'left-[60%] top-[80%] w-[150px]', color: 'bg-[#1b4332] text-white', delay: 1.3, anim: 'float-slow' },
    ],
    hearts: [
      { className: 'left-[5%] top-[25%]', delay: 0.2 },
      { className: 'left-[75%] top-[10%]', delay: 0.6 },
      { className: 'left-[15%] top-[50%]', delay: 1.0 },
      { className: 'left-[85%] top-[45%]', delay: 1.4 },
      { className: 'left-[40%] top-[90%]', delay: 1.8 },
    ]
  },
  {
    phoneBorder: 'border-[#1b9ce5]',
    phoneBg: 'bg-[linear-gradient(180deg,#0a4275_0%,#1b9ce5_50%,#55c3c0_100%)]',
    screenBg: 'bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.25),transparent_18%),linear-gradient(180deg,#0e5a9c_0%,#26a4e3_50%,#66d9c6_100%)]',
    bubbles: [
      { className: 'left-[10%] top-[22%] w-[170px]', color: 'bg-[#ffffff] text-[#0a4275]', delay: 0.2, anim: 'float-medium' },
      { className: 'left-[62%] top-[40%] w-[180px]', color: 'bg-[#ff9a3d] text-white', delay: 0.7, anim: 'float-fast' },
      { className: 'left-[5%] top-[70%] w-[160px]', color: 'bg-[#00f0ff] text-[#0a4275]', delay: 1.2, anim: 'float-slow' },
      { className: 'left-[50%] top-[85%] w-[190px]', color: 'bg-[#f73859] text-white', delay: 1.7, anim: 'float-medium' },
    ],
    hearts: [
      { className: 'left-[10%] top-[10%]', delay: 0.4 },
      { className: 'left-[80%] top-[25%]', delay: 0.9 },
      { className: 'left-[20%] top-[45%]', delay: 1.4 },
      { className: 'left-[85%] top-[70%]', delay: 1.9 },
      { className: 'left-[15%] top-[90%]', delay: 2.4 },
    ]
  },
  {
    phoneBorder: 'border-[#d4d4d8]',
    phoneBg: 'bg-[linear-gradient(180deg,#f4f4f5_0%,#e4e4e7_40%,#d4d4d8_100%)]',
    screenBg: 'bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,1),transparent_18%),linear-gradient(180deg,#fafafa_0%,#f4f4f5_50%,#e4e4e7_100%)]',
    bubbles: [
      { className: 'left-[5%] top-[15%] w-[190px]', color: 'bg-[#18181b] text-white', delay: 0, anim: 'float-fast' },
      { className: 'left-[50%] top-[25%] w-[160px]', color: 'bg-[#3f3f46] text-white', delay: 0.3, anim: 'float-slow' },
      { className: 'left-[15%] top-[55%] w-[180px]', color: 'bg-[#71717a] text-white', delay: 0.6, anim: 'float-medium' },
      { className: 'left-[60%] top-[65%] w-[170px]', color: 'bg-[#a1a1aa] text-white', delay: 0.9, anim: 'float-slow' },
    ],
    hearts: [
      { className: 'left-[12%] top-[35%]', delay: 0.2 },
      { className: 'left-[70%] top-[8%]', delay: 0.5 },
      { className: 'left-[5%] top-[80%]', delay: 0.8 },
      { className: 'left-[82%] top-[50%]', delay: 1.1 },
      { className: 'left-[45%] top-[88%]', delay: 1.4 },
    ]
  }
];

function PhoneVisual() {
  const [themeIndex, setThemeIndex] = useState<number | null>(null);

  useEffect(() => {
    // Generate random theme exactly when a user lands on this view
    setThemeIndex(Math.floor(Math.random() * THEMES.length));
  }, []);

  if (themeIndex === null) {
    return <div className="pointer-events-none absolute inset-0 hidden lg:block" />;
  }

  const theme = THEMES[themeIndex];

  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block">
      
      <div 
        className={`absolute left-[20%] top-1/2 h-[492px] w-[268px] -translate-y-1/2 rounded-[40px] border-[6px] ${theme.phoneBorder} ${theme.phoneBg} shadow-[0_35px_90px_rgba(84,120,255,0.18)] transition-colors duration-1000`}
        style={{ animation: 'pop-in 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
      >
        <div className="absolute left-1/2 top-4 h-2.5 w-28 -translate-x-1/2 rounded-full bg-white/85" />
        <div className="absolute inset-x-5 top-12 bottom-5 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0.06)_100%)]">
          <div className={`mx-auto mt-8 h-[210px] w-[176px] rounded-[24px] ${theme.screenBg} shadow-inner transition-colors duration-1000`} />
          <div className="mx-auto mt-6 h-16 w-[176px] rounded-[20px] bg-white/55" />
          <div className="mx-auto mt-4 h-16 w-[176px] rounded-[20px] bg-white/45" />
        </div>
      </div>

      {theme.bubbles.map((bubble, i) => (
        <Bubble 
          key={`bubble-${themeIndex}-${i}`}
          className={bubble.className} 
          colorClass={bubble.color}
          delay={bubble.delay}
          anim={bubble.anim}
        />
      ))}

      {theme.hearts.map((heart, i) => (
        <HeartBadge 
          key={`heart-${themeIndex}-${i}`}
          className={heart.className}
          delay={heart.delay}
        />
      ))}
    </div>
  );
}

function Bubble({ className, colorClass, delay, anim }: { className: string, colorClass: string, delay: number, anim: string }) {
  return (
    <div
      className={`absolute rounded-[22px] px-5 py-4 shadow-[0_18px_40px_rgba(91,81,180,0.16)] animate-pop-${anim} opacity-0 ${className} ${colorClass}`}
      style={{ animationDelay: `${delay}s, ${delay + 0.8}s` }}
    >
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-white/90" />
        <div className="h-3 w-16 rounded-full bg-white/75" />
      </div>
      <div className="absolute -bottom-3 left-7 h-5 w-5 rotate-45 rounded-[6px] bg-inherit" />
    </div>
  );
}

function HeartBadge({ className, delay }: { className: string, delay: number }) {
  return (
    <div 
      className={`absolute ${className} opacity-0 animate-pop-float-fast`}
      style={{ animationDelay: `${delay}s, ${delay + 0.8}s` }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#ff68b3] shadow-[0_16px_36px_rgba(255,104,179,0.24)]">
        <div className="h-6 w-6 rounded-full bg-white/90 [clip-path:path('M12,21C12,21,2,15,2,8.5C2,5.42,4.42,3,7.5,3C9.24,3,10.91,3.81,12,5.09C13.09,3.81,14.76,3,16.5,3C19.58,3,22,5.42,22,8.5C22,15,12,21,12,21Z')]" />
      </div>
    </div>
  );
}
