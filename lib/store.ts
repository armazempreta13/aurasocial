import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { RelationshipSettings } from './friendships';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  coverURL?: string;
  bio?: string;
  location?: string;
  education?: string;
  work?: string;
  relationship?: string;
  interests: string[];
  followersCount: number;
  followingCount: number;
  privacySettings?: {
    publicProfile: boolean;
    directMessages: boolean;
    activityStatus: boolean;
  };
  relationshipSettings?: RelationshipSettings;
  onboardingCompleted?: boolean;
  username?: string;
}

interface AppState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isAuthReady: boolean;
  focusMode: boolean;
  startCall: ((remoteUserId: string, remoteUserName: string, mode: 'audio' | 'video', remoteUserPhoto?: string) => void) | null;
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setAuthReady: (ready: boolean) => void;
  setStartCall: (fn: ((remoteUserId: string, remoteUserName: string, mode: 'audio' | 'video', remoteUserPhoto?: string) => void) | null) => void;
  toggleFocusMode: () => void;
  boostInterest: (interest: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  profile: null,
  isAuthReady: false,
  focusMode: false,
  startCall: null,
  setUser: (user) =>
    set((state) => {
      const prevUid = state.user?.uid ?? null;
      const nextUid = user?.uid ?? null;
      if (prevUid === nextUid) return state;
      return { user };
    }),
  setProfile: (profile) =>
    set((state) => {
      if (state.profile === profile) return state;
      return { profile };
    }),
  setAuthReady: (ready) => set({ isAuthReady: ready }),
  setStartCall: (fn) => set({ startCall: fn }),
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  boostInterest: (interest) => set((state) => {
    if (!state.profile) return state;
    const normalized = interest.toLowerCase().trim();
    if (!state.profile.interests.includes(normalized)) {
      return {
        profile: {
          ...state.profile,
          interests: [normalized, ...state.profile.interests].slice(0, 20) // Keep top 20 fresh interests
        }
      };
    }
    // If already exists, move to front (recency bias)
    const filtered = state.profile.interests.filter(i => i !== normalized);
    return {
      profile: {
        ...state.profile,
        interests: [normalized, ...filtered]
      }
    };
  }),
}));
