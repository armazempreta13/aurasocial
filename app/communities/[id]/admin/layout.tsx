'use client';

import { AppLayout } from '@/components/AppLayout';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import { Settings, Users, Shield, List, ArrowLeft, Activity, Lock, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function CommunityAdminLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAppStore();
  
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !profile) return;
    const unsubscribe = onSnapshot(doc(db, 'communities', id as string), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isMember = data.members?.includes(profile.uid);
        const userRole = data.roles?.[profile.uid] || 'member';
        const isAdmin = isMember && (data.creatorId === profile.uid || userRole === 'admin' || userRole === 'owner');
        
        if (!isAdmin) {
          router.push(`/communities/${id}`); // Kick out
          return;
        }
        setCommunity({ id: docSnap.id, ...data, currentUserRole: data.creatorId === profile.uid ? 'owner' : userRole });
      } else {
        router.push('/communities');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, profile, router]);

  if (loading) {
    return (
      <AppLayout wide={true} hideRightPanel={true}>
        <div className="flex justify-center items-center h-[60vh] text-muted-foreground">Loading admin panel...</div>
      </AppLayout>
    );
  }

  const navItems = [
    { name: 'General Settings', path: `/communities/${id}/admin`, icon: Settings },
    { name: 'Security & Join', path: `/communities/${id}/admin/security`, icon: Lock },
    { name: 'Members', path: `/communities/${id}/admin/members`, icon: Users },
    { name: 'Rules', path: `/communities/${id}/admin/rules`, icon: List },
    { name: 'Content Moderation', path: `/communities/${id}/admin/moderation`, icon: Shield },
    { name: 'Analytics', path: `/communities/${id}/admin/analytics`, icon: BarChart3 },
    { name: 'Audit Logs', path: `/communities/${id}/admin/audit`, icon: Activity },
  ];

  return (
    <AppLayout wide={true} hideRightPanel={true}>
      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        
        {/* Admin Sidebar */}
        <div className="w-full lg:w-[280px] shrink-0">
          <Link 
            href={`/communities/${id}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 transition-colors group px-2"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Community
          </Link>

          <div className="bg-white rounded-3xl border border-border/50 shadow-sm overflow-hidden sticky top-[90px]">
            <div className="p-6 border-b border-border/50 bg-muted/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-border/50">
                   {community.image ? <img src={community.image} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-foreground truncate">{community.name}</h2>
                  <p className="text-[12px] text-muted-foreground truncate uppercase font-semibold tracking-wider">Admin Studio</p>
                </div>
              </div>
            </div>
            
            <div className="p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 w-full min-w-0">
           {children}
        </div>
      </div>
    </AppLayout>
  );
}
