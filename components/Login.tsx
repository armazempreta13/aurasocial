'use client';

import { useState } from 'react';
import { auth } from '@/firebase';
import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  GithubAuthProvider,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { Github, Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from './Logo';

export function Login() {
  const { t } = useTranslation('common');
  const [isLogin, setIsLogin] = useState(true);
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
        setError(t('login.not_allowed', 'Este método de login não está ativado.'));
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
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Google Login Error:', err);
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const provider = new GithubAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Github Login Error:', err);
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = (err: any) => {
    if (err.code === 'auth/unauthorized-domain') {
      setError(t('login.domain_error', 'Este domínio não está autorizado no console do Firebase.'));
    } else if (err.code === 'auth/operation-not-allowed') {
      setError(t('login.not_allowed', 'Este método de login não está ativado no Firebase.'));
    } else if (err.code === 'auth/account-exists-with-different-credential') {
      setError(t('login.account_exists', 'Já existe uma conta com este e-mail vinculada a outro provedor.'));
    } else if (err.code === 'auth/popup-closed-by-user') {
      // User closed popup
    } else {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8fafc] dark:bg-[#020617] font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-500/10 dark:bg-violet-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[440px] z-10"
      >
        <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl rounded-[40px] p-8 sm:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-none border border-white dark:border-slate-800 flex flex-col relative overflow-hidden">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-10 text-center">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mb-6 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-2xl"
            >
              <Logo className="h-10" />
            </motion.div>
            <h1 className="text-[32px] font-black text-[#1e1b4b] dark:text-white mb-2 tracking-tight leading-tight">
              {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[15px] font-medium max-w-[280px]">
              {isLogin 
                ? 'Conecte-se para continuar explorando o Aura Social.'
                : 'Junte-se à comunidade onde a autenticidade é o foco.'}
            </p>
          </div>

          {/* Error Message */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 dark:bg-red-500/10 text-red-500 text-sm p-4 rounded-2xl mb-6 border border-red-100 dark:border-red-500/20 flex items-center gap-3"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div className="group relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors pointer-events-none">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#f8fafc] dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 border-2 border-transparent focus:border-violet-500/20 rounded-2xl pl-12 pr-5 py-4 text-[15px] outline-none transition-all text-[#1e1b4b] dark:text-white placeholder-[#94a3b8] dark:placeholder-slate-500 shadow-sm"
                  required={!isLogin}
                  disabled={loading}
                />
              </div>
            )}
            
            <div className="group relative">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors pointer-events-none">
                <Mail size={18} />
              </div>
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#f8fafc] dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 border-2 border-transparent focus:border-violet-500/20 rounded-2xl pl-12 pr-5 py-4 text-[15px] outline-none transition-all text-[#1e1b4b] dark:text-white placeholder-[#94a3b8] dark:placeholder-slate-500 shadow-sm"
                required
                disabled={loading}
              />
            </div>

            <div className="group relative">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors pointer-events-none">
                <Lock size={18} />
              </div>
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#f8fafc] dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 border-2 border-transparent focus:border-violet-500/20 rounded-2xl pl-12 pr-5 py-4 text-[15px] outline-none transition-all text-[#1e1b4b] dark:text-white placeholder-[#94a3b8] dark:placeholder-slate-500 shadow-sm"
                required
                disabled={loading}
              />
            </div>

            {isLogin && (
              <div className="flex justify-end pt-1">
                <button type="button" className="text-violet-600 dark:text-violet-400 text-sm font-semibold hover:underline">
                  Esqueceu a senha?
                </button>
              </div>
            )}
            
            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-violet-500/25 flex justify-center items-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Entrar' : 'Criar conta'}
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-bold tracking-widest">Ou continue com</span>
            </div>
          </div>

          {/* Social Logins */}
          <div className="flex flex-col gap-3 mb-8">
            <motion.button
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin}
              disabled={loading}
              type="button"
              className="flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group disabled:opacity-50 shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-[15px] font-bold text-slate-700 dark:text-slate-200">Continuar com Google</span>
            </motion.button>

            <motion.button
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGithubLogin}
              disabled={loading}
              type="button"
              className="flex items-center justify-center gap-3 bg-[#1e293b] dark:bg-slate-950 py-4 rounded-2xl hover:bg-[#0f172a] transition-all disabled:opacity-50 shadow-lg shadow-slate-900/10"
            >
              <Github className="w-5 h-5 text-white" />
              <span className="text-[15px] font-bold text-white">Continuar com GitHub</span>
            </motion.button>
          </div>

          {/* Footer Toggle */}
          <div className="mt-auto text-center">
            <p className="text-[15px] text-slate-500 dark:text-slate-400">
              {isLogin ? 'Não tem uma conta?' : 'Já possui uma conta?'}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-violet-600 dark:text-violet-400 font-bold hover:underline"
              >
                {isLogin ? 'Criar agora' : 'Fazer login'}
              </button>
            </p>
          </div>
        </div>

        {/* Floating Perks */}
        {!isLogin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 flex justify-center gap-8"
          >
            <div className="flex items-center gap-2 text-[13px] text-slate-400">
              <Sparkles size={14} className="text-amber-500" />
              Livre de anúncios
            </div>
            <div className="flex items-center gap-2 text-[13px] text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              Foco em privacidade
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
