'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { useRequireAuth } from '@/hooks/useRequireAuth';

/**
 * Redirects from @username to the actual profile ID
 */
export default function UsernameRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username as string;
  const [error, setError] = useState(false);
  const { user, isAuthReady } = useRequireAuth();

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  useEffect(() => {
    if (!username) return;

    const findUser = async () => {
      try {
        const q = query(
          collection(db, 'users'), 
          where('username', '==', username.toLowerCase()), 
          limit(1)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          router.replace(`/profile/${userDoc.id}`);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error finding user by username:', err);
        setError(true);
      }
    };

    findUser();
  }, [username, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">User not found</h1>
        <p className="text-muted-foreground mb-6">The user @{username} does not exist or has changed their handle.</p>
        <button 
          onClick={() => router.push('/')}
          className="bg-primary text-white px-6 py-2 rounded-full font-bold"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
