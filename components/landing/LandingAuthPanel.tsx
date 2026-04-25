'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { auth, db } from '@/firebase';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  getRedirectResult,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LandingAuthMode } from '@/components/LandingPage';

function getAuthErrorMessage(
  error: any,
  t: (key: string, defaultValue: string) => string
) {
  const code = error?.code || '';

  switch (code) {
    case 'auth/invalid-email':
      return t('login.invalid_email', 'Use um e-mail válido.');
    case 'auth/missing-password':
      return t('login.missing_password', 'Digite sua senha.');
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return t('login.invalid', 'E-mail ou senha incorretos.');
    case 'auth/email-already-in-use':
      return t('login.in_use', 'Este e-mail já está em uso.');
    case 'auth/weak-password':
      return t('login.weak', 'Use uma senha com pelo menos 6 caracteres.');
    case 'auth/popup-closed-by-user':
      return t('login.google_closed', 'O login com Google foi fechado antes de terminar.');
    case 'auth/too-many-requests':
      return t('login.too_many', 'Muitas tentativas. Tente novamente em alguns minutos.');
    case 'auth/unauthorized-domain':
      return t(
        'login.unauthorized_domain',
        'Este domínio ainda não está autorizado no Firebase. Adicione o domínio atual aos domínios autorizados no console do Firebase.'
      );
    case 'auth/operation-not-allowed':
      return t(
        'login.not_allowed',
        'Este método de login não está ativado no Firebase Console. Ative E-mail/Senha e Google.'
      );
    default:
      return t('login.generic_error', 'Não foi possível autenticar agora.');
  }
}

type LandingAuthPanelProps = {
  requestedMode?: LandingAuthMode;
  focusNonce?: number;
};

export function LandingAuthPanel({
  requestedMode = 'login',
  focusNonce = 0,
}: LandingAuthPanelProps) {
  const { t } = useTranslation('common');
  const [mode, setMode] = useState<LandingAuthMode>(requestedMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const primaryLabel = useMemo(
    () => (mode === 'login' ? t('login.tab_login', 'Entrar') : t('login.tab_create', 'Criar conta')),
    [mode, t]
  );

  useEffect(() => {
    setMode(requestedMode);
    setError('');
    setInfo('');

    getRedirectResult(auth).catch((err) => {
      console.error('Erro ao processar retorno do Google Redirect:', err);
      setError(getAuthErrorMessage(err, t));
    });
  }, [requestedMode, t]);

  useEffect(() => {
    if (focusNonce === 0) return;

    setMode(requestedMode);
    setError('');
    setInfo('');
    setIsHighlighted(true);

    const highlightTimer = window.setTimeout(() => setIsHighlighted(false), 1500);
    requestAnimationFrame(() => {
      const focusTarget =
        requestedMode === 'signup'
          ? nameInputRef.current ?? emailInputRef.current
          : emailInputRef.current;
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      focusTarget?.focus();
    });

    return () => window.clearTimeout(highlightTimer);
  }, [focusNonce, requestedMode]);

  const switchMode = (nextMode: LandingAuthMode) => {
    setMode(nextMode);
    setError('');
    setInfo('');
    requestAnimationFrame(() => {
      const focusTarget =
        nextMode === 'signup'
          ? nameInputRef.current ?? emailInputRef.current
          : emailInputRef.current;
      focusTarget?.focus();
    });
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError('');
    setInfo('');
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
        }

        await setDoc(
          doc(db, 'users', credential.user.uid),
          {
            uid: credential.user.uid,
            email: credential.user.email || email.trim(),
            displayName: name.trim() || credential.user.displayName || '',
            photoURL: credential.user.photoURL || '',
            onboardingCompleted: false,
            updatedAt: serverTimestamp(),

          },
          { merge: true }
        );
      }
    } catch (err: any) {
      console.error('Erro detalhado de autenticação:', err);
      setError(getAuthErrorMessage(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;

    setError('');
    setInfo('');
    setIsSubmitting(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Erro no login com Google:', err);
      setError(getAuthErrorMessage(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (isSubmitting) return;

    if (!email.trim()) {
      setError(t('login.reset_needs_email', 'Digite seu e-mail para recuperar a senha.'));
      setInfo('');
      emailInputRef.current?.focus();
      return;
    }

    setError('');
    setInfo('');
    setIsSubmitting(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo(t('login.reset_sent', 'Enviamos um e-mail para redefinir sua senha.'));
    } catch (err: any) {
      setError(getAuthErrorMessage(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="auth-panel" className="mx-auto w-full max-w-[460px]">
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`flex h-[640px] w-full flex-col justify-between rounded-[32px] border bg-white/95 px-7 py-8 shadow-[0_20px_60px_rgba(111,99,221,0.12)] backdrop-blur-md transition-all duration-300 ${
          isHighlighted
            ? 'border-[#6f63dd] shadow-[0_24px_70px_rgba(111,99,221,0.22)] ring-4 ring-[#6f63dd]/15'
            : 'border-[#eaeffa]'
        }`}
      >
        <div className="mb-4">
          <div className="flex gap-2 rounded-full bg-[#f2f5fc] p-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => switchMode('login')}
              aria-pressed={mode === 'login'}
              className={`flex-1 rounded-full px-4 py-3 text-[15px] font-bold transition-all duration-300 ${
                mode === 'login'
                  ? 'bg-white text-[#2e3277] shadow-[0_4px_12px_rgba(0,0,0,0.06)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('login.tab_login', 'Entrar')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              aria-pressed={mode === 'signup'}
              className={`flex-1 rounded-full px-4 py-3 text-[15px] font-bold transition-all duration-300 ${
                mode === 'signup'
                  ? 'bg-white text-[#2e3277] shadow-[0_4px_12px_rgba(0,0,0,0.06)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('login.tab_create', 'Criar conta')}
            </button>
          </div>

          <div className="mt-6 flex min-h-[90px] flex-col justify-center">
            <h2 className="text-center text-[1.85rem] font-black leading-tight tracking-[-0.05em] text-[#2e3277]">
              {mode === 'login'
                ? t('login.title_login', 'Entrar na Aura')
                : t('login.title_create', 'Criar sua conta')}
            </h2>
            <p className="mt-2 min-h-[44px] px-2 text-center text-[14px] leading-relaxed text-slate-500">
              {mode === 'login'
                ? t('login.subtitle_login', 'Entre para continuar no feed, nas comunidades e nas conexões relevantes.')
                : t('login.subtitle_create', 'Comece grátis e descubra uma rede social mais elegante, organizada e útil.')}
            </p>
          </div>
        </div>

        {error ? (
          <div className="absolute left-0 top-0 w-full -translate-y-[120%] rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
            {error}
          </div>
        ) : null}

        {info ? (
          <div className="absolute left-0 top-0 w-full -translate-y-[120%] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-lg">
            {info}
          </div>
        ) : null}

        <form onSubmit={handleEmailAuth} className="mt-1 flex flex-1 flex-col">
          <div className="flex min-h-[210px] flex-1 flex-col justify-end space-y-3">
            {mode === 'signup' ? (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <input
                  ref={nameInputRef}
                  type="text"
                  autoComplete="name"
                  placeholder={t('login.name_placeholder', 'Seu nome')}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-[18px] border-2 border-transparent bg-[#f4f7fc] px-5 py-3.5 text-[14px] font-medium text-[#2e3277] outline-none transition-all placeholder:text-slate-400 focus:border-[#6f63dd] focus:bg-white focus:ring-4 focus:ring-[#6f63dd]/10"
                  required
                />
              </div>
            ) : null}

            <input
              ref={emailInputRef}
              type="email"
              autoComplete="email"
              placeholder={t('login.email_placeholder', 'E-mail')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-[18px] border-2 border-transparent bg-[#f4f7fc] px-5 py-3.5 text-[14px] font-medium text-[#2e3277] outline-none transition-all placeholder:text-slate-400 focus:border-[#6f63dd] focus:bg-white focus:ring-4 focus:ring-[#6f63dd]/10"
              required
            />

            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={t('login.password_placeholder', 'Senha')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-[18px] border-2 border-transparent bg-[#f4f7fc] px-5 py-3.5 text-[14px] font-medium text-[#2e3277] outline-none transition-all placeholder:text-slate-400 focus:border-[#6f63dd] focus:bg-white focus:ring-4 focus:ring-[#6f63dd]/10"
              required
            />
          </div>

          <div className="mt-5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="group flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#6f63dd] px-4 py-3.5 text-[15px] font-bold text-white shadow-[0_6px_20px_rgba(111,99,221,0.25)] transition-all hover:bg-[#5e53cd] hover:shadow-[0_10px_24px_rgba(111,99,221,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {isSubmitting ? t('login.waiting', 'Aguarde...') : primaryLabel}
            </button>
          </div>
        </form>

        <div className="mt-auto pt-4">
          <div className="flex h-[21px] items-center justify-center">
            {mode === 'login' && (
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isSubmitting}
                className="w-full text-center text-[14px] font-bold text-[#6f63dd] transition-colors hover:text-[#5e53cd] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {t('login.forgot', 'Esqueceu a senha?')}
              </button>
            )}
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#eaeffa]" />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-[18px] border-2 border-[#eaeffa] bg-white px-4 py-3.5 text-[15px] font-bold text-[#2e3277] transition-all hover:border-[#d2dbf0] hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {t('login.google_continue', 'Continuar com Google')}
          </button>

          <p className="mt-4 text-center text-[12px] leading-relaxed text-slate-400">
            {t('login.google_desc', 'Acesso rápido, criação de conta simples e login com Google em um clique.')}
          </p>
        </div>
      </div>
    </div>
  );
}
