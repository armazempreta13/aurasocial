'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  addDoc
} from 'firebase/firestore';
import { 
  Zap, 
  ShieldAlert, 
  Bell, 
  Settings, 
  Database, 
  Cloud,
  Lock,
  Unlock,
  Play,
  Smartphone,
  Server,
  Terminal,
  RefreshCw,
  Send,
  AlertOctagon,
  LifeBuoy
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { motion } from 'framer-motion';

export default function AdminSystem() {
  const [maintenance, setMaintenance] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profile: adminProfile } = useAppStore();

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'system_config', 'maintenance'));
        if (docSnap.exists()) {
          setMaintenance(docSnap.data().enabled);
        }
      } catch (error) {
        console.error('Error fetching config:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const toggleMaintenance = async () => {
    setSaving(true);
    try {
      const newStatus = !maintenance;
      await setDoc(doc(db, 'system_config', 'maintenance'), {
         enabled: newStatus,
         updatedAt: serverTimestamp(),
         updatedBy: adminProfile?.displayName
      }, { merge: true });
      
      await addDoc(collection(db, 'admin_logs'), {
         adminId: adminProfile?.uid,
         adminName: adminProfile?.displayName,
         action: newStatus ? 'Ativou Manutenção' : 'Desativou Manutenção',
         details: `O sistema global foi ${newStatus ? 'bloqueado' : 'liberado'}.`,
         createdAt: serverTimestamp()
      });
      
      setMaintenance(newStatus);
    } catch (error) {
      alert('Erro ao alterar configuração');
    } finally {
      setSaving(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg) return;
    setSaving(true);
    try {
       // Create a special notification for everyone
       // For now, we'll store it in a general collection that users' clients listen to
       await setDoc(doc(db, 'system_config', 'broadcast'), {
         message: broadcastMsg,
         timestamp: serverTimestamp(),
         sender: adminProfile?.displayName,
         id: Math.random().toString(36).substr(2, 9)
       });
       
       await addDoc(collection(db, 'admin_logs'), {
         adminId: adminProfile?.uid,
         adminName: adminProfile?.displayName,
         action: 'Broadcast Global',
         details: `Mensagem enviada: ${broadcastMsg}`,
         createdAt: serverTimestamp()
       });
       
       setBroadcastMsg('');
       alert('Broadcast enviado para todos os usuários ativos!');
    } catch (error) {
       alert('Erro ao enviar broadcast');
    } finally {
       setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse">Iniciando console do sistema...</div>;

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Comando Global</h1>
          <p className="text-slate-500 font-medium font-mono text-xs mt-1 uppercase tracking-widest">Controle de infraestrutura e comunicação em massa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Maintenance Control */}
        <motion.div 
           whileHover={{ y: -5 }}
           className="bg-white rounded-[50px] p-12 border border-slate-100 shadow-xl relative overflow-hidden group"
        >
           <div className={`absolute top-0 right-0 w-40 h-40 ${maintenance ? 'bg-rose-500/10' : 'bg-emerald-500/10'} blur-[80px] rounded-full`}></div>
           
           <div className="flex items-center gap-6 mb-10">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center border-2 ${maintenance ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-emerald-50 border-emerald-100 text-emerald-500'}`}>
                 {maintenance ? <Lock className="w-8 h-8" /> : <Unlock className="w-8 h-8" />}
              </div>
              <div>
                 <h2 className="text-2xl font-black text-slate-900 leading-tight">Modo Manutenção</h2>
                 <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Status: {maintenance ? 'BLOQUEADO' : 'LIBERADO'}</p>
              </div>
           </div>

           <p className="text-slate-600 font-medium leading-relaxed mb-10 h-20">
              Quando ativo, o modo manutenção bloqueia o acesso de todos os usuários comuns à plataforma Aura, mantendo apenas administradores autorizados.
           </p>

           <button 
              onClick={toggleMaintenance}
              disabled={saving}
              className={`w-full py-6 rounded-[28px] font-black text-sm uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center justify-center gap-3 ${
                maintenance 
                ? 'bg-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-600' 
                : 'bg-rose-500 text-white shadow-rose-200 hover:bg-rose-600'
              }`}
           >
              {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : (maintenance ? <Play className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />)}
              {maintenance ? 'Desativar Manutenção' : 'Ativar Modo Manutenção'}
           </button>
        </motion.div>

        {/* Broadcast Engine */}
        <motion.div 
           whileHover={{ y: -5 }}
           className="bg-slate-900 rounded-[50px] p-12 text-white relative overflow-hidden shadow-2xl"
        >
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent pointer-events-none"></div>
           
           <div className="relative z-10">
              <div className="flex items-center gap-6 mb-10">
                 <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border-2 border-indigo-500/30">
                    <Bell className="w-8 h-8" />
                 </div>
                 <div>
                    <h2 className="text-2xl font-black leading-tight">Broadcast Instantâneo</h2>
                    <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest">COMUNICAÇÃO EM MASSA</p>
                 </div>
              </div>

              <div className="space-y-6">
                 <textarea 
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    placeholder="Escreva a mensagem global aqui..."
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-[30px] p-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all placeholder:text-slate-500"
                 />
                 
                 <button 
                    onClick={sendBroadcast}
                    disabled={saving || !broadcastMsg}
                    className="w-full py-6 bg-indigo-500 hover:bg-indigo-600 text-white rounded-[28px] font-black text-sm uppercase tracking-[0.2em] transition-all shadow-[0_20px_40px_rgba(99,102,241,0.4)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none"
                 >
                    {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Disparar Mensagem
                 </button>
              </div>
           </div>
        </motion.div>
      </div>

      <div className="bg-white rounded-[50px] border border-slate-100 p-12 shadow-sm">
         <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-10">Estado dos Serviços Aura</h3>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { label: 'DB Engine', value: 'Operacional', icon: Database, color: 'text-emerald-500' },
              { label: 'Security Layer', value: 'Blindado', icon: ShieldAlert, color: 'text-indigo-500' },
              { label: 'Socket Bridge', value: 'Conectado', icon: Zap, color: 'text-amber-500' },
              { label: 'Global CDN', value: 'Ativo', icon: Cloud, color: 'text-indigo-500' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                 <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                    <s.icon className={`w-6 h-6 ${s.color}`} />
                 </div>
                 <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{s.label}</p>
                 <p className="font-black text-slate-900 text-sm tracking-tighter">{s.value}</p>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
