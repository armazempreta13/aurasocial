'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';

type SignalingEvent = {
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

  // 1. POLLING SYNC (Reliable Internal Bridge)
  useEffect(() => {
    if (!profile?.uid) return;

    const pollSignals = async () => {
      try {
        const res = await fetch(`/api/signaling?userId=${profile.uid}`);
        if (res.ok) {
          const signals = await res.json();
          if (signals && signals.length > 0) {
            signals.forEach((s: any) => {
              console.log(`[SIGNAL] Polled: ${s.type}`, s.payload);
              setEvents(s);
            });
          }
        }
      } catch (e) { /* silent fail */ }
    };

    const interval = setInterval(pollSignals, 1500); // 1.5s is fast enough for signaling
    return () => clearInterval(interval);
  }, [profile?.uid]);

  const sendSignal = useCallback(async (toId: string, type: string, payload: any) => {
    if (!profile?.uid) return;
    try {
      await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toId, fromId: profile.uid, type, payload })
      });
    } catch (e) { console.error('Signal failed', e); }
  }, [profile?.uid]);

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
