'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Users, Bookmark, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function BottomNav() {
  const { t } = useTranslation('common');
  const pathname = usePathname();

  const navLinks = [
    { href: '/feed', icon: Home, label: 'Feed' },
    { href: '/explore', icon: Compass, label: 'Explore' },
    { href: '/network', icon: Users, label: 'Network' },
    { href: '/bookmarks', icon: Bookmark, label: 'Salvos' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[64px] bg-white/90 backdrop-blur-lg border-t border-border z-[100] md:hidden flex items-center justify-around px-2 pb-safe">
      {navLinks.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className={`p-1.5 rounded-full transition-all ${isActive ? 'bg-primary/10' : ''}`}>
              <Icon className={`w-5 h-5 ${isActive ? 'fill-primary/20' : ''}`} />
            </div>
            <span className="text-[10px] font-bold">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
