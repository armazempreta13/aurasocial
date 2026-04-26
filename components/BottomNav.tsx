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
    <div className="fixed bottom-0 left-0 right-0 h-[60px] bg-white/95 backdrop-blur-lg border-t border-border z-[100] md:hidden flex items-center justify-around px-1 pb-safe">
      {navLinks.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[9px] font-semibold leading-none">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
