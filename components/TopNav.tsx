'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Home, Compass, Users, Bookmark, MessageCircle } from 'lucide-react';
import { FocusModeToggle } from './FocusModeToggle';
import { Logo } from './Logo';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

const NotificationsDropdown = dynamic(() => import('./NotificationsDropdown').then((mod) => mod.NotificationsDropdown), {
  ssr: false,
});

const ProfileDropdown = dynamic(() => import('./ProfileDropdown').then((mod) => mod.ProfileDropdown), {
  ssr: false,
});

const MessagesDropdown = dynamic(() => import('./MessagesDropdown').then((mod) => mod.MessagesDropdown), {
  ssr: false,
});

export function TopNav() {
  const { t } = useTranslation('common');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        document.getElementById('top-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleDown);
    return () => window.removeEventListener('keydown', handleDown);
  }, []);

  const navLinks = [
    { href: '/feed', icon: Home },
    { href: '/explore', icon: Compass },
    { href: '/network', icon: Users },
    { href: '/bookmarks', icon: Bookmark },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-[64px] bg-white/80 backdrop-blur-lg border-b border-border z-50 flex items-center justify-between px-6 transition-all duration-300">
      {/* Left: Logo & Search */}
      <div className="flex items-center gap-4 w-[280px]">
        <Link href="/feed">
          <Logo className="h-9" />
        </Link>
        <form onSubmit={handleSearch} className="relative hidden md:block group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <input 
            type="text" 
            id="top-search-input"
            placeholder={t('topnav.search_placeholder', 'Explore Aura...')} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-muted/50 hover:bg-muted focus:bg-white border border-transparent focus:border-primary/30 rounded-full py-2 pl-10 pr-4 text-[14px] focus:outline-none focus:ring-4 focus:ring-primary/10 w-[240px] transition-all duration-300" 
          />
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-muted-foreground/20 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 group-focus-within:opacity-0 transition-opacity">
              <span>/</span>
            </kbd>
          </div>
        </form>
      </div>
      
      {/* Center: Nav Icons */}
      <div className="hidden md:flex items-center justify-center gap-2 flex-1 max-w-[500px]">
        {navLinks.map(({ href, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link 
              key={href}
              href={href} 
              onClick={(e) => {
                if (pathname === href) {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={`flex-1 h-[44px] flex items-center justify-center rounded-xl transition-colors ${
                isActive 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-6 h-6" />
            </Link>
          );
        })}
      </div>

      {/* Right: Profile & Actions */}
      <div className="flex items-center justify-end gap-3 w-[280px]">
        <FocusModeToggle />
        <div className="flex items-center gap-2">
          <MessagesDropdown />
          <NotificationsDropdown />
        </div>
        <ProfileDropdown />
      </div>
    </header>

  );
}
