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

  // 1. SIGNAL PROCESSOR (Centralized via SignalingProvider)
  useEffect(() => {
    if (!events || !profile?.uid) return;
    const { type, fromId, payload } = events;

    const processSignal = async () => {
        switch (type) {
            case 'request':
              if (callState === 'idle') {
                setSession({ userId: fromId, ...payload, isCaller: false });
                setCallState('receiving');
              } else {
                sendSignal(fromId, 'busy', {});
              }
              break;
            case 'busy':
              setCallState('busy');
              setTimeout(cleanup, 3000);
              break;
            case 'rejected':
              cleanup();
              break;
            case 'accepted':
              setCallState('active');
              await startWebRTC(true, fromId);
              break;
            case 'ended':
              cleanup();
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

    processSignal();
  }, [events, profile?.uid, callState, sendSignal]);

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

  const cleanup = useCallback(() => {
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    pcRef.current?.close();
    pcRef.current = null;
    setCallState('idle');
    setSession(null);
  }, [localStream]);

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
    cleanup();
  };

  const endCall = () => {
    if (!session) return;
    sendSignal(session.userId, 'ended', {});
    cleanup();
  };

  // Listen for Global UI Trigger (Optional)
  useEffect(() => {
    const handleEvent = (e: any) => initiateCall(e.detail.toId, e.detail.toName, e.detail.toPhoto, e.detail.type);
    window.addEventListener('aura-start-call', handleEvent);
    return () => window.removeEventListener('aura-start-call', handleEvent);
  }, [profile, sendSignal]);

  return { callState, session, localStream, remoteStream, acceptCall, declineCall, endCall };
}
