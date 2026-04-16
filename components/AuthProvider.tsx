'use client';

import { useCallback, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { ensureRelationshipSettings } from '@/lib/friendships';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((state) => state.setUser);
  const setProfile = useAppStore((state) => state.setProfile);
  const setAuthReady = useAppStore((state) => state.setAuthReady);

  const buildFallbackProfile = useCallback((firebaseUser: User) => ({
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${firebaseUser.displayName || 'User'}&background=random`,
    interests: [],
    followersCount: 0,
    followingCount: 0,
    privacySettings: {
      publicProfile: true,
      directMessages: true,
      activityStatus: true,
    },
    onboardingCompleted: true,
    relationshipSettings: {
      whoCanSendFriendRequest: 'everyone',
      whoCanSeeFriendList: 'everyone',
      whoCanMessageMe: 'everyone',
      whoCanInviteMeToCommunities: 'everyone',
      whoCanSeeFriendsOnlyPosts: 'friends',
      allowFriendRequestMessage: true,
      showMutualFriends: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }), []);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setProfile(null);
    setAuthReady(true);
  }, [setAuthReady, setProfile, setUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthReady(false);

      if (!firebaseUser) {
        clearAuthState();
        return;
      }

      const fbProfile = buildFallbackProfile(firebaseUser);

      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const profileData = userSnap.data();
          setUser(firebaseUser);
          setProfile({ ...fbProfile, ...profileData, onboardingCompleted: true } as any);
          
          await updateDoc(userRef, { lastActive: serverTimestamp(), isOnline: true }).catch(() => {});
          setAuthReady(true);
          return;
        }

        // New User Initialization
        await setDoc(userRef, { ...fbProfile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => {});
        setUser(firebaseUser);
        setProfile(fbProfile as any);
        setAuthReady(true);
      } catch (error: any) {
        console.warn('Aura: Firebase permissions issue detected. Running in Local Identity mode.', error);
        
        // EMERGENCY FALLBACK (Zero Firebase Required)
        setUser(firebaseUser);
        setProfile(fbProfile as any);
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, [clearAuthState, setUser, setProfile, setAuthReady, buildFallbackProfile]);

  return <>{children}</>;
}
