'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { auth } from '@/firebase';

type SignalingEvent = {
  id: string;
  type: string;
  fromId: string;
  payload: any;
};

interface SignalingContextType {
  sendSignal: (toId: string, type: string, payload: any) => Promise<void>;
  events: SignalingEvent | null;
}

const SignalingContext = createContext<SignalingContextType | undefined>(undefined);

export function SignalingProvider({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((state) => state.profile);
  const [events, setEvents] = useState<SignalingEvent | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }, []);

  // 1. POLLING SYNC (Reliable Internal Bridge)
  useEffect(() => {
    if (!profile?.uid) return;

    const pollSignals = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`/api/signaling?userId=${profile.uid}`, { headers: authHeaders });
        if (res.ok) {
          const signals = await res.json();
          if (signals && signals.length > 0) {
            signals.forEach((s: any) => {
              console.log(`[SIGNAL] Received: ${s.type}`, s.payload);
              
              // 1. Dispatch as Window Event (Most reliable for immediate processing)
              window.dispatchEvent(new CustomEvent('aura:signal', { detail: s }));
              
              // 2. Set as state (Backward compatibility, but will only be the last one in a burst)
              setEvents(s);
            });
          }
        }
      } catch (e) { /* silent fail */ }
    };

    const interval = setInterval(pollSignals, 1500);
    return () => clearInterval(interval);
  }, [profile?.uid, getAuthHeaders]);

  const sendSignal = useCallback(async (toId: string, type: string, payload: any) => {
    if (!profile?.uid) return;
    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ toId, fromId: profile.uid, type, payload })
      });
    } catch (e) { console.error('Signal failed', e); }
  }, [profile?.uid, getAuthHeaders]);

  return (
    <SignalingContext.Provider value={{ sendSignal, events }}>
      {children}
    </SignalingContext.Provider>
  );
}

export const useSignaling = () => {
  const context = useContext(SignalingContext);
  if (!context) throw new Error('useSignaling must be used within a SignalingProvider');
  return context;
};
