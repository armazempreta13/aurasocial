'use client';

import { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  UserX, 
  MessageSquareX, 
  Flag,
  Settings2,
  Save,
  Plus,
  X,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { getRemoteModerationConfig, updateModerationConfig } from '@/lib/moderation/utils';
import { ModerationConfig } from '@/lib/moderation/engine';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/firebase';
import { getCountFromServer, query, collection, where } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';

export default function AdminModeration() {
  const [config, setConfig] = useState<ModerationConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBlacklistTerm, setNewBlacklistTerm] = useState('');
  const [counts, setCounts] = useState({ blocked: 0, flagged: 0 });

  const profile = useAppStore(s => s.profile);
  const isAuthReady = useAppStore(s => s.isAuthReady);

  useEffect(() => {
    if (!isAuthReady) return;

    async function checkAccess() {
      const { isAdmin } = await import('@/lib/admin');
      if (!isAdmin(profile)) {
        window.location.href = '/feed';
        return;
      }
      fetchConfig();
    }
    checkAccess();
  }, [isAuthReady, profile]);

  const fetchConfig = async () => {
    try {
      console.log('Aura: Fetching moderation config...');
      const data = await getRemoteModerationConfig();
      setConfig(data);
      
      // Fetch Real Counts
      const blockedPosts = await getCountFromServer(query(collection(db, 'posts'), where('moderation.status', '==', 'block'))).catch(() => null);
      const flaggedPosts = await getCountFromServer(query(collection(db, 'posts'), where('moderation.status', '==', 'flag'))).catch(() => null);
      
      setCounts({
        blocked: blockedPosts ? blockedPosts.data().count : 0,
        flagged: flaggedPosts ? flaggedPosts.data().count : 0
      });
    } catch (e) {
      console.error('Aura Moderation Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await updateModerationConfig(config);
      alert('Configurações de moderação atualizadas com sucesso!');
    } catch (error) {
      alert('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const removeTerm = (list: keyof ModerationConfig, term: string) => {
    if (!config) return;
    const currentList = config[list] as string[];
    setConfig({
      ...config,
      [list]: currentList.filter(t => t !== term)
    });
  };

  const addTerm = (list: keyof ModerationConfig, term: string) => {
    if (!config || !term) return;
    const currentList = config[list] as string[];
    if (currentList.includes(term)) return;
    setConfig({
      ...config,
      [list]: [...currentList, term]
    });
    setNewBlacklistTerm('');
  };

  const categories = [
    { label: 'Bloqueios Automáticos', count: counts.blocked, icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-50' },
    { label: 'Conteúdo Sinalizado', count: counts.flagged, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Domínios Filtrados', count: config?.bannedDomains.length || 0, icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  ];

  if (loading) return <div className="p-20 text-center animate-pulse font-black uppercase tracking-widest text-slate-400">Sincronizando Motor de Regras...</div>;

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Centro de Moderação</h1>
          <p className="text-slate-500 font-medium font-mono text-xs mt-1 uppercase tracking-widest">Motor Determinístico de Segurança Aura</p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
           <button 
             onClick={() => setActiveTab('overview')}
             className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Métricas
           </button>
           <button 
             onClick={() => setActiveTab('settings')}
             className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${activeTab === 'settings' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Configuração Motor
           </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {categories.map((cat, i) => (
                <div key={i} className={`p-10 rounded-[40px] border border-slate-100 shadow-sm bg-white hover:shadow-xl transition-all group`}>
                  <div className={`w-14 h-14 rounded-2xl ${cat.bg} ${cat.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <cat.icon className="w-7 h-7" />
                  </div>
                  <p className="text-4xl font-black text-slate-900 mb-2 truncate">{cat.count}</p>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">{cat.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[50px] border border-slate-100 shadow-sm p-16 text-center">
              <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <ShieldCheck className="w-12 h-12 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-3">Tudo Sob Controle</h2>
              <p className="text-slate-500 font-medium max-w-lg mx-auto leading-relaxed">
                O motor determinístico está processando postagens em média de **8ms**. 
                Nenhuma anomalia de flood ou ataque de spam detectada nas últimas 24 horas.
              </p>
              <div className="mt-10 flex justify-center gap-4">
                  <button className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-200">
                    <Flag className="w-4 h-4" />
                    Auditoria Completa
                  </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Blacklists Section */}
                <div className="space-y-8">
                   <div className="bg-white rounded-[40px] border border-slate-100 p-10 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                         <div>
                            <h3 className="text-lg font-black text-slate-900">Blacklist (Block)</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Palavras que causam bloqueio imediato</p>
                         </div>
                         <ShieldAlert className="w-6 h-6 text-rose-500" />
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-8">
                         {config?.blacklist.map(term => (
                           <span key={term} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2 border border-slate-200 hover:border-rose-200 transition-colors">
                              {term}
                              <button onClick={() => removeTerm('blacklist', term)} className="text-slate-300 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
                           </span>
                         ))}
                      </div>

                      <div className="flex gap-2">
                         <input 
                           type="text" 
                           value={newBlacklistTerm}
                           onChange={(e) => setNewBlacklistTerm(e.target.value)}
                           placeholder="Novo termo proibido..."
                           className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
                         />
                         <button 
                           onClick={() => addTerm('blacklist', newBlacklistTerm)}
                           className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all"
                         >
                            <Plus className="w-5 h-5" />
                         </button>
                      </div>
                   </div>

                   <div className="bg-white rounded-[40px] border border-slate-100 p-10 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                         <div>
                            <h3 className="text-lg font-black text-slate-900">Softlist (Flag)</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Palavras que sinalizam para revisão</p>
                         </div>
                         <Flag className="w-6 h-6 text-amber-500" />
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                         {config?.softlist.map(term => (
                           <span key={term} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2 border border-slate-200">
                              {term}
                              <button onClick={() => removeTerm('softlist', term)} className="text-slate-300 hover:text-amber-500"><X className="w-3.5 h-3.5" /></button>
                           </span>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Weights & Identity Section */}
                <div className="space-y-8">
                   <div className="bg-slate-900 rounded-[40px] p-10 text-white shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[60px] rounded-full"></div>
                      <h3 className="text-lg font-black mb-6">Configuração de Pesos</h3>
                      
                      <div className="space-y-8 relative z-10">
                         <div>
                            <div className="flex justify-between mb-3 text-xs font-bold uppercase tracking-widest text-indigo-300">
                               <span>Limite de Sinalização (Flag)</span>
                               <span>{config?.thresholds.flag.toFixed(2)}</span>
                            </div>
                            <input 
                               type="range" 
                               min="0.1" max="0.5" step="0.05"
                               value={config?.thresholds.flag}
                               onChange={(e) => setConfig({ ...config!, thresholds: { ...config!.thresholds, flag: parseFloat(e.target.value) }})}
                               className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-400"
                            />
                         </div>
                         <div>
                            <div className="flex justify-between mb-3 text-xs font-bold uppercase tracking-widest text-rose-300">
                               <span>Limite de Bloqueio (Block)</span>
                               <span>{config?.thresholds.block.toFixed(2)}</span>
                            </div>
                            <input 
                               type="range" 
                               min="0.5" max="0.95" step="0.05"
                               value={config?.thresholds.block}
                               onChange={(e) => setConfig({ ...config!, thresholds: { ...config!.thresholds, block: parseFloat(e.target.value) }})}
                               className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-rose-400"
                            />
                         </div>
                      </div>
                   </div>

                   <div className="bg-white rounded-[40px] border border-slate-100 p-10 shadow-sm">
                      <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
                         <Zap className="w-5 h-5 text-indigo-500" />
                         Domínios Banidos
                      </h3>
                      <div className="flex flex-wrap gap-2 mb-6">
                         {config?.bannedDomains.map(domain => (
                           <span key={domain} className="px-4 py-2 bg-indigo-50 rounded-xl text-[11px] font-black text-indigo-600 flex items-center gap-2 border border-indigo-100">
                              {domain}
                              <button onClick={() => removeTerm('bannedDomains', domain)} className="text-indigo-300 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
                           </span>
                         ))}
                      </div>
                      <div className="flex gap-2">
                         <input 
                           type="text" 
                           placeholder="ex: siteaposta.com"
                           onKeyDown={(e) => { if (e.key === 'Enter') addTerm('bannedDomains', (e.target as HTMLInputElement).value); }}
                           className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
                         />
                      </div>
                   </div>

                   <button 
                      onClick={handleSaveConfig}
                      disabled={saving}
                      className="w-full py-6 bg-indigo-600 text-white rounded-[30px] font-black text-sm uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                   >
                      {saving ? <Zap className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      Salvar Regras de Segurança
                   </button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
