'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { useRequireAuth } from '@/hooks/useRequireAuth';

/**
 * Handles root-level handles starting with @ (e.g. /@username)
 * Redirects to the actual profile ID
 */
export default function HandleRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const handle = params?.handle as string;
  const [error, setError] = useState(false);
  const { user, isAuthReady } = useRequireAuth();

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  // Decode the handle - the @ might be URL encoded as %40
  const decodedHandle = decodeURIComponent(handle);

  useEffect(() => {
    // If it doesn't start with @, it might be an accidental match (though static routes should win)
    // We only want to handle @username here.
    if (!decodedHandle.startsWith('@')) {
      setError(true);
      return;
    }

    const username = decodedHandle.slice(1).toLowerCase();

    if (!username) {
      setError(true);
      return;
    }

    const findUser = async () => {
      try {
        const q = query(
          collection(db, 'users'), 
          where('username', '==', username), 
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
  }, [decodedHandle, router]);

  if (error) {
    // If it's not a handle or not found, we should probably trigger a 404
    // but since this is a root dynamic route, we must be careful.
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
        <p className="text-muted-foreground mb-6">O usuário {decodedHandle} não existe ou mudou de nome.</p>
        <button 
          onClick={() => router.push('/')}
          className="bg-primary text-white px-6 py-2 rounded-full font-bold"
        >
          Voltar para Início
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
