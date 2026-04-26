'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Home, Search, Bell, Mail, Bookmark, User, Users, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { subscribeToNotifications } from '@/lib/notifications';
import { useChat } from '@/components/chat/ChatProvider';

function formatBadgeCount(n: number) {
  if (n <= 0) return '';
  if (n > 99) return '99+';
  return String(n);
}

export function Sidebar() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const { unreadTotal } = useChat();
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    if (!profile?.uid) return;
    return subscribeToNotifications(profile.uid, (items) => {
      setUnreadNotifs(items.filter((n) => !n.read).length);
    });
  }, [profile?.uid]);

  const navItems = useMemo(() => {
    return [
      { href: '/feed', label: 'Início', icon: Home },
      { href: '/explore', label: 'Explorar', icon: Search },
      { href: '/communities', label: 'Comunidades', icon: Users },
      { href: '/notifications', label: 'Notificações', icon: Bell, badge: unreadNotifs },
      { href: '/messages', label: 'Mensagens', icon: Mail, badge: unreadTotal },
      { href: '/bookmarks', label: 'Salvos', icon: Bookmark },
      { href: '/profile', label: 'Perfil', icon: User },
      { href: '/settings', label: 'Mais', icon: MoreHorizontal },
    ] as Array<{ href: string; label: string; icon: any; badge?: number }>;
  }, [unreadNotifs, unreadTotal]);

  return (
    <div className="relative h-screen pb-6">
      <nav className="flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/feed' && pathname.startsWith(item.href));
          const Icon = item.icon;
          const badge = typeof item.badge === 'number' ? item.badge : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`h-[44px] px-4 rounded-xl flex items-center gap-4 transition-colors ${
                isActive ? 'bg-muted text-slate-900 font-semibold' : 'text-slate-500 hover:bg-secondary-hover font-medium hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[15px]">{item.label}</span>
              {badge > 0 && (
                <span className="ml-auto min-w-[20px] h-[20px] px-1.5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                  {formatBadgeCount(badge)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>



      {/* Footer user card removed (TopNav already covers profile access) */}
    </div>
  );
}
