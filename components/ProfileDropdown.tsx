'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Settings, HelpCircle, Moon, MessageSquareWarning, LogOut, ChevronRight } from 'lucide-react';
import { auth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export function ProfileDropdown() {
  const { t } = useTranslation('common');
  const profile = useAppStore((state) => state.profile);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!profile) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-border/50 hover:ring-2 hover:ring-primary/20 transition-all"
      >
        {profile.photoURL ? (
          <img src={profile.photoURL} alt={profile.displayName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium">
            {profile.displayName?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[360px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border/50 overflow-hidden z-50 flex flex-col p-3">
          
          {/* Profile Header */}
          <div className="p-2 rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.05)] border border-border/30 mb-2">
            <Link 
              href={`/profile/${profile.uid}`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt={profile.displayName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium">
                    {profile.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[15px] text-foreground leading-tight">{profile.displayName}</h3>
              </div>
            </Link>
            
            <div className="px-2 pb-2 pt-1">
              <Link
                href="/network"
                onClick={() => setIsOpen(false)}
                className="w-full block text-center py-1.5 text-[14px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
              >
                {t('profile_dropdown.see_all_profiles', 'See all profiles')}
              </Link>
            </div>
          </div>

          {/* Menu Items */}
          <div className="flex flex-col gap-1">
            <Link href="/settings">
              <MenuItem icon={Settings} label={t('profile_dropdown.settings', 'Settings & privacy')} hasArrow onClick={() => setIsOpen(false)} />
            </Link>
            <Link href="/help">
              <MenuItem icon={HelpCircle} label={t('profile_dropdown.help', 'Help & support')} hasArrow onClick={() => setIsOpen(false)} />
            </Link>
            <Link href="/settings?tab=display">
              <MenuItem icon={Moon} label={t('profile_dropdown.display', 'Display & accessibility')} hasArrow onClick={() => setIsOpen(false)} />
            </Link>
            <Link href="/feedback">
              <MenuItem 
                icon={MessageSquareWarning} 
                label={t('profile_dropdown.feedback', 'Give feedback')} 
                subLabel={t('profile_dropdown.feedback_desc', 'Help us improve')} 
                onClick={() => setIsOpen(false)}
              />
            </Link>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors w-full text-left"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5 text-foreground" />
              </div>
              <span className="font-semibold text-[15px] text-foreground flex-1">{t('profile_dropdown.logout', 'Log Out')}</span>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-3 px-2 text-[12px] text-muted-foreground leading-relaxed flex flex-wrap gap-x-2 gap-y-1">
            <Link href="/help" className="hover:underline">{t('footer.privacy', 'Privacy')}</Link>
            <span>·</span>
            <Link href="/help" className="hover:underline">{t('footer.terms', 'Terms')}</Link>
            <span>·</span>
            <Link href="/help" className="hover:underline">{t('footer.advertising', 'Advertising')}</Link>
            <span>·</span>
            <Link href="/help" className="hover:underline">{t('footer.ad_choices', 'Ad Choices')}</Link>
            <span>·</span>
            <Link href="/help" className="hover:underline">{t('footer.cookies', 'Cookies')}</Link>
            <span>·</span>
            <Link href="/help" className="hover:underline">{t('footer.more', 'More')}</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, subLabel, hasArrow, onClick }: { icon: any, label: string, subLabel?: string, hasArrow?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors w-full text-left"
    >
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-foreground" />
      </div>
      <div className="flex-1 flex flex-col">
        <span className="font-semibold text-[15px] text-foreground">{label}</span>
        {subLabel && <span className="text-[12px] text-muted-foreground">{subLabel}</span>}
      </div>
      {hasArrow && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
    </button>
  );
}
