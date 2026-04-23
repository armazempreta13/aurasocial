'use client';

import { useState } from 'react';
import { auth } from '@/firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useTranslation } from 'react-i18next';

export function Login() {
  const { t } = useTranslation('common');
  const [isLogin, setIsLogin] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError(t('login.in_use', 'Este e-mail já está em uso.'));
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError(t('login.invalid', 'E-mail ou senha inválidos.'));
      } else if (err.code === 'auth/weak-password') {
        setError(t('login.weak', 'A senha deve ter pelo menos 6 caracteres.'));
      } else if (err.code === 'auth/operation-not-allowed') {
        setError(t('login.not_allowed', 'Este método de login não está ativado no Console do Firebase. Ative E-mail/Senha e Google.'));
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const provider = new GoogleAuthProvider();
      // Using signInWithPopup because it's often more reliable in web views and doesn't require session handling for redirect results.
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Login Error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(t('login.domain_error', 'Este domínio não está autorizado no console do Firebase. Adicione o domínio atual aos domínios autorizados no Console do Firebase (Authentication > Settings).'));
      } else if (err.code === 'auth/operation-not-allowed') {
        setError(t('login.not_allowed', 'O login com Google não está ativado. Ative-o no Console do Firebase.'));
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f4f7fe] dark:bg-slate-950 font-sans">
      <div className="w-full max-w-[420px] bg-white dark:bg-slate-900 rounded-[32px] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col min-h-[780px] sm:min-h-[760px]">
        
        {/* Toggle Nav */}
        <div className="flex bg-[#eff2f9] dark:bg-slate-800 rounded-full p-1 mb-10 shrink-0">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-3 text-[15px] font-semibold rounded-full transition-all duration-200 ${
              isLogin 
                ? 'bg-white dark:bg-slate-700 text-[#2a2c5a] dark:text-white shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t('login.tab_login', 'Entrar')}
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-3 text-[15px] font-semibold rounded-full transition-all duration-200 ${
              !isLogin 
                ? 'bg-white dark:bg-slate-700 text-[#2a2c5a] dark:text-white shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t('login.tab_create', 'Criar conta')}
          </button>
        </div>

        <div className="mb-8 shrink-0">
          <h1 className="text-[32px] font-extrabold text-[#2a2c5a] dark:text-white mb-3 tracking-tight leading-tight">
            {isLogin ? t('login.title_login', 'Entrar na Aura') : t('login.title_create', 'Criar sua conta')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed">
            {isLogin 
              ? t('login.subtitle_login', 'Entre para continuar no feed, nas comunidades e nas conexões relevantes.')
              : t('login.subtitle_create', 'Comece grátis e descubra uma rede social mais elegante, organizada e útil.')}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-500 text-sm p-4 rounded-2xl mb-6 border border-red-100 dark:border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <input
                type="text"
                autoComplete="name"
                placeholder={t('login.name_placeholder', 'Seu nome completo')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#f2f5fd] dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 border-2 border-transparent focus:border-[#7a63f1] rounded-2xl px-5 py-4 text-[15px] outline-none transition-all text-[#2a2c5a] dark:text-white placeholder-[#8a94a6] dark:placeholder-slate-500 cursor-text"
                required={!isLogin}
                disabled={loading}
              />
            </div>
          )}
          <div>
            <input
              type="email"
              autoComplete="email"
              placeholder={t('login.email_placeholder', 'E-mail')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#f2f5fd] dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 border-2 border-transparent focus:border-[#7a63f1] rounded-2xl px-5 py-4 text-[15px] outline-none transition-all text-[#2a2c5a] dark:text-white placeholder-[#8a94a6] dark:placeholder-slate-500 cursor-text"
              required
              disabled={loading}
            />
          </div>
          <div>
            <input
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder={t('login.password_placeholder', 'Senha')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#f2f5fd] dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 border-2 border-transparent focus:border-[#7a63f1] rounded-2xl px-5 py-4 text-[15px] outline-none transition-all text-[#2a2c5a] dark:text-white placeholder-[#8a94a6] dark:placeholder-slate-500 font-medium cursor-text"
              required
              disabled={loading}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7a63f1] hover:bg-[#6c55e0] active:scale-[0.98] text-white font-semibold py-4 rounded-2xl transition-all shadow-[0_8px_20px_rgba(122,99,241,0.25)] dark:shadow-none mt-2 flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? t('login.waiting', 'Aguarde...') : (isLogin ? t('login.tab_login', 'Entrar') : t('login.tab_create', 'Criar nova conta'))}
          </button>
        </form>

        <div className="text-center mt-6">
          <button type="button" className="text-[#6c55e0] dark:text-[#8a76f2] text-[15px] font-semibold hover:underline">
            {t('login.forgot', 'Esqueceu a senha?')}
          </button>
        </div>

        <div className="mt-auto w-full pt-6">
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            type="button"
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-3 mb-6 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t('login.google_continue', 'Continuar com Google')}
          </button>

          <p className="text-center text-[13px] text-slate-400 dark:text-slate-500 px-2 leading-relaxed">
            {t('login.google_desc', 'Acesso rápido, criação de conta simples e login com Google em um clique.')}
          </p>
        </div>
      </div>
    </div>
  );
}
