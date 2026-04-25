'use client';

import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bookmark, LogOut, MessagesSquare, Settings, Users, User, Sparkles } from 'lucide-react';
import { signOut } from 'firebase/auth';

import { useAppStore } from '@/lib/store';
import { auth } from '@/firebase';

export function ProfileDropdown() {
  const profile = useAppStore((s) => s.profile);
  const focusMode = useAppStore((s) => s.focusMode);
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="w-10 h-10 rounded-full bg-muted overflow-hidden border border-border hover:bg-secondary-hover transition-colors"
          aria-label="Abrir menu do perfil"
        >
          {profile?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 font-semibold">
              {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="w-64 bg-white border border-border rounded-2xl shadow-2xl p-2 z-[80]"
        >
          <div className="px-3 py-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted border border-border overflow-hidden shrink-0">
              {profile?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-[12px]">
                  {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-slate-900 truncate">{profile?.displayName || 'Usuário'}</p>
              <p className="text-[12px] text-slate-400 font-medium truncate">@{profile?.username || 'aura'}</p>
            </div>
          </div>
          <div className="h-px bg-border my-2" />

          <DropdownMenu.Item asChild>
            <Link href={`/profile/${profile?.uid || ''}`} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary-hover text-[13px] font-semibold text-slate-700 outline-none">
              <User className="w-4 h-4 text-slate-400" />
              Perfil
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link href="/messages" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary-hover text-[13px] font-semibold text-slate-700 outline-none">
              <MessagesSquare className="w-4 h-4 text-slate-400" />
              Mensagens
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link href="/communities" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary-hover text-[13px] font-semibold text-slate-700 outline-none">
              <Users className="w-4 h-4 text-slate-400" />
              Comunidades
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link href="/bookmarks" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary-hover text-[13px] font-semibold text-slate-700 outline-none">
              <Bookmark className="w-4 h-4 text-slate-400" />
              Salvos
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary-hover text-[13px] font-semibold text-slate-700 outline-none">
              <Settings className="w-4 h-4 text-slate-400" />
              Configurações
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              toggleFocusMode();
            }}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-secondary-hover text-[13px] font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-slate-400" />
              Modo foco
            </span>
            <span className={`w-10 h-6 rounded-full border border-border p-0.5 flex items-center ${focusMode ? 'bg-primary/10 justify-end' : 'bg-muted justify-start'}`}>
              <span className={`w-5 h-5 rounded-full ${focusMode ? 'bg-primary' : 'bg-slate-300'}`} />
            </span>
          </DropdownMenu.Item>

          <div className="h-px bg-border my-2" />

          <DropdownMenu.Item
            onSelect={async (e) => {
              e.preventDefault();
              try {
                await signOut(auth as any);
              } catch (err) {
                console.warn('signOut failed:', err);
              }
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-rose-50 text-[13px] font-semibold text-rose-600 outline-none cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
