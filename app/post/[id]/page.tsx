'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { TopNav } from '@/components/TopNav';
import { PostCard } from '@/components/PostCard';

export default function PostPage() {
  const params = useParams();
  const postId = params?.id as string;
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;

    const loadPost = async () => {
      try {
        const postSnap = await getDoc(doc(db, 'posts', postId));
        if (postSnap.exists()) {
          setPost({
            id: postSnap.id,
            ...postSnap.data(),
          });
        } else {
          setPost(null);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadPost();
  }, [postId]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <TopNav />
      <main className="pt-[84px] max-w-[760px] mx-auto px-4">
        {loading ? (
          <div className="bg-white rounded-3xl p-8 border border-border/50 shadow-sm text-center text-muted-foreground">
            Loading post...
          </div>
        ) : post ? (
          <PostCard post={post} />
        ) : (
          <div className="bg-white rounded-3xl p-8 border border-border/50 shadow-sm text-center">
            <h1 className="text-xl font-bold text-foreground mb-2">Post not found</h1>
            <p className="text-muted-foreground">This shared post is no longer available.</p>
          </div>
        )}
      </main>
    </div>
  );
}
