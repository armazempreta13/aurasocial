'use client';

import Link from 'next/link';

export function PublicPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <div className="mx-auto max-w-[1480px] px-6 py-6 sm:px-10 xl:px-12">
        <header className="flex justify-end rounded-[24px] border border-white/60 bg-white/70 px-5 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Link
              href="/?auth=login"
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Log in
            </Link>
            <Link
              href="/?auth=signup"
              className="rounded-xl bg-[#6f63dd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5e53cd]"
            >
              Getting Started
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-2 py-10 sm:px-4 lg:py-14">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Aura
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#2e3277] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">{description}</p>
          </div>

          <div className="mt-10">{children}</div>
        </section>
      </div>
    </main>
  );
}
