'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Home, Compass, Users, Bookmark } from 'lucide-react';
import { FocusModeToggle } from './FocusModeToggle';
import { Logo } from './Logo';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'motion/react';

const NotificationsDropdown = dynamic(() => import('./NotificationsDropdown').then((mod) => mod.NotificationsDropdown), {
  ssr: false,
});

const ProfileDropdown = dynamic(() => import('./ProfileDropdown').then((mod) => mod.ProfileDropdown), {
  ssr: false,
});

const MessagesDropdown = dynamic(() => import('./MessagesDropdown').then((mod) => mod.MessagesDropdown), {
  ssr: false,
});

const SearchOverlay = dynamic(() => import('./SearchOverlay').then((mod) => mod.SearchOverlay), {
  ssr: false,
});

export function TopNav() {
  const { t } = useTranslation('common');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  // Keyboard shortcut: press "/" to open search
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-[64px] bg-white/80 backdrop-blur-lg border-b border-border z-50 flex items-center justify-between px-6 transition-all duration-300">
        {/* Left: Logo & Search trigger */}
        <div className="flex items-center gap-4 w-[280px]">
          <Link href="/feed">
            <Logo className="h-9" />
          </Link>

          {/* Search trigger button — opens overlay */}
          <button
            type="button"
            id="top-search-input"
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:flex items-center gap-2 bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/20 rounded-full py-2 pl-3 pr-4 text-[14px] text-muted-foreground w-[240px] transition-all duration-300 group"
          >
            <Search className="w-4 h-4 shrink-0 group-hover:text-primary transition-colors" />
            <span className="flex-1 text-left truncate">
              {t('topnav.search_placeholder', 'Explore Aura...')}
            </span>
            <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border border-muted-foreground/20 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              /
            </kbd>
          </button>
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

      {/* Search Overlay Portal */}
      <AnimatePresence>
        {isSearchOpen && (
          <SearchOverlay onClose={() => setIsSearchOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
