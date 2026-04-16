'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/firebase';
import { collection, query, where, getDocs, orderBy, limit, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Shield, Trash2, Loader2, MessageSquare } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function CommunityAdminModerationStub() {
  const { id } = useParams();
  const { profile } = useAppStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const q = query(
          collection(db, 'posts'),
          where('communityId', '==', id),
          orderBy('createdAt', 'desc'),
          limit(30)
        );
        const snapshot = await getDocs(q);
        setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [id]);

  const handleDelete = async (postId: string, authorName: string) => {
    if (!profile) return;
    if (!confirm('Are you strictly sure you want to delete this post? This cannot be undone.')) return;
    setActionLoading(postId);
    try {
      await deleteDoc(doc(db, 'posts', postId));
      
      // Log the action
      await addDoc(collection(db, 'communities', id as string, 'audit_logs'), {
        action: 'DELETE_POST',
        actorId: profile.uid,
        actorName: profile.displayName || 'Admin',
        targetName: `Post by ${authorName}`,
        timestamp: serverTimestamp()
      });

      setPosts(posts.filter(p => p.id !== postId));
    } catch (err) {
      console.error(err);
      alert('Failed to delete post. Check permissions.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading queue...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Content Moderation</h1>
        <p className="text-muted-foreground mt-1">Review recently published content and manage moderation actions.</p>
      </div>

      <div className="bg-white rounded-3xl border border-border/50 shadow-sm overflow-hidden">
        {posts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-6 shadow-inner">
               <Shield className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Clean Queue</h3>
            <p className="text-muted-foreground mb-8 max-w-md">No recent posts found in this community. Your space is safe and clean.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {posts.map(post => (
              <li key={post.id} className="p-6 hover:bg-muted/10 transition-colors flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0 mt-1border border-border/50">
                   {post.authorPhoto ? <img src={post.authorPhoto} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-foreground text-sm">{post.authorName}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Post
                    </span>
                  </div>
                  <p className="text-foreground text-[15px] leading-relaxed break-words line-clamp-3">
                    {post.content}
                  </p>
                  {post.imageUrl && (
                    <div className="mt-3">
                      <img src={post.imageUrl} className="h-24 w-auto rounded-xl border border-border/50 object-cover" />
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                   {actionLoading === post.id ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                   ) : (
                     <button 
                       onClick={() => handleDelete(post.id, post.authorName || 'Unknown')}
                       className="p-2.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                       title="Delete Post"
                     >
                       <Trash2 className="w-5 h-5" />
                     </button>
                   )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
