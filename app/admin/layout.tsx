'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { isAdmin } from '@/lib/admin';
import { query, collection, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { 
  Users, 
  MessageSquare, 
  BarChart3, 
  ShieldAlert, 
  History, 
  ChevronLeft,
  LayoutDashboard,
  Bell,
  Search,
  Settings,
  LogOut,
  Home,
  Monitor,
  Zap,
  Cpu
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, isAuthReady } = useAppStore();
  const { user, isAuthReady: gateReady } = useRequireAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isAuthReady && !isAdmin(profile)) {
      router.push('/');
    }
  }, [profile, isAuthReady, router]);

  useEffect(() => {
    if (!isAuthReady || !user || !isAdmin(profile)) return;
    const q = query(collection(db, 'admin_logs'), orderBy('createdAt', 'desc'), limit(5));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [isAuthReady, user, profile]);

  if (!gateReady || !user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center">
        <div className="w-20 h-20 border-8 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-8"></div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">Autenticando Permissões</h1>
        <p className="text-slate-400 font-medium">Aguardando login...</p>
      </div>
    );
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    // Redirect to users search or posts search
    if (searchQuery.includes('@') || searchQuery.length > 20) {
      router.push(`/admin/users?q=${encodeURIComponent(searchQuery)}`);
    } else {
      router.push(`/admin/posts?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  if (!isAuthReady || !isAdmin(profile)) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center">
        <div className="w-20 h-20 border-8 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-8"></div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">Autenticando Permissões</h1>
        <p className="text-slate-400 font-medium">Validando nível de privilégio administrativo...</p>
      </div>
    );
  }

  const menuItems = [
    { icon: BarChart3, label: 'Analytics', href: '/admin', color: 'text-blue-500' },
    { icon: Users, label: 'Membros', href: '/admin/users', color: 'text-indigo-500' },
    { icon: MessageSquare, label: 'Conteúdo', href: '/admin/posts', color: 'text-amber-500' },
    { icon: ShieldAlert, label: 'Moderação', href: '/admin/moderation', color: 'text-rose-500' },
    { icon: Bell, label: 'Broadcast', href: '/admin/broadcast', color: 'text-fuchsia-500' },
    { icon: Cpu, label: 'Sistema', href: '/admin/system', color: 'text-emerald-500' },
    { icon: History, label: 'Logs Binários', href: '/admin/logs', color: 'text-slate-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-indigo-500 selection:text-white">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-80' : 'w-24'
        } bg-slate-900 text-slate-400 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col fixed inset-y-0 z-50 border-r border-white/5 shadow-2xl`}
      >
        <div className="p-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="font-black text-white text-2xl tracking-tighter">AURA CORE</span>
                <p className="text-[10px] font-bold text-slate-500 tracking-[0.3em] uppercase">V3.5 Admin</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-6 py-6 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-4 rounded-3xl transition-all group relative ${
                  isActive 
                  ? 'bg-white/10 text-white shadow-xl shadow-black/20' 
                  : 'hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 duration-300 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                {isSidebarOpen && <span className="font-black text-sm uppercase tracking-tighter">{item.label}</span>}
                {isActive && (
                  <motion.div 
                    layoutId="activeNav"
                    className="absolute left-0 w-1.5 h-6 bg-indigo-500 rounded-r-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-8 space-y-4">
           <Link
              href="/"
              className="flex items-center gap-4 px-4 py-4 rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all group shadow-lg shadow-indigo-500/10"
            >
              <Home className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="font-black text-sm uppercase tracking-tighter">Exit to Site</span>}
            </Link>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-3xl border border-white/5 text-slate-500 hover:bg-white/5 hover:text-white transition-all group"
          >
            <ChevronLeft className={`w-5 h-5 transition-transform duration-500 ${!isSidebarOpen ? 'rotate-180' : ''}`} />
            {isSidebarOpen && <span className="font-black text-sm uppercase tracking-tighter">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 ${isSidebarOpen ? 'ml-80' : 'ml-24'} transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] min-h-screen flex flex-col`}>
        {/* Header */}
        <header className="h-28 bg-white/80 backdrop-blur-2xl border-b border-slate-100 px-12 flex items-center justify-between sticky top-0 z-40 transition-all">
          <div className="flex items-center gap-6 group">
             <form onSubmit={handleSearch} className="flex items-center gap-4 bg-slate-100/50 px-6 py-3.5 rounded-3xl border border-slate-100 w-[500px] transition-all focus-within:w-[600px] focus-within:bg-white focus-within:shadow-2xl focus-within:shadow-indigo-500/10">
                <Search className="w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisa rápida (ID, Email, @Username...)" 
                  className="bg-transparent border-none focus:ring-0 text-sm font-bold w-full placeholder:text-slate-400 text-slate-900"
                />
             </form>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4 relative">
               <button 
                 onClick={() => setShowNotifications(!showNotifications)}
                 className={`relative p-3 rounded-2xl transition-all ${showNotifications ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
               >
                 <Bell className="w-5 h-5" />
                 {notifications.length > 0 && (
                   <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
                 )}
               </button>

               <AnimatePresence>
                 {showNotifications && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 10, scale: 0.95 }}
                     className="absolute top-full right-0 mt-4 w-96 bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden z-50 ring-1 ring-black/5"
                   >
                     <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                       <h3 className="font-black text-slate-900 uppercase tracking-tighter text-sm">Logs Recentes</h3>
                       <Link href="/admin/logs" className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600">Ver Todos</Link>
                     </div>
                     <div className="max-h-[400px] overflow-y-auto">
                        {notifications.map((log) => (
                          <div key={log.id} className="p-6 border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0 grow">
                             <p className="text-xs font-black text-slate-900 leading-tight">{log.action}</p>
                             <p className="text-[10px] font-medium text-slate-400 mt-1">{log.details}</p>
                          </div>
                        ))}
                        {notifications.length === 0 && (
                          <div className="p-10 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">Silêncio administrativo</div>
                        )}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>

               <button 
                 onClick={() => router.push('/admin/system')}
                 className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
               >
                 <Settings className="w-5 h-5" />
               </button>
            </div>
            
            <div className="h-10 w-px bg-slate-100"></div>

            <div className="flex items-center gap-4 pl-2">
              <div className="text-right">
                <p className="text-sm font-black text-slate-900 leading-tight">{profile?.displayName}</p>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">Admin Root</p>
              </div>
              <div className="relative group">
                 <img 
                   src={profile?.photoURL || 'https://ui-avatars.com/api/?name=Admin'} 
                   alt="Admin" 
                   className="w-14 h-14 rounded-2xl border-4 border-white shadow-xl group-hover:scale-105 transition-transform cursor-pointer"
                 />
                 <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-white"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Container */}
        <div className="p-12 max-w-[1800px] mx-auto w-full">
           <motion.div
             key={pathname}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.4, ease: "easeOut" }}
           >
             {children}
           </motion.div>
        </div>
      </main>
    </div>
  );
}
