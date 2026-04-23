'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  getCountFromServer, 
  orderBy, 
  limit, 
  onSnapshot, 
  Timestamp, 
  getDocs,
  where,
  startAt,
  endAt
} from 'firebase/firestore';
import { 
  Users, 
  MessageSquare, 
  Heart, 
  TrendingUp, 
  UserPlus, 
  MessageCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Activity,
  Globe,
  Database,
  Smartphone,
  Bell
} from 'lucide-react';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface Stats {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
  totalMessages: number;
  activeUsersToday: number;
}

interface ChartData {
  date: Date;
  count: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalPosts: 0,
    totalComments: 0,
    totalMessages: 0,
    activeUsersToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [userGrowth, setUserGrowth] = useState<ChartData[]>([]);
  const [recentActions, setRecentActions] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersSnap, postsSnap, commentsSnap, messagesSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'posts')),
          getCountFromServer(collection(db, 'comments')),
          getCountFromServer(collection(db, 'messages'))
        ]);

        // Calculate active users in the last 24h
        const activeSnap = await getCountFromServer(
          query(collection(db, 'users'), where('updatedAt', '>=', Timestamp.fromDate(subDays(new Date(), 1))))
        );

        setStats(prev => ({
          ...prev,
          totalUsers: usersSnap.data().count,
          totalPosts: postsSnap.data().count,
          totalComments: commentsSnap.data().count,
          totalMessages: messagesSnap.data().count,
          activeUsersToday: activeSnap.data().count
        }));

        // Fetch user growth for the last 7 days
        const sevenDaysAgo = subDays(new Date(), 7);
        const growthQuery = query(
          collection(db, 'users'),
          where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo)),
          orderBy('createdAt', 'asc')
        );
        const growthSnap = await getDocs(growthQuery);
        
        const growthData: ChartData[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = subDays(new Date(), i);
          const count = growthSnap.docs.filter(doc => {
            const date = doc.data().createdAt?.toDate();
            return date && isSameDay(date, d);
          }).length;
          growthData.push({ date: d, count });
        }
        setUserGrowth(growthData);

      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    const logsQuery = query(collection(db, 'admin_logs'), orderBy('createdAt', 'desc'), limit(8));
    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      setRecentActions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, []);

  const statCards = [
    { label: 'Usuários Totais', value: stats.totalUsers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+12%', up: true },
    { label: 'Ativos hoje', value: stats.activeUsersToday, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', trend: '+100%', up: true },
    { label: 'Engajamento', value: stats.totalComments + stats.totalMessages, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+18%', up: true },
    { label: 'Crescimento', value: userGrowth.reduce((acc, curr) => acc + curr.count, 0), icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: '+24%', up: true },
  ];

  const maxGrowth = Math.max(...userGrowth.map(d => d.count), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Carregando métricas reais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-black text-slate-900 tracking-tight"
          >
            Aura Analytics
          </motion.h1>
          <p className="text-slate-500 font-medium mt-1 uppercase tracking-wider text-[11px] font-bold">Monitoramento de Ecossistema em Tempo Real</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 text-xs font-black uppercase tracking-tighter">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Sistema Online
          </div>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group hover:border-indigo-100 transition-colors"
          >
            <div className={`p-4 rounded-2xl ${card.bg} ${card.color} w-fit mb-6 group-hover:scale-110 transition-transform`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-900 leading-none">{card.value.toLocaleString()}</span>
              <div className={`flex items-center text-[10px] font-black uppercase ${card.up ? 'text-emerald-500' : 'text-rose-500'}`}>
                {card.up ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {card.trend}
              </div>
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Growth Chart */}
        <div className="lg:col-span-2 space-y-8">
          <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="bg-slate-900 rounded-[50px] p-10 text-white shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full -mr-40 -mt-40"></div>
            
            <div className="relative z-10 flex items-center justify-between mb-12">
               <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    Novos Usuários
                  </h3>
                  <p className="text-slate-400 text-sm font-medium mt-1">Comparativo dos últimos 7 dias</p>
               </div>
               <div className="text-right">
                  <p className="text-3xl font-black text-indigo-400">+{userGrowth.reduce((acc, curr) => acc + curr.count, 0)}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-tighter">TOTAL DA SEMANA</p>
               </div>
            </div>

            <div className="relative z-10 h-64 flex items-end justify-between gap-4 px-4">
               {userGrowth.map((data, i) => (
                 <div key={i} className="flex-1 flex flex-col items-center group/bar cursor-default">
                    <div className="relative w-full h-full flex items-end">
                       <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${(data.count / maxGrowth) * 100}%` }}
                          transition={{ delay: i * 0.1, duration: 1, ease: "easeOut" }}
                          className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-2xl relative"
                       >
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-2 py-1 rounded-lg text-[10px] font-black opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap">
                            {data.count} novos
                          </div>
                       </motion.div>
                    </div>
                    <p className="mt-6 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                      {format(data.date, 'EEE', { locale: ptBR })}
                    </p>
                 </div>
               ))}
               
               {/* Grid Lines */}
               <div className="absolute inset-0 border-b border-white/5 pointer-events-none"></div>
               <div className="absolute bottom-1/2 w-full border-b border-white/5 pointer-events-none"></div>
               <div className="absolute top-0 w-full border-b border-white/5 pointer-events-none"></div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Infraestrutura</h4>
                <div className="space-y-6">
                   {[
                     { label: 'Cloud Firestore', icon: Database, status: 'Operacional', color: 'text-emerald-500' },
                     { label: 'Realtime Storage', icon: Globe, status: 'Operacional', color: 'text-emerald-500' },
                     { label: 'Global Edge', icon: Zap, status: '98ms Latência', color: 'text-indigo-500' },
                   ].map((item, i) => (
                     <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-slate-50 rounded-xl">
                              <item.icon className="w-4 h-4 text-slate-400" />
                           </div>
                           <span className="text-sm font-bold text-slate-700">{item.label}</span>
                        </div>
                        <span className={`text-[10px] font-black uppercase ${item.color}`}>{item.status}</span>
                     </div>
                   ))}
                </div>
             </div>

             <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Plataforma</h4>
                <div className="space-y-6">
                   {[
                     { label: 'Mobile App', icon: Smartphone, status: 'Beta', color: 'text-amber-500' },
                     { label: 'Desktop Web', icon: Globe, status: 'v1.4.2', color: 'text-slate-400' },
                     { label: 'Bot Moderation', icon: ShieldCheck, status: 'Ativo', color: 'text-emerald-500' },
                   ].map((item, i) => (
                     <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-slate-50 rounded-xl">
                              <item.icon className="w-4 h-4 text-slate-400" />
                           </div>
                           <span className="text-sm font-bold text-slate-700">{item.label}</span>
                        </div>
                        <span className={`text-[10px] font-black uppercase ${item.color}`}>{item.status}</span>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </div>

        {/* Sidebar Activity & Tools */}
        <div className="space-y-8">
           <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="font-black text-slate-900 uppercase tracking-tighter">Últimas Ações Admin</h3>
                 <div className="p-2 bg-slate-50 rounded-xl">
                    <Clock className="w-4 h-4 text-slate-400" />
                 </div>
              </div>
              <div className="space-y-6">
                 {recentActions.map((log, i) => (
                   <motion.div 
                    key={log.id} 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-4 group"
                   >
                      <div className="relative shrink-0">
                         <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-[10px] z-10 relative">
                            {log.adminName?.[0] || 'A'}
                         </div>
                         <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-6 bg-slate-100 last:hidden"></div>
                      </div>
                      <div className="flex-1 pb-4">
                         <p className="text-xs font-black text-slate-900">{log.action}</p>
                         <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                           {log.createdAt?.toDate ? format(log.createdAt.toDate(), "HH:mm '•' d MMM", { locale: ptBR }) : 'Agora'}
                         </p>
                      </div>
                   </motion.div>
                 ))}
                 
                 {recentActions.length === 0 && (
                    <div className="py-10 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">
                       Nenhum log disponível
                    </div>
                 )}
              </div>
              <button className="w-full py-4 mt-4 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all">
                 Ver Log Completo
              </button>
           </div>

           <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-[40px] p-8 text-white relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
              <div className="relative z-10">
                 <ShieldCheck className="w-12 h-12 text-indigo-200 mb-6 drop-shadow-2xl" />
                 <h3 className="text-2xl font-black leading-tight mb-2">Comando Central</h3>
                 <p className="text-indigo-100/70 text-sm font-medium mb-8">Gerencie permissões globais e estado da plataforma.</p>
                 
                 <div className="grid grid-cols-2 gap-3">
                    <button className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 text-center transition-all group/btn">
                       <p className="text-[10px] font-black text-indigo-200 uppercase tracking-tighter opacity-70 mb-1">BROADCAST</p>
                       <p className="text-xs font-bold whitespace-nowrap">Enviar Alerta</p>
                    </button>
                    <button className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 text-center transition-all">
                       <p className="text-[10px] font-black text-indigo-200 uppercase tracking-tighter opacity-70 mb-1">SISTEMA</p>
                       <p className="text-xs font-bold whitespace-nowrap">Manutenção</p>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
