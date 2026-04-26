'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { db, auth } from '@/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { Check, Camera, Sparkles, ArrowRight, LogOut, Mail, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadImage } from '@/lib/image-utils';

const INTERESTS_OPTIONS = [
  'Tecnologia', 'Programação', 'Música', 'Games', 'Cinema', 
  'Culinária', 'Esportes', 'Saúde & Fitness', 'Design', 
  'Finanças', 'Viagens', 'Fotografia', 'Leitura', 'Moda',
  'Ciência', 'Negócios', 'Animais', 'Memes', 'Arte', 'Cripto'
];

export function OnboardingFlow() {
  const user = useAppStore((state) => state.user);
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);

  const [step, setStep] = useState(2); // Começa na 2 porque a 1 é o cadastro inicial feito
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Etapa 2: Identidade
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);

  // Etapa 3: Informações Básicas
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [customGender, setCustomGender] = useState('');

  // Etapa 4: OTP
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [sentOtp, setSentOtp] = useState('');
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpMethod, setOtpMethod] = useState<'email' | 'sms'>('email');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Etapa 5: Perfil
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  // Etapa 6: Interesses
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Efeito para preencher o nome vindo do Auth/Google
  useEffect(() => {
    if (profile) {
      const parts = (profile.displayName || '').split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      
      // Gerar username inicial sugerido
      if (profile.displayName) {
        const base = profile.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
        setUsername(base);
        checkUsernameAvailability(base);
      } else if (profile.email) {
        const base = profile.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        setUsername(base);
        checkUsernameAvailability(base);
      }
    }
  }, [profile]);

  // Timer do OTP
  useEffect(() => {
    if (step === 4 && otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, otpTimer]);

  // Verificar disponibilidade do username
  const checkUsernameAvailability = async (nameToCheck: string) => {
    if (!nameToCheck || nameToCheck.length < 3) {
      setIsUsernameAvailable(false);
      return;
    }
    try {
      const q = query(collection(db, 'users'), where('username', '==', nameToCheck));
      const snap = await getDocs(q);
      
      // Se for o meu próprio username atual, está liberado
      const isMine = snap.docs.some(doc => doc.id === user?.uid);
      
      if (snap.empty || isMine) {
        setIsUsernameAvailable(true);
        setUsernameSuggestions([]);
      } else {
        setIsUsernameAvailable(false);
        // Gerar sugestões
        const suggestions = [
          `${nameToCheck}_${Math.floor(Math.random() * 99)}`,
          `${nameToCheck}${Math.floor(Math.random() * 999)}`,
          `sou_${nameToCheck}`,
          `real_${nameToCheck}`
        ];
        setUsernameSuggestions(suggestions);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quando digita o username
  const handleUsernameChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    setUsername(clean);
    setError('');
    // Debounce da validação
    const timer = setTimeout(() => checkUsernameAvailability(clean), 500);
    return () => clearTimeout(timer);
  };

  // Enviar Código de Verificação Real via API do Backend
  const triggerOtp = async () => {
    setError('');
    if (!user?.uid || !profile?.email) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser?.getIdToken();
      
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profile.email, uid: user.uid, idToken })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível enviar o código.');
      }
      
      setOtpTimer(60);
      setOtpValues(['', '', '', '', '', '']);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Falha ao gerar código de verificação.');
    } finally {
      setLoading(false);
    }
  };



  // Lidar com digitação de OTP
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpValues];
    
    // Se o valor tiver mais de um dígito (pode acontecer em alguns browsers/teclados móveis),
    // pegamos apenas o último. O colar é tratado separadamente no handlePaste.
    newOtp[index] = value.slice(-1);
    setOtpValues(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newOtp = [...otpValues];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtpValues(newOtp);

    // Focar no último campo preenchido ou no próximo vazio
    const nextIndex = Math.min(pastedData.length, 5);
    otpRefs.current[nextIndex]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {

    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Lidar com upload de imagem
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Toggle de interesses
  const handleInterestToggle = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  // Avançar Etapa
  const nextStep = async () => {
    setError('');
    setLoading(true);

    try {
      if (step === 2) {
        // Validação Etapa 2
        if (!firstName.trim()) throw new Error('Nome é obrigatório.');
        if (!username.trim()) throw new Error('Nome de usuário (@handle) é obrigatório.');
        if (!isUsernameAvailable) throw new Error('Este @handle não está disponível.');
        
        // Salvar progresso incremental
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
            username: username.trim()
          });
        }
        setStep(3);
      } 
      else if (step === 3) {
        // Validação Etapa 3
        if (!birthDate) throw new Error('Data de nascimento é obrigatória.');
        
        // Validar idade (13+)
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        if (age < 13) throw new Error('A Aura é restrita a maiores de 13 anos.');

        if (user) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            birthDate,
            gender: gender === 'custom' ? customGender : gender
          });
        }
        
        // Ir para OTP
        triggerOtp();
        setStep(4);
      } 
      else if (step === 4) {
        // Validação Etapa 4 (Código OTP Real)
        const code = otpValues.join('');
        if (code.length < 6) throw new Error('Por favor, digite o código de 6 dígitos completo.');

        if (user) {
          const idToken = await auth.currentUser?.getIdToken();
          const res = await fetch('/api/otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.uid, code, idToken })
          });


          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Falha na validação do código.');
          }
        }
        setStep(5);
      }
 
      else if (step === 5) {
        // Validação Etapa 5 (Perfil)
        let photoURL = profile?.photoURL || '';
        if (avatarFile && user) {
          const uploadRes = await uploadImage(avatarFile);
          photoURL = uploadRes.url;
        }


        if (user) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            photoURL,
            bio: bio.trim()
          });
        }
        setStep(6);
      } 
      else if (step === 6) {
        // Finalizar Onboarding
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            interests: selectedInterests,
            onboardingCompleted: true,
            updatedAt: serverTimestamp()
          });
          
          // Atualizar store
          if (profile) {
            setProfile({
              ...profile,
              onboardingCompleted: true,
              interests: selectedInterests
            });
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar.');
    } finally {
      setLoading(false);
    }
  };

  // Pular etapa (se opcional)
  const skipStep = async () => {
    setError('');
    if (step === 5) {
      setStep(6);
    } else if (step === 6) {
      try {
        setLoading(true);
        if (user && profile) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { 
            onboardingCompleted: true,
            updatedAt: serverTimestamp()
          });
          setProfile({ ...profile, onboardingCompleted: true });
        }
      } catch (err: any) {
        console.error(err);
        setError('Não foi possível concluir o onboarding.');
      } finally {
        setLoading(false);
      }
    }
  };


  if (!profile || profile.onboardingCompleted) return null;

  const progressPercentage = ((step - 1) / 5) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f4f7ff] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.12),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(244,114,182,0.08),_transparent_30%)]" />

      <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/60 bg-white/95 p-8 shadow-[0_30px_80px_rgba(46,50,119,0.15)] backdrop-blur-md md:p-10">
        
        {/* Barra de Progresso */}
        <div className="relative mb-8 h-1.5 w-full rounded-full bg-[#eaeffa]">
          <motion.div 
            className="absolute top-0 left-0 h-full rounded-full bg-[#6f63dd]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Header do Onboarding */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#6f63dd]">
              Passo {step} de 6
            </span>
            <h2 className="mt-1 text-[1.6rem] font-black tracking-tight text-[#2e3277]">
              {step === 2 && 'Sua Identidade'}
              {step === 3 && 'Informações Básicas'}
              {step === 4 && 'Segurança'}
              {step === 5 && 'Seu Perfil'}
              {step === 6 && 'Personalize seu Feed'}
            </h2>
          </div>
          
          <button
            onClick={() => useAppStore.getState().setUser(null)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-500"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600 animate-in fade-in duration-300">
            {error}
          </div>
        )}

        {/* Conteúdo das Etapas */}
        <div className="min-h-[240px]">
          <AnimatePresence mode="wait">
            
            {/* Etapa 2: Identidade */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500">Nome</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1 w-full rounded-[16px] border border-[#eaeffa] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#2e3277] outline-none transition-all focus:border-[#6f63dd] focus:bg-white focus:ring-4 focus:ring-[#6f63dd]/10"
                      placeholder="Ex: João"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Sobrenome</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1 w-full rounded-[16px] border border-[#eaeffa] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#2e3277] outline-none transition-all focus:border-[#6f63dd] focus:bg-white focus:ring-4 focus:ring-[#6f63dd]/10"
                      placeholder="Ex: Silva"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500">Nome de usuário único (@handle)</label>
                  <div className="relative mt-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      className="w-full rounded-[16px] border border-[#eaeffa] bg-[#f8fbff] pl-9 pr-12 py-3 text-sm font-bold text-[#2e3277] outline-none transition-all focus:border-[#6f63dd] focus:bg-white focus:ring-4 focus:ring-[#6f63dd]/10"
                      placeholder="seunome"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {isUsernameAvailable === true && <Check className="h-5 w-5 text-emerald-500 animate-in zoom-in" />}
                      {isUsernameAvailable === false && <span className="text-xs font-bold text-red-500">Indisponível</span>}
                    </div>
                  </div>

                  {usernameSuggestions.length > 0 && (
                    <div className="mt-3 animate-in fade-in">
                      <p className="text-xs text-slate-400">Sugestões disponíveis:</p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {usernameSuggestions.map(sug => (
                          <button
                            key={sug}
                            onClick={() => { setUsername(sug); setIsUsernameAvailable(true); setUsernameSuggestions([]); }}
                            className="rounded-full bg-[#f2f5fc] px-3 py-1 text-xs font-bold text-[#6f63dd] hover:bg-[#6f63dd] hover:text-white transition"
                          >
                            @{sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Etapa 3: Informações Básicas */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <label className="text-xs font-bold text-slate-500">Data de Nascimento</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="mt-1 w-full rounded-[16px] border border-[#eaeffa] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#2e3277] outline-none transition-all focus:border-[#6f63dd] focus:bg-white focus:ring-4 focus:ring-[#6f63dd]/10"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Para garantir a segurança da comunidade, idade mínima de 13 anos.</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500">Gênero</label>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    {['Feminino', 'Masculino', 'Outro'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setGender(opt.toLowerCase())}
                        className={`rounded-[16px] border py-3 text-sm font-semibold transition-all ${
                          gender === opt.toLowerCase()
                            ? 'border-[#6f63dd] bg-[#6f63dd]/5 text-[#6f63dd] ring-2 ring-[#6f63dd]/15'
                            : 'border-[#eaeffa] bg-[#f8fbff] text-slate-600 hover:border-[#d2dbf0]'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {gender === 'outro' && (
                    <div className="mt-3 animate-in slide-in-from-top-2">
                      <input
                        type="text"
                        placeholder="Como você prefere se identificar?"
                        value={customGender}
                        onChange={(e) => setCustomGender(e.target.value)}
                        className="w-full rounded-[16px] border border-[#eaeffa] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#2e3277] outline-none transition-all focus:border-[#6f63dd] focus:bg-white focus:ring-4 focus:ring-[#6f63dd]/10"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Etapa 4: Segurança (OTP) */}
            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 text-center"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#6f63dd]/10 text-[#6f63dd]">
                  <Mail className="h-7 w-7" />
                </div>
                
                <div>
                  <p className="text-base font-bold text-slate-700">
                    Digite o código de verificação
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Enviamos um código de 6 dígitos para:
                  </p>
                  <p className="text-sm font-black text-[#6f63dd] mt-0.5">
                    {profile?.email}
                  </p>
                </div>

                {/* Inputs do Código OTP */}
                <div className="flex justify-center gap-2 my-6">
                  {otpValues.map((val, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                      value={val}
                      maxLength={1}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handlePaste}
                      className="h-12 w-10 text-center text-xl font-bold rounded-[12px] border border-[#eaeffa] bg-[#f8fbff] outline-none transition-all focus:border-[#6f63dd] focus:bg-white focus:ring-4 focus:ring-[#6f63dd]/10 text-[#2e3277]"
                    />

                  ))}
                </div>

                <div>
                  {otpTimer > 0 ? (
                    <p className="text-xs text-slate-400">Aguarde {otpTimer}s para reenviar o código</p>
                  ) : (
                    <button
                      onClick={triggerOtp}
                      className="text-xs font-bold text-[#6f63dd] hover:underline"
                    >
                      Não recebeu? Reenviar código
                    </button>
                  )}
                </div>
              </motion.div>
            )}





            {/* Etapa 5: Perfil */}
            {step === 5 && (
              <motion.div
                key="step-5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="group relative h-24 w-24 overflow-hidden rounded-full bg-[#f2f5fc] shadow-inner border-2 border-[#eaeffa]">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : profile?.photoURL ? (
                      <img src={profile.photoURL} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <Sparkles className="h-8 w-8" />
                      </div>
                    )}
                    
                    <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Camera className="h-6 w-6 text-white" />
                      <span className="text-[10px] font-bold text-white mt-1">Alterar</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-400">Foto de perfil (Opcional)</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500">Sua Biografia (Opcional)</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Conte um pouco sobre você..."
                    className="mt-1 w-full resize-none rounded-[16px] border border-[#eaeffa] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#2e3277] outline-none transition-all focus:border-[#6f63dd] focus:bg-white focus:ring-4 focus:ring-[#6f63dd]/10"
                    maxLength={160}
                  />
                  <div className="text-right text-[11px] text-slate-400">
                    {bio.length}/160
                  </div>
                </div>
              </motion.div>
            )}

            {/* Etapa 6: Interesses */}
            {step === 6 && (
              <motion.div
                key="step-6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-center text-sm font-medium text-slate-600">
                  Escolha pelo menos 3 tópicos para começar a povoar seu feed com o que você gosta.
                </p>

                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {INTERESTS_OPTIONS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        onClick={() => handleInterestToggle(interest)}
                        className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-[#6f63dd] text-white shadow-[0_4px_12px_rgba(111,99,221,0.3)]'
                            : 'bg-[#f2f5fc] text-slate-600 hover:bg-[#eaeffa]'
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Ações do Rodapé */}
        <div className="mt-8 flex items-center justify-between border-t border-[#eaeffa] pt-6">
          {/* Opção de Pular (Etapas 5 e 6) */}
          {(step === 5 || step === 6) ? (
            <button
              onClick={skipStep}
              disabled={loading}
              className="text-sm font-bold text-slate-400 hover:text-slate-600 disabled:opacity-50"
            >
              Pular esta etapa
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={nextStep}
            disabled={loading || (step === 2 && !isUsernameAvailable)}
            className="flex items-center gap-2 rounded-2xl bg-[#6f63dd] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(111,99,221,0.25)] transition-all hover:bg-[#5e53cd] hover:shadow-[0_12px_28px_rgba(111,99,221,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                {step === 6 ? 'Concluir' : 'Avançar'}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
