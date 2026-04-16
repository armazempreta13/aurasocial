'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/firebase';
import { doc, getDoc, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { BarChart3, Users, MessageSquare, Heart, TrendingUp } from 'lucide-react';

export default function CommunityAdminAnalyticsPage() {
  const params = useParams();
  const id = params?.id as string;
  const [stats, setStats] = useState({
    memberCount: 0,
    postCount: 0,
    loading: true
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const commSnap = await getDoc(doc(db, 'communities', id as string));
        const postQuery = query(collection(db, 'posts'), where('communityId', '==', id));
        const postCountSnap = await getCountFromServer(postQuery);
        
        setStats({
          memberCount: commSnap.data()?.memberCount || 0,
          postCount: postCountSnap.data().count || 0,
          loading: false
        });
      } catch (err) {
        console.error(err);
        setStats(s => ({ ...s, loading: false }));
      }
    };
    fetchAnalytics();
  }, [id]);

  if (stats.loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Monitor your community's growth and engagement.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-border/50 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shrink-0">
             <Users className="w-8 h-8" />
          </div>
          <div>
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Members</div>
            <div className="text-4xl font-extrabold text-foreground">{stats.memberCount}</div>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl p-6 border border-border/50 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
             <MessageSquare className="w-8 h-8" />
          </div>
          <div>
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Posts</div>
            <div className="text-4xl font-extrabold text-foreground">{stats.postCount}</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-border/50 mt-6 flex flex-col items-center">
        <TrendingUp className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-bold mb-2">More insights coming soon</h3>
        <p className="text-muted-foreground max-w-sm">We are building advanced charts for weekly engagement grids and retention curves.</p>
      </div>
    </div>
  );
}
