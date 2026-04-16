'use client';

import { Compass, Bell, LogOut, Users, Bookmark } from 'lucide-react';
import { auth, db } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useAppStore } from '@/lib/store';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { useState, useEffect } from 'react';

import Link from 'next/link';

import { useTranslation } from 'react-i18next';

export function Sidebar() {
  const { t } = useTranslation('common');
  const profile = useAppStore((state) => state.profile);
  const [myCommunities, setMyCommunities] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.uid) return;

    const loadCommunities = async () => {
      try {
        const snapshot = await getDocs(query(
          collection(db, 'communities'),
          where('creatorId', '==', profile.uid),
          limit(5)
        ));
        const communities = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMyCommunities(communities);
      } catch (error) {
        console.error('Error loading sidebar communities:', error);
      }
    };

    void loadCommunities();
  }, [profile?.uid]);

  const navItems = [
    { icon: Compass, label: t('nav.explore', 'Explore'), href: '/explore' },
    { icon: Users, label: t('nav.network', 'Network'), href: '/network' },
    { icon: Users, label: t('nav.communities', 'Communities'), href: '/communities' },
    { icon: Bookmark, label: t('nav.bookmarks', 'Saved Items'), href: '/bookmarks' },
    { icon: Bell, label: t('nav.notifications', 'Notifications'), href: '/notifications' },
  ];

  return (
    <div className="flex flex-col gap-2">
      {profile && (
        <Link 
          href={`/profile/${profile.uid}`}
          className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-white hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium text-sm">
                {profile.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col items-start">
            <span className="font-extrabold text-[15.5px] text-[#2a2c5a] dark:text-white leading-tight">{profile.displayName}</span>
            <span className="text-[12px] font-bold text-[#8a94a6] hover:text-[#7a63f1] transition-colors">{t('sidebar.view_profile', 'Ver Perfil')}</span>
          </div>
        </Link>
      )}

      <div className="mt-6 mb-3 px-3">
        <h3 className="text-[10.5px] font-black text-[#8a94a6] uppercase tracking-[0.2em]">{t('sidebar.menu', 'Menu Principal')}</h3>
      </div>

      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex items-center gap-3.5 w-full px-4 py-3 rounded-[20px] text-[#5c6b8a] hover:bg-white hover:text-[#7a63f1] hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-all duration-300 group mb-1"
        >
          <div className="w-9 h-9 rounded-[14px] bg-slate-50 group-hover:bg-[#7a63f1]/10 flex items-center justify-center transition-all duration-300">
            <item.icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110`} />
          </div>
          <span className="font-black text-[14.5px] tracking-tight">{item.label}</span>
        </Link>
      ))}

      {myCommunities.length > 0 && (
        <>
          <div className="mt-8 mb-3 px-3 flex items-center justify-between">
            <h3 className="text-[10.5px] font-black text-[#8a94a6] uppercase tracking-[0.2em]">{t('sidebar.your_communities', 'Suas Comunidades')}</h3>
            <Link href="/communities" className="text-[11px] font-black text-[#7a63f1] hover:underline transition-all">{t('sidebar.see_all', 'Ver Todas')}</Link>
          </div>
          <div className="space-y-1">
            {myCommunities.map((community) => (
              <Link
                key={community.id}
                href={`/communities/${community.id}`}
                className="flex items-center gap-3 w-full p-2 rounded-xl text-muted-foreground hover:bg-white hover:text-primary hover:shadow-sm transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-muted overflow-hidden shrink-0">
                  <img src={community.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                </div>
                <span className="font-medium text-[13px] truncate">{community.name}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <hr className="my-4 border-border" />

      <button 
        onClick={() => signOut(auth)}
        className="flex items-center gap-4 w-full px-4 py-3.5 rounded-[22px] text-[#8a94a6] hover:bg-rose-50 hover:text-rose-600 transition-all duration-300 group mt-4 border border-transparent hover:border-rose-100"
      >
        <div className="w-9 h-9 rounded-[14px] bg-slate-50 group-hover:bg-rose-100 flex items-center justify-center transition-all duration-300">
          <LogOut className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </div>
        <span className="font-black text-[14.5px] tracking-tight">{t('nav.logout', 'Sair da Conta')}</span>
      </button>
    </div>
  );
}
