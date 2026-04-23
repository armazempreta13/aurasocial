'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { useSignaling } from '@/components/SignalingProvider';

type CallState = 'idle' | 'calling' | 'receiving' | 'active' | 'busy' | 'ended';

interface CallSession {
  userId: string;
  name: string;
  photo?: string;
  type: 'audio' | 'video';
  isCaller: boolean;
}

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export function useCall() {
  const profile = useAppStore((state) => state.profile);
  const { sendSignal, events } = useSignaling();
  
  const [callState, setCallState] = useState<CallState>('idle');
  const [session, setSession] = useState<CallSession | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup function definition
  const cleanup = useCallback(() => {
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    pcRef.current?.close();
    pcRef.current = null;
    setCallState('idle');
    setSession(null);
  }, [localStream]);

  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup]);

  // 1. SIGNAL PROCESSOR (Centralized via SignalingProvider)
  const callStateRef = useRef(callState);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // 1. SIGNAL PROCESSOR (Centralized via SignalingProvider)
  useEffect(() => {
    if (!profile?.uid) return;

    const onSignal = async (e: Event) => {
        const signal = (e as CustomEvent).detail;
        const { type, fromId, payload } = signal;

        switch (type) {
            case 'request':
              if (callStateRef.current === 'idle') {
                setSession({ userId: fromId, ...payload, isCaller: false });
                setCallState('receiving');
              } else {
                sendSignal(fromId, 'busy', {});
              }
              break;
            case 'busy':
              setCallState('busy');
              setTimeout(() => cleanupRef.current?.(), 3000);
              break;
            case 'rejected':
              cleanupRef.current?.();
              break;
            case 'accepted':
              setCallState('active');
              await startWebRTC(true, fromId);
              break;
            case 'ended':
              cleanupRef.current?.();
              break;
            case 'webrtc-offer':
              await handleOffer(payload, fromId);
              break;
            case 'webrtc-answer':
              await handleAnswer(payload);
              break;
            case 'webrtc-ice':
              await handleIce(payload);
              break;
          }
    };

    window.addEventListener('aura:signal', onSignal);
    return () => window.removeEventListener('aura:signal', onSignal);
  }, [profile?.uid, sendSignal]);

  // 2. WebRTC Logic (Internal)
  const startWebRTC = async (isCaller: boolean, targetId: string) => {
    if (pcRef.current) return;
    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: session?.type === 'video'
      });
      setLocalStream(stream);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
    } catch (e) {
      console.error('Media Access Denied', e);
      setCallState('idle');
      return;
    }

    pc.ontrack = (e) => setRemoteStream(e.streams[0]);
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(targetId, 'webrtc-ice', e.candidate);
    };

    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(targetId, 'webrtc-offer', offer);
    }
  };

  const handleOffer = async (offer: any, fromId: string) => {
    await startWebRTC(false, fromId);
    if (!pcRef.current) return;
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);
    sendSignal(fromId, 'webrtc-answer', answer);
  };

  const handleAnswer = async (answer: any) => {
    if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleIce = async (candidate: any) => {
    if (pcRef.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  };

  // 3. EXPORTED ACTIONS
  const initiateCall = (toId: string, toName: string, toPhoto: string, type: 'audio' | 'video') => {
    setSession({ userId: toId, name: toName, photo: toPhoto, type, isCaller: true });
    setCallState('calling');
    sendSignal(toId, 'request', { name: profile?.displayName, photo: profile?.photoURL, type });
  };

  const acceptCall = () => {
    if (!session) return;
    sendSignal(session.userId, 'accepted', {});
    setCallState('active');
    startWebRTC(false, session.userId);
  };

  const declineCall = () => {
    if (!session) return;
    sendSignal(session.userId, 'rejected', {});
    cleanupRef.current?.();
  };

  const endCall = () => {
    if (!session) return;
    sendSignal(session.userId, 'ended', {});
    cleanupRef.current?.();
  };

  // Listen for Global UI Trigger (Optional)
  useEffect(() => {
    const handleEvent = (e: any) => initiateCall(e.detail.toId, e.detail.toName, e.detail.toPhoto, e.detail.type);
    window.addEventListener('aura-start-call', handleEvent);
    return () => window.removeEventListener('aura-start-call', handleEvent);
  }, [profile, sendSignal]);

  return { callState, session, localStream, remoteStream, acceptCall, declineCall, endCall };
}
