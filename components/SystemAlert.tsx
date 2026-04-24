'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Zap, AlertCircle, Info } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function SystemAlert() {
  const [notification, setNotification] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Escuta a última notificação do sistema
    const q = query(
      collection(db, 'system_notifications'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        const id = snapshot.docs[0].id;
        
        // Verifica se já não fechamos esta notificação específica permanentemente
        const dismissed = localStorage.getItem(`dismissed_system_notif_${id}`);
        if (!dismissed) {
          setNotification({ ...data, id });
          setIsVisible(true);
        }
      } else {
        setNotification(null);
        setIsVisible(false);
      }
    }, (err) => {
      console.error('System notification listener error:', err);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isVisible && notification) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 10000); // 10 segundos
      return () => clearTimeout(timer);
    }
  }, [isVisible, notification]);

  const dismiss = () => {
    if (notification) {
      localStorage.setItem(`dismissed_system_notif_${notification.id}`, 'true');
    }
    setIsVisible(false);
  };

  // Não mostrar no painel admin para não poluir
  if (pathname?.startsWith('/admin')) return null;

  return (
    <AnimatePresence>
      {isVisible && notification && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-2xl px-6"
        >
          <div className={`p-4 md:p-6 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border-2 flex items-center gap-5 backdrop-blur-xl ${
            notification.type === 'alert' 
            ? 'bg-rose-500/95 border-rose-400 text-white' 
            : notification.type === 'warning'
            ? 'bg-amber-500/95 border-amber-400 text-white'
            : 'bg-indigo-600/95 border-indigo-500 text-white'
          }`}>
             <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                {notification.type === 'alert' ? <AlertCircle className="w-6 h-6" /> : 
                 notification.type === 'warning' ? <Zap className="w-6 h-6" /> : 
                 <Bell className="w-6 h-6" />}
             </div>
             
             <div className="flex-1 min-w-0">
                <h4 className="font-black text-sm md:text-base uppercase tracking-tight leading-none mb-1">{notification.title}</h4>
                <p className="text-xs md:text-sm font-medium opacity-90 line-clamp-2 md:line-clamp-none">{notification.message}</p>
             </div>

             <button 
               onClick={dismiss}
               className="p-3 hover:bg-white/10 rounded-2xl transition-all"
             >
                <X className="w-5 h-5" />
             </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
