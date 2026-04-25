'use client';

import Link from 'next/link';
import {
  BarChart2,
  Bell,
  Bookmark,
  Compass,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Search,
  Share2,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';

function AuraMark() {
  return (
    <div className="w-8 h-8 rounded-full grid place-items-center">
      <div className="w-8 h-8 rounded-full bg-[conic-gradient(from_210deg,#a78bfa,#7c3aed,#a78bfa)] p-[3px]">
        <div className="w-full h-full rounded-full bg-white" />
      </div>
    </div>
  );
}

function Avatar({ initials, tone }: { initials: string; tone?: 'warm' | 'cool' | 'neutral' }) {
  const bg =
    tone === 'warm'
      ? 'bg-[linear-gradient(135deg,#fca5a5,#f59e0b)]'
      : tone === 'cool'
        ? 'bg-[linear-gradient(135deg,#93c5fd,#a78bfa)]'
        : 'bg-[linear-gradient(135deg,#cbd5e1,#e2e8f0)]';
  return (
    <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 ${bg} grid place-items-center`}>
      <span className="text-white text-[13px] font-semibold">{initials}</span>
    </div>
  );
}

function IconBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-auto min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#7c3aed] text-white text-[11px] font-semibold flex items-center justify-center">
      {n > 99 ? '99+' : n}
    </span>
  );
}

function OnlineDot({ color = 'bg-emerald-500' }: { color?: string }) {
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} />;
}

const blockCls = 'bg-white rounded-2xl px-5 py-4 flex flex-col gap-3 border border-slate-100';

export function AuraFeedMock() {
  const [q, setQ] = useState('');
  const [messagesQuery, setMessagesQuery] = useState('');

  const nav = useMemo(
    () => [
      { label: 'Home', icon: HomeIcon, active: true, badge: 0 },
      { label: 'Explore', icon: Compass, active: false, badge: 0 },
      { label: 'Notifications', icon: Bell, active: false, badge: 3 },
      { label: 'Messages', icon: MessageSquare, active: false, badge: 0 },
      { label: 'Bookmarks', icon: Bookmark, active: false, badge: 0 },
      { label: 'Profile', icon: User, active: false, badge: 0 },
      { label: 'More', icon: MoreHorizontal, active: false, badge: 0 },
    ],
    []
  );

  const trending = useMemo(
    () => [
      { tag: 'vida', posts: '12.3k posts' },
      { tag: 'inspiração', posts: '8.7k posts' },
      { tag: 'tecnologia', posts: '7.1k posts' },
      { tag: 'fotografia', posts: '5.8k posts' },
      { tag: 'desenvolvimento', posts: '4.2k posts' },
    ],
    []
  );

  const follow = useMemo(
    () => [
      { name: 'Camila Ribeiro', handle: '@camilaribeiro', initials: 'CR', tone: 'cool' as const },
      { name: 'Gustavo Alves', handle: '@gustavoalves', initials: 'GA', tone: 'neutral' as const },
      { name: 'Beatriz Lopes', handle: '@beatrizlopes', initials: 'BL', tone: 'warm' as const },
    ],
    []
  );

  const online = useMemo(
    () => [
      { name: 'Lucas Bernard', initials: 'LB', tone: 'neutral' as const, dot: 'bg-emerald-500' },
      { name: 'Marina Dias', initials: 'MD', tone: 'cool' as const, dot: 'bg-emerald-500' },
      { name: 'Felipe Rocha', initials: 'FR', tone: 'neutral' as const, dot: 'bg-emerald-500' },
      { name: 'Camila Ribeiro', initials: 'CR', tone: 'cool' as const, dot: 'bg-emerald-500' },
      { name: 'Beatriz Lopes', initials: 'BL', tone: 'warm' as const, dot: 'bg-amber-400' },
    ],
    []
  );

  const messages = useMemo(
    () => [
      { name: 'Lucas Bernard', time: '11:30', msg: 'Perfeito! 👌', unread: 2, initials: 'LB', tone: 'neutral' as const },
      { name: 'Marina Dias', time: '10:45', msg: 'Obrigada! 💜', unread: 1, initials: 'MD', tone: 'cool' as const },
      { name: 'Felipe Rocha', time: '09:15', msg: 'Vamos sim!', unread: 0, initials: 'FR', tone: 'neutral' as const },
      { name: 'Camila Ribeiro', time: 'Ontem', msg: 'Amei a foto! ✨', unread: 0, initials: 'CR', tone: 'cool' as const },
      { name: 'Beatriz Lopes', time: 'Ontem', msg: 'Quando vai ser? 😅', unread: 0, initials: 'BL', tone: 'warm' as const },
    ],
    []
  );

  const filteredMessages = useMemo(() => {
    const x = messagesQuery.trim().toLowerCase();
    if (!x) return messages;
    return messages.filter((m) => m.name.toLowerCase().includes(x));
  }, [messages, messagesQuery]);

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <header className="fixed top-0 left-0 right-0 h-[60px] z-50">
        <div className="w-full max-w-[1440px] mx-auto grid grid-cols-[260px_640px_280px_320px] gap-x-8 h-full items-center">
          <div />

          <div className="col-start-2 col-end-5 flex items-center justify-end gap-4">
            <div className="relative w-[360px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar no Aura"
                className="w-full h-10 rounded-full bg-[#f3f4f6] border border-transparent pl-11 pr-4 text-[13px] text-slate-700 outline-none"
              />
            </div>

            <button
              type="button"
              className="relative w-10 h-10 rounded-full bg-transparent flex items-center justify-center text-slate-500"
              aria-label="Notificações"
            >
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
              <Bell className="w-[18px] h-[18px]" />
            </button>

            <button type="button" className="relative w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
              <span className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-[#7c3aed] border-2 border-white" />
              <div className="w-full h-full bg-[linear-gradient(135deg,#c4b5fd,#93c5fd)]" />
            </button>
          </div>
        </div>
      </header>

      <div className="w-full max-w-[1440px] mx-auto grid grid-cols-[260px_640px_280px_320px] gap-x-8">
        <aside className="hidden lg:block sticky top-0 h-screen pt-4">
          <div className="relative h-screen">
            <div className="flex items-center gap-3" style={{ marginBottom: 32 }}>
              <AuraMark />
              <span className="text-[20px] font-bold tracking-tight text-slate-900">Aura</span>
            </div>

            <nav className="flex flex-col gap-2">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href="#"
                    className={`h-11 px-3 rounded-xl flex items-center gap-3 transition-colors ${
                      item.active ? 'bg-[rgba(124,58,237,0.08)] text-[#7c3aed]' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[15px] font-medium">{item.label}</span>
                    <IconBadge n={item.badge} />
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              className="w-full h-11 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] text-white font-semibold text-[14px] flex items-center justify-center gap-2 mt-4"
            >
              <Pencil className="w-4 h-4" />
              Create Post
            </button>

            <div className="absolute left-0 right-0 bottom-4 flex items-center gap-3">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-full bg-white overflow-hidden">
                  <div className="w-full h-full bg-[linear-gradient(135deg,#cbd5e1,#e2e8f0)]" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-slate-900 truncate">Julia Mendes</p>
                <p className="text-[12px] text-slate-500 truncate">@juliamendes</p>
              </div>
              <button type="button" className="p-2 rounded-full hover:bg-white" aria-label="More">
                <MoreHorizontal className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>
        </aside>

        <main className="pb-12 pt-[60px]">
          <div className="w-full max-w-[640px] mx-auto">
            <div className="pt-2">
              <div className="py-4">
                <div className="flex items-center gap-3">
                  <Avatar initials="JM" tone="cool" />

                  <div className="flex-1 h-11 rounded-full bg-white border border-slate-100 px-4 flex items-center">
                    <div className="w-full text-[15px] font-medium text-slate-400 leading-[44px] truncate">
                      No que você está pensando, Julia?
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-11 h-11 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500"
                    aria-label="Imagem"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>

                  <button type="button" className="h-11 px-3 rounded-full bg-white border border-slate-100 text-[12px] font-semibold text-slate-400">
                    GIF
                  </button>

                  <button
                    type="button"
                    className="w-11 h-11 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500"
                    aria-label="Enquete"
                  >
                    <BarChart2 className="w-5 h-5" />
                  </button>

                  <button type="button" className="h-11 px-5 rounded-full bg-[#7c3aed] text-white text-[13px] font-semibold">
                    Postar
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <PostCardMock
                  name="Julia Mendes"
                  handle="@juliamendes"
                  time="2h"
                  tone="cool"
                  content={[
                    'Há beleza nas coisas simples.',
                    'Hoje foi um daqueles dias leves',
                    'que ficam na memória ✨',
                  ]}
                  imageTone="sunset"
                  stats={{ likes: '1.2K', comments: '86', reposts: '32' }}
                />
                <PostCardMock
                  name="Felipe Rocha"
                  handle="@feliperocha"
                  time="4h"
                  tone="neutral"
                  content={['Começando a semana com foco', 'e energia positiva.']}
                  stats={{ likes: '420', comments: '23', reposts: '11' }}
                />
                <PostCardMock
                  name="Marina Dias"
                  handle="@marinadiass"
                  time="5h"
                  tone="cool"
                  content={['Inspirada por pequenas coisas e grandes sonhos.']}
                  imageTone="room"
                  stats={{ likes: '632', comments: '18', reposts: '7' }}
                />
                <PostCardMock
                  name="Lucas Bernard"
                  handle="@lucasbernard"
                  time="6h"
                  tone="neutral"
                  content={['Perfeito não é o objetivo, evoluir todos os dias é.']}
                  imageTone="pink"
                  stats={{ likes: '312', comments: '9', reposts: '4' }}
                />
              </div>
            </div>
          </div>
        </main>

        <aside className="hidden lg:block sticky top-0 h-screen pt-[60px]">
          <div className="w-[280px] flex flex-col gap-6">
            <div className={blockCls}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[15px] text-slate-900">Trending</h3>
                <Link href="#" className="text-[13px] font-medium text-[#7c3aed] hover:underline">
                  Ver todos
                </Link>
              </div>
              <div className="flex flex-col">
                {trending.map((x) => (
                  <Link key={x.tag} href="#" className="py-3 border-b border-slate-100 last:border-b-0">
                    <p className="font-semibold text-[14px] text-slate-900">#{x.tag}</p>
                    <p className="text-[13px] text-slate-500">{x.posts}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className={blockCls}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[15px] text-slate-900">Pessoas para seguir</h3>
                <Link href="#" className="text-[13px] font-medium text-[#7c3aed] hover:underline">
                  Ver todos
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {follow.map((u) => (
                  <div key={u.handle} className="flex items-center justify-between gap-3">
                    <Link href="#" className="flex items-center gap-3 min-w-0">
                      <Avatar initials={u.initials} tone={u.tone} />
                      <div className="min-w-0">
                        <p className="font-semibold text-[14px] text-slate-900 truncate">{u.name}</p>
                        <p className="text-[13px] text-slate-500 truncate">{u.handle}</p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="h-8 px-4 rounded-full border border-slate-200 text-[13px] font-medium text-slate-900 hover:bg-slate-50"
                    >
                      Seguir
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#f6f2ff] rounded-2xl px-5 py-5 border border-[#efe7ff] relative overflow-hidden">
              <div className="absolute left-4 top-4 opacity-70">
                <SparkleBlob />
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed pl-16">
                Conecte-se com pessoas
                <br />
                que compartilham
                <br />
                dos seus interesses.
              </p>
              <div className="pt-4 pl-16">
                <Link
                  href="#"
                  className="inline-flex h-10 px-6 rounded-full bg-[#7c3aed] text-white text-[13px] font-semibold items-center justify-center"
                >
                  Encontrar pessoas
                </Link>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-2 px-1">
              <span>Sobre</span>
              <span>Ajuda</span>
              <span>Privacidade</span>
              <span>Termos</span>
              <span>Cookies</span>
              <span className="w-full pt-1">© 2024 Aura — Todos os direitos reservados.</span>
            </div>
          </div>
        </aside>

        <aside className="hidden xl:block sticky top-0 h-screen pt-[60px]">
          <div className="w-[320px] flex flex-col gap-6">
            <div className={blockCls}>
              <h3 className="font-semibold text-[15px] text-slate-900">Online agora</h3>
              <div className="flex flex-col gap-3">
                {online.map((u, idx) => (
                  <Link key={u.name} href="#" className="flex items-center gap-3">
                    <Avatar initials={u.initials} tone={u.tone} />
                    <p className="font-medium text-[14px] text-slate-900 truncate">{u.name}</p>
                    <span className="ml-auto">
                      <OnlineDot color={idx === 4 ? 'bg-amber-400' : 'bg-emerald-500'} />
                    </span>
                  </Link>
                ))}
              </div>
              <Link href="#" className="text-[13px] font-medium text-[#7c3aed] hover:underline">
                Ver todos
              </Link>
            </div>

            <div className={blockCls}>
              <h3 className="font-semibold text-[15px] text-slate-900">Mensagens</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={messagesQuery}
                  onChange={(e) => setMessagesQuery(e.target.value)}
                  placeholder="Buscar mensagens"
                  className="w-full h-10 rounded-xl bg-slate-100 px-10 pr-3 text-[13px] outline-none"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg border border-slate-200 bg-white grid place-items-center text-slate-500"
                  aria-label="Filtrar"
                >
                  <SlidersIcon />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {filteredMessages.map((c) => (
                  <Link key={`${c.name}-${c.time}`} href="#" className="flex items-center gap-3">
                    <Avatar initials={c.initials} tone={c.tone} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium text-[14px] text-slate-900 truncate">{c.name}</p>
                        <p className="text-[12px] text-slate-400 whitespace-nowrap">{c.time}</p>
                      </div>
                      <p className="text-[13px] text-slate-500 truncate">{c.msg}</p>
                    </div>
                    {c.unread > 0 && (
                      <span className="ml-auto min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#7c3aed] text-white text-[11px] font-semibold flex items-center justify-center">
                        {c.unread}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
              <Link href="#" className="text-[13px] font-medium text-[#7c3aed] hover:underline">
                Ver todas as mensagens
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PostCardMock({
  name,
  handle,
  time,
  tone,
  content,
  imageTone,
  stats,
}: {
  name: string;
  handle: string;
  time: string;
  tone: 'warm' | 'cool' | 'neutral';
  content: string[];
  imageTone?: 'sunset' | 'room' | 'pink';
  stats: { likes: string; comments: string; reposts: string };
}) {
  const media =
    imageTone === 'room'
      ? 'bg-[linear-gradient(135deg,#111827,#64748b)]'
      : imageTone === 'pink'
        ? 'bg-[linear-gradient(135deg,#fda4af,#a78bfa)]'
        : 'bg-[linear-gradient(135deg,#fbcfe8,#93c5fd)]';

  return (
    <article className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-start gap-3">
        <Avatar initials={name.split(' ').map((p) => p[0]).slice(0, 2).join('')} tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-semibold text-[14px] text-slate-900 truncate">{name}</p>
                <p className="text-[13px] text-slate-400 truncate">{handle}</p>
                <span className="text-[13px] text-slate-300">·</span>
                <p className="text-[13px] text-slate-400">{time}</p>
              </div>
            </div>
            <button type="button" className="p-2 rounded-full hover:bg-slate-50 text-slate-400" aria-label="Mais">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          <div className="pt-1 text-[13px] text-slate-700 leading-relaxed">
            {content.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          {imageTone ? (
            <div className="pt-3">
              <div className={`w-full h-[220px] rounded-2xl ${media} relative overflow-hidden`}>
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,white,transparent_55%)]" />
                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_80%_60%,white,transparent_55%)]" />
              </div>
            </div>
          ) : null}

          <div className="pt-4 flex items-center gap-10 text-slate-400">
            <Action icon={Heart} label={stats.likes} />
            <Action icon={MessageCircle} label={stats.comments} />
            <Action icon={Repeat2} label={stats.reposts} />
            <Action icon={Share2} label="" />
          </div>
        </div>
      </div>
    </article>
  );
}

function Action({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button type="button" className="flex items-center gap-2 text-[12px] hover:text-slate-500">
      <Icon className="w-[18px] h-[18px]" />
      {label ? <span className="text-[12px]">{label}</span> : null}
    </button>
  );
}

function HomeIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={props.className}>
      <path
        d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9.5 21.5v-7h5v7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 21v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 10V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 21v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 8V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 21v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 12V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 8h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SparkleBlob() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="18" cy="20" r="10" fill="#E9D5FF" />
      <circle cx="34" cy="14" r="6" fill="#DDD6FE" />
      <circle cx="40" cy="30" r="10" fill="#C4B5FD" />
      <path
        d="M18 34c6 0 10 3 14 7 3 3 6 5 10 5"
        stroke="#7C3AED"
        strokeOpacity="0.5"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
