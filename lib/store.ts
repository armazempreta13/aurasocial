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
}

interface AppState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isAuthReady: boolean;
  focusMode: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setAuthReady: (ready: boolean) => void;
  toggleFocusMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  profile: null,
  isAuthReady: false,
  focusMode: false,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setAuthReady: (ready) => set({ isAuthReady: ready }),
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
}));
