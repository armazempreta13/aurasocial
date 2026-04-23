import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import Link from 'next/link';

export function FollowersList({ userId, type }: { userId: string, type: 'followers' | 'following' | 'friends' }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const q =
      type === 'followers'
        ? query(collection(db, 'followers'), where('followingId', '==', userId))
        : type === 'following'
          ? query(collection(db, 'followers'), where('followerId', '==', userId))
          : query(collection(db, 'friendships'), where('users', 'array-contains', userId));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const userPromises = snapshot.docs.map(async (relationDoc) => {
          const data = relationDoc.data();
          if (type === 'friends' && data.status !== 'active') {
            return null;
          }

          const targetId =
            type === 'followers'
              ? data.followerId
              : type === 'following'
                ? data.followingId
                : (data.users || []).find((id: string) => id !== userId);

          if (!targetId) return null;

          const userSnap = await getDoc(doc(db, 'users', targetId));
          return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
        });

        const resolvedUsers = (await Promise.all(userPromises)).filter(Boolean);
        setUsers(resolvedUsers);
      } catch (error) {
        console.error(`Error processing ${type} updates:`, error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [userId, type]);


  if (loading) {
    return <div className="text-muted-foreground text-[14px] py-2">Loading...</div>;
  }

  if (users.length === 0) {
    return <div className="text-muted-foreground text-[14px] py-2">No {type} yet.</div>;
  }

  return (
    <div className="flex flex-col gap-3 mt-2">
      {users.slice(0, 5).map((user) => (
        <Link key={user.id} href={`/profile/${user.id}`} className="flex items-center gap-3 hover:bg-muted/50 p-2 rounded-xl transition-colors">
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium">
                {user.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="font-semibold text-[14px] text-foreground truncate">{user.displayName}</div>
            {user.bio && <div className="text-[12px] text-muted-foreground truncate">{user.bio}</div>}
          </div>
        </Link>
      ))}
      {users.length > 5 && (
        <button className="text-primary text-[14px] font-medium hover:underline mt-1">
          View all {users.length}
        </button>
      )}
    </div>
  );
}
