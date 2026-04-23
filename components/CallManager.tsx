'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { auth } from '@/firebase';

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

export function CallManager() {
  const profile = useAppStore((s) => s.profile);

  const [callState, setCallState]       = useState<CallState>('idle');
  const [callInfo, setCallInfo]         = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted]           = useState(false);
  const [isCamOff, setIsCamOff]         = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Refs espelham estado para usar dentro de callbacks/intervals sem stale closure
  const callStateRef  = useRef<CallState>('idle');
  const callInfoRef   = useRef<CallInfo | null>(null);

  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStream    = useRef<MediaStream | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  // Ref separado para o elemento de áudio — não reutilizar remoteVideoRef
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const durationTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOffer   = useRef<RTCSessionDescriptionInit | null>(null);
  // Fila de ICE candidates que chegaram antes do setRemoteDescription
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);

  // Sincroniza refs com estado
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callInfoRef.current = callInfo; }, [callInfo]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  const sendSignal = useCallback(async (toId: string, type: string, payload: unknown) => {
    const currentUid = profileRef.current?.uid;
    if (!currentUid) return;
    const token = await auth.currentUser?.getIdToken();
    await fetch('/api/webrtc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ toId, fromId: currentUid, type, payload })
    });
  }, []); // Only needs stable fetch/JSON

  const cleanUp = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    if (localVideoRef.current)  localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (durationTimer.current)  clearInterval(durationTimer.current);
    iceCandidateQueue.current = [];
    pendingOffer.current = null;
    setCallState('idle');
    setCallInfo(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsCamOff(false);
  }, []);

  // createPC recebe remoteUserId como parâmetro — não depende de callInfo no closure,
  // evitando o bug onde callInfo ainda é null quando onicecandidate dispara
  const createPC = useCallback((remoteUserId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(remoteUserId, 'ice-candidate', { candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      // Conecta no elemento correto dependendo do modo atual
      const mode = callInfoRef.current?.mode;
      if (mode === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      } else if (mode === 'audio' && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
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
  }, [sendSignal, cleanUp]);

  // Drena a fila de ICE candidates após setRemoteDescription
  const drainIceCandidateQueue = useCallback(async () => {
    if (!pcRef.current || iceCandidateQueue.current.length === 0) return;
    for (const candidate of iceCandidateQueue.current) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    }
    iceCandidateQueue.current = [];
  }, []);

  // ─── Start a Call ──────────────────────────────────────────────────────────

  const startCall = useCallback(async (
    remoteUserId: string,
    remoteUserName: string,
    mode: CallMode,
    remoteUserPhoto?: string,
  ) => {
    if (!profile?.uid || callStateRef.current !== 'idle') return;

    const info: CallInfo = { remoteUserId, remoteUserName, mode, remoteUserPhoto };
    setCallInfo(info);
    callInfoRef.current = info; // sincroniza ref imediatamente
    setCallState('calling');
    callStateRef.current = 'calling';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video',
      }).catch(async (error) => {
        // Se video falhar, tenta só áudio
        if (mode === 'video' && error.name === 'NotFoundError') {
          console.warn('[WebRTC] Câmera não encontrada, usando apenas áudio');
          return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
        throw error;
      });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Passa remoteUserId diretamente — não depende de callInfo state
      const pc = createPC(remoteUserId);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal(remoteUserId, 'call-offer', {
        offer,
        mode,
        callerName: profileRef.current?.displayName || 'Usuário',
        callerPhoto: profileRef.current?.photoURL,
      });
    } catch (e) {
      console.error('[WebRTC] startCall error:', e);
      if (e instanceof Error) {
        if (e.name === 'NotFoundError') {
          console.error('[WebRTC] Dispositivo não encontrado - verifique se câmera/microfone estão conectados');
        } else if (e.name === 'PermissionDenied') {
          console.error('[WebRTC] Permissão negada para acessar câmera/microfone');
        } else if (e.name === 'NotAllowedError') {
          console.error('[WebRTC] Acesso não permitido - dispositivo pode estar em uso');
        }
      }
      cleanUp();
    }
  }, [createPC, sendSignal, cleanUp]);

  // ─── Answer a Call ─────────────────────────────────────────────────────────

  const answerCall = useCallback(async () => {
    const info = callInfoRef.current;
    if (!info || !pendingOffer.current || !profileRef.current?.uid) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: info.mode === 'video',
      }).catch(async (error) => {
        // Se video falhar, tenta só áudio
        if (info.mode === 'video' && error.name === 'NotFoundError') {
          console.warn('[WebRTC] Câmera não encontrada, usando apenas áudio');
          return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
        throw error;
      });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPC(info.remoteUserId);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
      // Drena candidatos que chegaram antes do answer
      await drainIceCandidateQueue();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal(info.remoteUserId, 'call-answer', { answer });
    } catch (e) {
      console.error('[WebRTC] answerCall error:', e);
      cleanUp();
    }
  }, [createPC, sendSignal, drainIceCandidateQueue, cleanUp]);

  // ─── Reject / Hang Up ──────────────────────────────────────────────────────

  const rejectCall = useCallback(async () => {
    const info = callInfoRef.current;
    if (info) await sendSignal(info.remoteUserId, 'call-reject', {});
    cleanUp();
  }, [sendSignal, cleanUp]);

  const hangUp = useCallback(async () => {
    const info = callInfoRef.current;
    if (info) await sendSignal(info.remoteUserId, 'call-hang-up', {});
    cleanUp();
  }, [sendSignal, cleanUp]);

  // ─── Toggle Controls ───────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCamOff(v => !v);
  }, []);

  // ─── Polling de sinais ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.uid) return;

    const poll = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/webrtc?userId=${profile.uid}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const signals: { type: string; fromId: string; payload: any }[] = await res.json();

        for (const { type, fromId, payload } of signals) {

          if (type === 'call-offer' && callStateRef.current === 'idle') {
            pendingOffer.current = payload.offer;
            const info: CallInfo = {
              remoteUserId:   fromId,
              remoteUserName: payload.callerName || 'Usuário',
              remoteUserPhoto: payload.callerPhoto,
              mode: payload.mode || 'audio',
            };
            setCallInfo(info);
            callInfoRef.current = info;
            setCallState('incoming');
            callStateRef.current = 'incoming';
          }

          if (type === 'call-answer' && pcRef.current) {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription(payload.answer)
            );
            // Drena candidatos que chegaram antes do answer
            await drainIceCandidateQueue();
          }

          if (type === 'ice-candidate' && payload.candidate) {
            if (pcRef.current?.remoteDescription) {
              // Remote description já foi setada — adiciona direto
              try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } catch {}
            } else {
              // Ainda não tem remote description — enfileira para depois
              iceCandidateQueue.current.push(payload.candidate);
            }
          }

          if (type === 'call-reject' || type === 'call-hang-up') {
            cleanUp();
          }
        }
      } catch {
        // Mantém polling mesmo em falha de rede
      }
    };

    pollRef.current = setInterval(poll, 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [profile?.uid, cleanUp, drainIceCandidateQueue]);

  // Expõe startCall via store (não via window) — adicione setStartCall ao seu store
  useEffect(() => {
    useAppStore.getState().setStartCall?.(startCall);
    return () => { useAppStore.getState().setStartCall?.(null); };
  }, [startCall]);

  // ─── Utils ─────────────────────────────────────────────────────────────────

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (callState === 'idle') return null;

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-md mx-4 bg-[#0f0f12] rounded-[40px] overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.8)] border border-white/5">

        {/* Vídeo remoto — só renderiza em modo vídeo */}
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

        {/* Elemento de áudio dedicado — separado do video ref */}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

        {/* Conteúdo */}
        <div className="relative z-10 p-10 flex flex-col items-center gap-6">

          {/* Avatar */}
          <div className="relative">
            <img
              src={
                callInfo?.remoteUserPhoto ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(callInfo?.remoteUserName ?? 'U')}&size=120&background=1d4ed8&color=fff`
              }
              alt={callInfo?.remoteUserName}
              className={`w-28 h-28 rounded-full object-cover border-4 border-white/10 ${
                callState === 'calling' || callState === 'incoming' ? 'animate-pulse' : ''
              }`}
            />
            <div className={`absolute bottom-0 right-0 w-8 h-8 rounded-full border-2 border-[#0f0f12] flex items-center justify-center ${
              callInfo?.mode === 'video' ? 'bg-blue-600' : 'bg-green-500'
            }`}>
              {callInfo?.mode === 'video'
                ? <Video size={14} className="text-white" />
                : <Phone size={14} className="text-white" />
              }
            </div>
          </div>

          {/* Nome e status */}
          <div className="text-center">
            <h2 className="text-2xl font-black text-white tracking-tight">
              {callInfo?.remoteUserName}
            </h2>
            <p className="text-sm font-semibold text-white/50 mt-1 uppercase tracking-widest">
              {callState === 'calling'   && 'Chamando...'}
              {callState === 'incoming'  && `${callInfo?.mode === 'video' ? 'Chamada de vídeo' : 'Chamada de áudio'} recebida`}
              {callState === 'connected' && formatDuration(callDuration)}
              {callState === 'ended'     && 'Chamada encerrada'}
            </p>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-5 mt-4">

            {/* Recebendo */}
            {callState === 'incoming' && (
              <>
                <button
                  onClick={rejectCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl shadow-red-500/30 transition-all active:scale-95"
                  aria-label="Recusar chamada"
                >
                  <PhoneOff size={26} className="text-white" />
                </button>
                <button
                  onClick={answerCall}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-xl shadow-green-500/30 transition-all active:scale-95 animate-bounce"
                  aria-label="Atender chamada"
                >
                  <Phone size={26} className="text-white" />
                </button>
              </>
            )}

            {/* Chamando / Conectado */}
            {(callState === 'calling' || callState === 'connected') && (
              <>
                <button
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Ativar microfone' : 'Silenciar microfone'}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                    isMuted
                      ? 'bg-red-500/20 text-red-400 border border-red-500/20'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                {callInfo?.mode === 'video' && (
                  <button
                    onClick={toggleCamera}
                    aria-label={isCamOff ? 'Ativar câmera' : 'Desativar câmera'}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                      isCamOff
                        ? 'bg-red-500/20 text-red-400 border border-red-500/20'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {isCamOff ? <VideoOff size={22} /> : <Video size={22} />}
                  </button>
                )}

                <button
                  onClick={hangUp}
                  aria-label="Encerrar chamada"
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl shadow-red-500/30 transition-all active:scale-95"
                >
                  <PhoneOff size={26} className="text-white" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
