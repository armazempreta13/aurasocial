'use client';

import { useCallback, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { ensureRelationshipSettings } from '@/lib/friendships';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((state) => state.setUser);
  const setProfile = useAppStore((state) => state.setProfile);
  const setAuthReady = useAppStore((state) => state.setAuthReady);
  const presenceHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildFallbackProfile = useCallback((firebaseUser: User) => {
    const baseName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user';
    const fallbackUsername = baseName.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1000);
    
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || baseName || 'User',
      username: fallbackUsername,
      photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${firebaseUser.displayName || 'User'}&background=random`,
      interests: [],
      followersCount: 0,
      followingCount: 0,
      privacySettings: {
        publicProfile: true,
        directMessages: true,
        activityStatus: true,
      },
      onboardingCompleted: false,

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
    };
  }, []);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setProfile(null);
    setAuthReady(true);
  }, [setAuthReady, setProfile, setUser]);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let latestUserRef: ReturnType<typeof doc> | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthReady(false);
      
      // Clear previous profile listener if exists
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (presenceHeartbeatRef.current) {
        clearInterval(presenceHeartbeatRef.current);
        presenceHeartbeatRef.current = null;
      }
      latestUserRef = null;

      if (!firebaseUser) {
        clearAuthState();
        return;
      }

      const fbProfile = buildFallbackProfile(firebaseUser);
      const userRef = doc(db, 'users', firebaseUser.uid);
      latestUserRef = userRef;
      setUser(firebaseUser);

      // 🛡️ REAL-TIME SECURITY ENFORCEMENT
      unsubProfile = onSnapshot(userRef, async (snap) => {
        if (snap.exists()) {
          const profileData = snap.data();

          if (profileData.isBanned) {
            console.error('Aura Security: INSTANT TERMINATION - Account Restricted.');
            if (unsubProfile) {
              unsubProfile();
              unsubProfile = null;
            }
            await signOut(auth);
            clearAuthState();
            alert('Esta conta foi suspensa por violação dos termos de uso da Aura.');
            return;
          }
          
          // 🔄 FORÇAR COMPLEMENTAÇÃO DE DADOS (GOOGLE LOGIN OU ANTIGO)
          const isDataIncomplete = !profileData.username || !profileData.birthDate || !profileData.contactVerified;
          
          if (isDataIncomplete && profileData.onboardingCompleted !== false) {
            profileData.onboardingCompleted = false;
            await updateDoc(userRef, { onboardingCompleted: false }).catch(() => {});
          }

          setProfile({ ...fbProfile, ...profileData } as any);


          setAuthReady(true);
        } else {
          // New User Case
          await setDoc(userRef, { ...fbProfile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => {});
          setProfile(fbProfile as any);
          setAuthReady(true);
        }
      }, (error) => {
        console.warn('Aura: Profile sync interrupted. Using fallback.', error);
        setProfile(fbProfile as any);
        setAuthReady(true);
      });

      // Presence: update outside the profile snapshot listener to avoid feedback loops.
      updateDoc(userRef, { lastActive: serverTimestamp(), isOnline: true }).catch(() => {});
      presenceHeartbeatRef.current = setInterval(() => {
        updateDoc(userRef, { lastActive: serverTimestamp(), isOnline: true }).catch(() => {});
      }, 60_000);
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
      if (presenceHeartbeatRef.current) {
        clearInterval(presenceHeartbeatRef.current);
        presenceHeartbeatRef.current = null;
      }
      if (latestUserRef) {
        updateDoc(latestUserRef, { lastActive: serverTimestamp(), isOnline: false }).catch(() => {});
      }
    };
  }, [clearAuthState, setUser, setProfile, setAuthReady, buildFallbackProfile]);

  return <>{children}</>;
}
