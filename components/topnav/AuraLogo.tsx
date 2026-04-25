'use client';

import Link from 'next/link';

function AuraMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
      <div className="w-4 h-4 rounded-full bg-white" />
    </div>
  );
}

export function AuraLogo() {
  return (
    <Link href="/feed" className="flex items-center gap-3 min-w-0">
      <AuraMark />
      <span className="text-[18px] font-black tracking-tight text-slate-900 truncate">Aura</span>
    </Link>
  );
}

