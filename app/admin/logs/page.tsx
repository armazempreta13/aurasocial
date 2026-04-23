'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  limit, 
  onSnapshot
} from 'firebase/firestore';
import { 
  History, 
  Search, 
  ShieldAlert, 
  User, 
  FileText, 
  Clock,
  Terminal,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'admin_logs'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error('Error listening to logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Logs do Sistema</h1>
          <p className="text-slate-500 font-medium">Histórico completo de ações administrativas.</p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100">
           <Activity className="w-4 h-4" />
           AUDITORIA ATIVA
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8">
         <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center">
               <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
               <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Console de Eventos</h2>
               <p className="text-[10px] text-slate-400 font-bold">MONITORAMENTO EM TEMPO REAL</p>
            </div>
         </div>

         <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-4 p-4 rounded-3xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                 <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-white group-hover:shadow-sm transition-all">
                    <History className="w-5 h-5 text-slate-500" />
                 </div>
                 
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                       <p className="text-sm font-bold text-slate-900 truncate">{log.action}</p>
                       <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          <Clock className="w-3 h-3" />
                          {log.createdAt?.toDate ? format(log.createdAt.toDate(), "d MMM, HH:mm:ss", { locale: ptBR }) : 'Agora'}
                       </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                       <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-300" />
                          <span className="text-slate-900 font-bold">{log.adminName}</span>
                       </div>
                       <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium truncate">
                          <FileText className="w-3.5 h-3.5 text-slate-300" />
                          ID do Alvo: <span className="text-slate-400 font-mono">{log.targetId}</span>
                       </div>
                    </div>
                    {log.details && (
                      <div className="mt-2 text-[11px] text-slate-400 bg-slate-50/50 p-2 rounded-lg border border-slate-100/50 font-medium italic">
                        "{log.details}"
                      </div>
                    )}
                 </div>
              </div>
            ))}

            {logs.length === 0 && !loading && (
              <div className="py-20 text-center">
                 <p className="text-slate-400 font-medium">Nenhum evento registrado no console ainda.</p>
              </div>
            )}

            {loading && (
              <div className="py-20 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
