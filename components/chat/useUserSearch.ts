'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import { type ChatUserPreview } from '@/lib/chat-runtime';

export function useUserSearch(searchQuery: string) {
  const [results, setResults] = useState<ChatUserPreview[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    const cleanQuery = searchQuery.trim().toLowerCase().replace(/^@/, '');
    setLoading(true);

    const delayDebounceFn = setTimeout(async () => {
      try {
        const usersRef = collection(db, 'users');
        
        // Busca pelo handle / username
        const qUsername = query(
          usersRef,
          where('username', '>=', cleanQuery),
          where('username', '<=', cleanQuery + '\uf8ff'),
          limit(10)
        );

        // Busca pelo nome / displayName
        const qDisplayName = query(
          usersRef,
          where('displayName', '>=', searchQuery.trim()),
          where('displayName', '<=', searchQuery.trim() + '\uf8ff'),
          limit(10)
        );

        const [snapUsername, snapDisplayName] = await Promise.all([
          getDocs(qUsername),
          getDocs(qDisplayName)
        ]);

        const userMap = new Map<string, ChatUserPreview>();

        snapUsername.docs.forEach((doc) => {
          const data = doc.data();
          userMap.set(doc.id, {
            uid: doc.id,
            displayName: data.displayName || data.name || 'Usuário',
            photoURL: data.photoURL || data.avatarUrl,
            username: data.username,
            status: data.status || 'offline',
            lastSeen: data.lastSeen?.toMillis?.() || data.lastSeen
          });
        });

        snapDisplayName.docs.forEach((doc) => {
          const data = doc.data();
          if (!userMap.has(doc.id)) {
            userMap.set(doc.id, {
              uid: doc.id,
              displayName: data.displayName || data.name || 'Usuário',
              photoURL: data.photoURL || data.avatarUrl,
              username: data.username,
              status: data.status || 'offline',
              lastSeen: data.lastSeen?.toMillis?.() || data.lastSeen
            });
          }
        });

        setResults(Array.from(userMap.values()));
      } catch (error) {
        console.error('Erro ao buscar usuários:', error);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  return { results, loading };
}
