'use client';

import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { 
  Bell, 
  Send, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  Trash2,
  Megaphone,
  Clock,
  Globe
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminBroadcast() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'alert'>('info');
  const [isSending, setIsSending] = useState(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const { profile, isAuthReady } = useAppStore();

  useEffect(() => {
    if (!isAuthReady) return;

    async function checkAccess() {
      const { isAdmin } = await import('@/lib/admin');
      if (!isAdmin(profile)) {
        window.location.href = '/feed';
        return;
      }
      fetchBroadcasts();
    }
    checkAccess();
  }, [isAuthReady, profile]);

  const fetchBroadcasts = async () => {
    try {
      const q = query(collection(db, 'system_notifications'), orderBy('createdAt', 'desc'), limit(10));
      const snap = await getDocs(q);
      setBroadcasts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error('Aura Broadcast Fetch Error:', e);
    } finally {
      // If we had a loading state here, we would clear it. 
      // AdminBroadcast doesn't have a explicit loading spinner yet, but better be safe.
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;
    
    setIsSending(true);
    try {
      await addDoc(collection(db, 'system_notifications'), {
        title,
        message,
        type,
        authorName: profile?.displayName,
        createdAt: serverTimestamp(),
        isActive: true
      });
      
      // Log Action
      await addDoc(collection(db, 'admin_logs'), {
        adminId: profile?.uid,
        adminName: profile?.displayName,
        action: 'Broadcast Global',
        details: `Título: ${title}`,
        createdAt: serverTimestamp()
      });

      setTitle('');
      setMessage('');
      fetchBroadcasts();
      alert('Broadcast enviado com sucesso!');
    } catch (error) {
      alert('Erro ao enviar broadcast');
    } finally {
      setIsSending(false);
    }
  };

  const deleteBroadcast = async (id: string) => {
    if (!confirm('Deseja remover este aviso global?')) return;
    await deleteDoc(doc(db, 'system_notifications', id));
    fetchBroadcasts();
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight text-center md:text-left">Comunicação Global</h1>
          <p className="text-slate-500 font-medium font-mono text-xs mt-1 uppercase tracking-widest text-center md:text-left">Envio de avisos e alertas para toda a rede Aura</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {/* Composer */}
        <section className="bg-white rounded-[50px] border border-slate-100 shadow-xl p-12 relative overflow-hidden h-fit">
           <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 blur-[100px] rounded-full -mr-20 -mt-20"></div>
           
           <div className="flex items-center gap-4 mb-10 relative z-10">
              <div className="w-14 h-14 bg-fuchsia-100 rounded-3xl flex items-center justify-center text-fuchsia-600">
                 <Megaphone className="w-7 h-7" />
              </div>
              <div>
                 <h2 className="text-xl font-black text-slate-900">Novo Broadcast</h2>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Este aviso aparecerá no topo de todos os perfis</p>
              </div>
           </div>

           <form onSubmit={handleSendBroadcast} className="space-y-6 relative z-10">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Título do Alerta</label>
                 <input 
                   type="text" 
                   value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   placeholder="Ex: Manutenção Programada"
                   className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-fuchsia-500 transition-all placeholder:text-slate-300"
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Mensagem Detalhada</label>
                 <textarea 
                   value={message}
                   onChange={(e) => setMessage(e.target.value)}
                   rows={4}
                   placeholder="Descreva o aviso de forma clara..."
                   className="w-full bg-slate-50 border border-slate-100 rounded-[30px] px-6 py-4 font-medium text-slate-900 focus:ring-2 focus:ring-fuchsia-500 transition-all placeholder:text-slate-300"
                 />
              </div>

              <div className="grid grid-cols-3 gap-3">
                 <button 
                   type="button" 
                   onClick={() => setType('info')}
                   className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${type === 'info' ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                 >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Informativo</span>
                 </button>
                 <button 
                   type="button" 
                   onClick={() => setType('warning')}
                   className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-lg shadow-amber-100' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                 >
                    <Zap className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Aviso</span>
                 </button>
                 <button 
                   type="button" 
                   onClick={() => setType('alert')}
                   className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${type === 'alert' ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-lg shadow-rose-100' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                 >
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Urgente</span>
                 </button>
              </div>

              <button 
                type="submit"
                disabled={isSending}
                className="w-full py-5 bg-fuchsia-600 text-white rounded-[30px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-fuchsia-200 hover:bg-fuchsia-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSending ? <Globe className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Transmitir para todos
              </button>
           </form>
        </section>

        {/* History */}
        <section className="space-y-6">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-3 ml-4">
              <Clock className="w-4 h-4" />
              Histórico de Envios
           </h3>
           
           <div className="space-y-4">
              <AnimatePresence>
                 {broadcasts.map((b, i) => (
                   <motion.div 
                     key={b.id}
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, x: 20 }}
                     className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm group hover:shadow-xl transition-all"
                   >
                      <div className="flex justify-between items-start mb-4">
                         <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl scale-75 ${b.type === 'alert' ? 'bg-rose-100 text-rose-600' : b.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                               <Bell className="w-5 h-5" />
                            </div>
                            <h4 className="font-black text-slate-900 group-hover:text-fuchsia-600 transition-colors uppercase tracking-tight">{b.title}</h4>
                         </div>
                         <button 
                           onClick={() => deleteBroadcast(b.id)}
                           className="p-3 text-slate-300 hover:text-rose-500 bg-slate-50 opacity-0 group-hover:opacity-100 transition-all rounded-2xl"
                         >
                            <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                      <p className="text-sm font-medium text-slate-500 mb-6 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-transparent group-hover:border-slate-100 transition-all">
                         {b.message}
                      </p>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enviado por:</span>
                            <span className="text-[10px] font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg uppercase tracking-tight">{b.authorName}</span>
                         </div>
                         <span className="text-[10px] font-bold text-slate-400">
                            {b.createdAt?.toDate ? format(b.createdAt.toDate(), "d MMM, HH:mm", { locale: ptBR }) : 'Agora'}
                         </span>
                      </div>
                   </motion.div>
                 ))}
              </AnimatePresence>

              {broadcasts.length === 0 && (
                <div className="p-20 text-center bg-white rounded-[50px] border border-dashed border-slate-200">
                   <Megaphone className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum broadcast registrado</p>
                </div>
              )}
           </div>
        </section>
      </div>
    </div>
  );
}
