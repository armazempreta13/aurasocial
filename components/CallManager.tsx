'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, PhoneIncoming } from 'lucide-react';

// Free public STUN servers — NO third-party dependency
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';
type CallMode  = 'audio' | 'video';

interface CallInfo {
  remoteUserId: string;
  remoteUserName: string;
  remoteUserPhoto?: string;
  mode: CallMode;
}

// ─── Singleton polling ref (prevent multiple intervals) ──────────────────────
let pollingInterval: ReturnType<typeof setInterval> | null = null;

// ─── Component ───────────────────────────────────────────────────────────────
export function CallManager() {
  const profile = useAppStore((s) => s.profile);

  const [callState, setCallState]     = useState<CallState>('idle');
  const [callInfo, setCallInfo]       = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted]         = useState(false);
  const [isCamOff, setIsCamOff]       = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef         = useRef<RTCPeerConnection | null>(null);
  const localStream   = useRef<MediaStream | null>(null);
  const remoteStream  = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOffer  = useRef<RTCSessionDescriptionInit | null>(null);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const sendWebRTCSignal = useCallback(async (toId: string, type: string, payload: any) => {
    if (!profile?.uid) return;
    await fetch('/api/webrtc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId, fromId: profile.uid, type, payload }),
    });
  }, [profile?.uid]);

  const cleanUp = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    remoteStream.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (durationTimer.current) clearInterval(durationTimer.current);
    setCallState('idle');
    setCallInfo(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsCamOff(false);
    pendingOffer.current = null;
  }, []);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && callInfo?.remoteUserId) {
        sendWebRTCSignal(callInfo.remoteUserId, 'ice-candidate', { candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      remoteStream.current = e.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        durationTimer.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanUp();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [callInfo?.remoteUserId, sendWebRTCSignal, cleanUp]);

  // ─── Start a Call ──────────────────────────────────────────────────────────

  const startCall = useCallback(async (
    remoteUserId: string,
    remoteUserName: string,
    mode: CallMode,
    remoteUserPhoto?: string
  ) => {
    if (!profile?.uid || callState !== 'idle') return;

    setCallInfo({ remoteUserId, remoteUserName, mode, remoteUserPhoto });
    setCallState('calling');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video',
      });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPC();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendWebRTCSignal(remoteUserId, 'call-offer', {
        offer,
        mode,
        callerName: profile.displayName,
        callerPhoto: profile.photoURL,
      });
    } catch (e) {
      console.error('[WebRTC] Start call error:', e);
      cleanUp();
    }
  }, [profile, callState, createPC, sendWebRTCSignal, cleanUp]);

  // ─── Answer a Call ─────────────────────────────────────────────────────────

  const answerCall = useCallback(async () => {
    if (!callInfo || !pendingOffer.current || !profile?.uid) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callInfo.mode === 'video',
      });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPC();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendWebRTCSignal(callInfo.remoteUserId, 'call-answer', { answer });
    } catch (e) {
      console.error('[WebRTC] Answer error:', e);
      cleanUp();
    }
  }, [callInfo, profile, createPC, sendWebRTCSignal, cleanUp]);

  // ─── Reject / Hang Up ──────────────────────────────────────────────────────

  const rejectCall = useCallback(async () => {
    if (callInfo) await sendWebRTCSignal(callInfo.remoteUserId, 'call-reject', {});
    cleanUp();
  }, [callInfo, sendWebRTCSignal, cleanUp]);

  const hangUp = useCallback(async () => {
    if (callInfo) await sendWebRTCSignal(callInfo.remoteUserId, 'call-hang-up', {});
    cleanUp();
  }, [callInfo, sendWebRTCSignal, cleanUp]);

  // ─── Toggle Controls ───────────────────────────────────────────────────────

  const toggleMute = () => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const toggleCamera = () => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCamOff(v => !v);
  };

  // ─── Incoming Signal Polling ───────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.uid) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/webrtc?userId=${profile.uid}`);
        const signals = await res.json();

        for (const signal of signals) {
          const { type, fromId, payload } = signal;

          if (type === 'call-offer' && callState === 'idle') {
            pendingOffer.current = payload.offer;
            setCallState('incoming');
            setCallInfo({
              remoteUserId: fromId,
              remoteUserName: payload.callerName || 'Usuário',
              remoteUserPhoto: payload.callerPhoto,
              mode: payload.mode || 'audio',
            });
          }

          if (type === 'call-answer' && pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
          }

          if (type === 'ice-candidate' && pcRef.current && payload.candidate) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch {}
          }

          if (type === 'call-reject' || type === 'call-hang-up') {
            cleanUp();
          }
        }
      } catch {}
    };

    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(poll, 1200); // Poll every 1.2s for snappy response

    return () => {
      if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
    };
  }, [profile?.uid, callState, cleanUp]);

  // Make startCall available globally so messages page can call it
  useEffect(() => {
    (window as any).__auraStartCall = startCall;
    return () => { delete (window as any).__auraStartCall; };
  }, [startCall]);

  // ─── Format Duration ───────────────────────────────────────────────────────
  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (callState === 'idle') return null;

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-md mx-4 bg-[#0f0f12] rounded-[40px] overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.8)] border border-white/5">

        {/* Video backgrounds */}
        {callInfo?.mode === 'video' && (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-90"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-28 right-6 w-32 h-44 object-cover rounded-[20px] border-2 border-white/20 shadow-xl z-10"
            />
          </>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 p-10 flex flex-col items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            <img
              src={callInfo?.remoteUserPhoto || `https://ui-avatars.com/api/?name=${callInfo?.remoteUserName}&size=120&background=1d4ed8&color=fff`}
              alt=""
              className={`w-28 h-28 rounded-full object-cover border-4 border-white/10 ${callState === 'calling' || callState === 'incoming' ? 'animate-pulse' : ''}`}
            />
            {callInfo?.mode === 'video' ? (
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full border-2 border-[#0f0f12] flex items-center justify-center">
                <Video size={14} className="text-white" />
              </div>
            ) : (
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 rounded-full border-2 border-[#0f0f12] flex items-center justify-center">
                <Phone size={14} className="text-white" />
              </div>
            )}
          </div>

          {/* Name & Status */}
          <div className="text-center">
            <h2 className="text-2xl font-black text-white tracking-tight">{callInfo?.remoteUserName}</h2>
            <p className="text-sm font-semibold text-white/50 mt-1 uppercase tracking-widest">
              {callState === 'calling' && 'Chamando...'}
              {callState === 'incoming' && `${callInfo?.mode === 'video' ? 'Chamada de vídeo' : 'Chamada de áudio'} recebida`}
              {callState === 'connected' && formatDuration(callDuration)}
              {callState === 'ended' && 'Chamada encerrada'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-5 mt-4">
            {/* INCOMING */}
            {callState === 'incoming' && (
              <>
                <button onClick={rejectCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl shadow-red-500/30 transition-all active:scale-95">
                  <PhoneOff size={26} className="text-white" />
                </button>
                <button onClick={answerCall} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-xl shadow-green-500/30 transition-all active:scale-95 animate-bounce">
                  <Phone size={26} className="text-white" />
                </button>
              </>
            )}

            {/* CALLING / CONNECTED */}
            {(callState === 'calling' || callState === 'connected') && (
              <>
                <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                {callInfo?.mode === 'video' && (
                  <button onClick={toggleCamera} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${isCamOff ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {isCamOff ? <VideoOff size={22} /> : <Video size={22} />}
                  </button>
                )}

                <button onClick={hangUp} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl shadow-red-500/30 transition-all active:scale-95">
                  <PhoneOff size={26} className="text-white" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Audio element for non-video calls */}
        {callInfo?.mode === 'audio' && (
          <audio ref={remoteVideoRef as any} autoPlay playsInline className="hidden" />
        )}
      </div>
    </div>
  );
}
