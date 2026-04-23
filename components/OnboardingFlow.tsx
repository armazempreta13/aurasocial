'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { doc, updateDoc, query, collection, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { Sparkles, Check, ChevronRight, User, Image as ImageIcon, Loader2, Upload, X, ArrowLeft } from 'lucide-react';
import { handleFirestoreError, OperationType } from '@/lib/firebase-errors';
import { uploadImage } from '@/lib/image-utils';
import { motion, AnimatePresence } from 'motion/react';

const INTEREST_CATEGORIES = [
  { id: 'tech', label: '💻 Tecnologia', tags: ['IA', 'Web3', 'Startups', 'Programação', 'Gadgets'] },
  { id: 'design', label: '🎨 Design', tags: ['UI/UX', 'Tipografia', 'Ilustração', '3D', 'Arquitetura'] },
  { id: 'lifestyle', label: '🌱 Lifestyle', tags: ['Viagens', 'Fitness', 'Gastronomia', 'Moda', 'Bem-estar'] },
  { id: 'entertainment', label: '🎮 Entretenimento', tags: ['Filmes', 'Games', 'Música', 'Anime', 'Livros'] },
  { id: 'business', label: '💼 Negócios', tags: ['Empreendedorismo', 'Marketing', 'Finanças', 'Liderança', 'Produtividade'] },
  { id: 'science', label: '🔬 Ciência', tags: ['Astronomia', 'Biologia', 'Física', 'Meio Ambiente', 'Medicina'] },
];

const STEPS = [
  { id: 1, label: 'Seu @', icon: User },
  { id: 2, label: 'Perfil', icon: ImageIcon },
  { id: 3, label: 'Interesses', icon: Sparkles },
];

export function OnboardingFlow() {
  const { profile, setProfile } = useAppStore();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Step 1: Username
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2: Photo + Bio
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Pre-fill username from displayName
  useEffect(() => {
    if (profile?.displayName) {
      const base = profile.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
      setUsername(base);
    }
    if (profile?.photoURL) setPhotoURL(profile.photoURL);
  }, [profile]);

  // Username availability check with debounce
  useEffect(() => {
    if (!username) { setUsernameStatus('idle'); return; }
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) { setUsernameStatus('invalid'); return; }

    setUsernameStatus('checking');
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const q = query(collection(db, 'users'), where('username', '==', clean));
        const snap = await getDocs(q);
        const isTaken = snap.docs.some(d => d.id !== profile?.uid);
        setUsernameStatus(isTaken ? 'taken' : 'available');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
    return () => { if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current); };
  }, [username, profile?.uid]);

  const handlePhotoUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadImage(file);
      setPhotoURL(result.url);
    } catch (e: any) {
      alert('Erro ao enviar foto: ' + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleInterest = (tag: string) => {
    setSelectedInterests(prev =>
      prev.includes(tag) ? prev.filter(i => i !== tag) : [...prev, tag]
    );
  };

  const goNext = () => {
    setDirection(1);
    setStep(s => Math.min(s + 1, 3) as 1 | 2 | 3);
  };

  const goBack = () => {
    setDirection(-1);
    setStep(s => Math.max(s - 1, 1) as 1 | 2 | 3);
  };

  const handleComplete = async () => {
    if (!profile || selectedInterests.length < 3) return;
    setIsSubmitting(true);
    try {
      const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      const userRef = doc(db, 'users', profile.uid);
      const updatedData = {
        username: cleanUsername,
        bio: bio.trim(),
        photoURL: photoURL || profile.photoURL || '',
        interests: selectedInterests,
        onboardingCompleted: true,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(userRef, updatedData);
      // ✅ Instant Zustand update
      useAppStore.setState(state => ({
        profile: state.profile ? { ...state.profile, ...updatedData } : state.profile
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedStep1 = usernameStatus === 'available' && username.length >= 3;
  const canProceedStep2 = true; // bio is optional
  const canComplete = selectedInterests.length >= 3;

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7fe] p-4 font-sans">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-violet-200/40 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-[520px] bg-white rounded-[32px] shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-slate-100/60 overflow-hidden relative z-10">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full"
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-6 pt-6 pb-2 px-8">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isDone = step > s.id;
            const isActive = step === s.id;
            return (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  isDone ? 'bg-green-100 text-green-600' : isActive ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-slate-100 text-slate-400'
                }`}>
                  {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-[11px] font-bold transition-colors ${isActive ? 'text-primary' : isDone ? 'text-green-600' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="px-8 pb-8 pt-4 overflow-hidden" style={{ minHeight: 420 }}>
          <AnimatePresence mode="wait" custom={direction}>
            {/* ─── STEP 1: USERNAME ─── */}
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <h2 className="text-[28px] font-extrabold text-[#2a2c5a] tracking-tight mb-1">Escolha seu @</h2>
                <p className="text-slate-500 text-[15px] mb-6">Seu handle único na Aura. Pode mudar depois.</p>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black text-lg">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="seuhandle"
                    maxLength={30}
                    className={`w-full bg-[#f2f5fd] border-2 rounded-2xl pl-10 pr-12 py-4 text-[16px] font-bold outline-none transition-all text-[#2a2c5a] placeholder-slate-400 ${
                      usernameStatus === 'available' ? 'border-green-400 bg-green-50/30' :
                      usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-red-400 bg-red-50/30' :
                      'border-transparent focus:border-primary/40'
                    }`}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {usernameStatus === 'checking' && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
                    {usernameStatus === 'available' && <Check className="w-5 h-5 text-green-500" />}
                    {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <X className="w-5 h-5 text-red-500" />}
                  </div>
                </div>
                <p className={`mt-2 text-[13px] font-semibold transition-colors ${
                  usernameStatus === 'available' ? 'text-green-600' :
                  usernameStatus === 'taken' ? 'text-red-500' :
                  usernameStatus === 'invalid' ? 'text-red-500' :
                  'text-slate-400'
                }`}>
                  {usernameStatus === 'available' ? '✓ Disponível!' :
                   usernameStatus === 'taken' ? '✗ Já está em uso. Tente outro.' :
                   usernameStatus === 'invalid' ? 'Mínimo 3 caracteres (letras, números, _)' :
                   usernameStatus === 'checking' ? 'Verificando...' :
                   'Mínimo 3 caracteres. Apenas letras, números e _'}
                </p>

                <button
                  onClick={goNext}
                  disabled={!canProceedStep1}
                  className="mt-8 w-full bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition-all shadow-[0_8px_20px_rgba(122,99,241,0.25)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continuar <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* ─── STEP 2: PHOTO + BIO ─── */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <h2 className="text-[28px] font-extrabold text-[#2a2c5a] tracking-tight mb-1">Personalize seu perfil</h2>
                <p className="text-slate-500 text-[15px] mb-6">Foto e bio são opcionais — mas fazem toda diferença.</p>

                {/* Photo upload */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-slate-100 overflow-hidden border-4 border-white shadow-md">
                      {isUploading ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100">
                          <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        </div>
                      ) : photoURL ? (
                        <img src={photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl text-slate-300">
                          {profile?.displayName?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-all"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
                  </div>
                  <div>
                    <p className="font-bold text-[#2a2c5a] text-[16px]">{profile?.displayName}</p>
                    <p className="text-slate-400 text-[13px]">@{username}</p>
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="mt-1 text-[13px] font-bold text-primary hover:underline">
                      {photoURL ? 'Trocar foto' : 'Adicionar foto'}
                    </button>
                  </div>
                </div>

                {/* Bio */}
                <div className="relative">
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value.slice(0, 160))}
                    placeholder="Conte um pouco sobre você... (opcional)"
                    rows={4}
                    className="w-full bg-[#f2f5fd] border-2 border-transparent focus:border-primary/40 rounded-2xl px-4 py-3 text-[15px] outline-none transition-all text-[#2a2c5a] placeholder-slate-400 resize-none"
                  />
                  <span className="absolute bottom-3 right-4 text-[11px] font-bold text-slate-400">{bio.length}/160</span>
                </div>

                <div className="flex gap-3 mt-8">
                  <button onClick={goBack}
                    className="flex items-center gap-1 px-5 py-3 rounded-2xl border border-slate-200 text-slate-500 font-bold text-[14px] hover:bg-slate-50 transition-all">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                  <button onClick={goNext}
                    className="flex-1 bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-bold py-3 rounded-2xl transition-all shadow-[0_8px_20px_rgba(122,99,241,0.25)] flex items-center justify-center gap-2">
                    Continuar <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── STEP 3: INTERESTS ─── */}
            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <h2 className="text-[28px] font-extrabold text-[#2a2c5a] tracking-tight mb-1">O que te interessa?</h2>
                <p className="text-slate-500 text-[15px] mb-5">Selecione pelo menos 3. Seu feed será personalizado.</p>

                <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                  {INTEREST_CATEGORIES.map(cat => (
                    <div key={cat.id}>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">{cat.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {cat.tags.map(tag => {
                          const selected = selectedInterests.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => toggleInterest(tag)}
                              className={`px-3 py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 flex items-center gap-1.5 border ${
                                selected
                                  ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20 scale-105'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary'
                              }`}
                            >
                              {selected && <Check className="w-3 h-3" />}
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={goBack}
                    className="flex items-center gap-1 px-5 py-3 rounded-2xl border border-slate-200 text-slate-500 font-bold text-[14px] hover:bg-slate-50 transition-all">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={!canComplete || isSubmitting}
                    className="flex-1 bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-bold py-3 rounded-2xl transition-all shadow-[0_8px_20px_rgba(122,99,241,0.25)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Entrar na Aura</>}
                  </button>
                </div>
                <p className="text-center text-[12px] text-slate-400 mt-3">
                  {selectedInterests.length < 3 ? `Selecione mais ${3 - selectedInterests.length} para continuar` : `${selectedInterests.length} interesses selecionados ✓`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
