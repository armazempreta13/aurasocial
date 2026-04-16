'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Loader2, Plus, GripVertical, Trash2, ShieldAlert, CheckCircle, Save, X, Settings2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

// Discord-like taxonomy presets
const CATEGORIES = ['Convivência', 'Conteúdo', 'Privacidade', 'Moderação'];
const TYPES = ['Respeito', 'Spam', 'NSFW', 'Ódio', 'Pirataria', 'Outros'];
const SEVERITIES = ['Baixa', 'Média', 'Alta', 'Crítica'];

type Rule = {
  id: string; // 'new-xxx' se for nova, senao o ID do firestore
  title: string;
  description: string;
  category: string;
  type: string;
  severity: string;
  active: boolean;
  order: number;
  _deleted?: boolean; // flag local para delecao em lote
};

export default function CommunityAdminRulesPage() {
  const { id } = useParams();
  const { profile } = useAppStore();
  
  const [community, setCommunity] = useState<any>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!profile) return; // Wait for auth to resolve completely before fetching protected rules

    const fetchData = async () => {
      try {
        // 1. Fetch community settings
        const commSnap = await getDoc(doc(db, 'communities', id as string));
        if (commSnap.exists()) {
          setCommunity(commSnap.data());
        }
        
        // 2. Fetch subcollection rules
        const rulesSnap = await getDocs(collection(db, 'communities', id as string, 'rules'));
        const fetchedRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Rule));
        
        // se nao existir nenhuma regra estruturada, verificar se existe o array antigo `rules`
        if (fetchedRules.length === 0 && commSnap.data()?.rules?.length > 0) {
           // Migration temporaria em memoria
           const legacyRules = commSnap.data()?.rules.map((r: any, idx: number) => ({
               id: `new-migrated-${idx}`,
               title: r.title,
               description: r.description || '',
               category: 'Convivência',
               type: 'Respeito',
               severity: 'Média',
               active: true,
               order: idx
           }));
           setRules(legacyRules);
        } else {
           setRules(fetchedRules.sort((a, b) => a.order - b.order));
        }
      } catch (err) {
        console.error('Failed to load rules, likely auth timing issue:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, profile]);

  const toggleGate = () => {
    setCommunity(prev => ({ ...prev, gate_requireRulesAcceptance: !prev.gate_requireRulesAcceptance }));
    setHasChanges(true);
  }

  const addRule = () => {
    setRules([...rules, { 
      id: `new-${Date.now()}`, 
      title: '', 
      description: '',
      category: CATEGORIES[0],
      type: TYPES[0],
      severity: SEVERITIES[1],
      active: true,
      order: rules.length 
    }]);
    setHasChanges(true);
  };

  const removeRule = (idToRemove: string) => {
    setRules(rules.map(r => r.id === idToRemove ? { ...r, _deleted: true } : r));
    setHasChanges(true);
  };

  const updateRule = (idToUpdate: string, field: keyof Rule, value: any) => {
    setRules(rules.map(r => r.id === idToUpdate ? { ...r, [field]: value } : r));
    setHasChanges(true);
  };

  const moveRule = (index: number, direction: 'up' | 'down') => {
    const activeRules = rules.filter(r => !r._deleted);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === activeRules.length - 1) return;
    
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    // Swap in active bounds
    const newRules = [...rules];
    const trueIndex = newRules.findIndex(r => r.id === activeRules[index].id);
    const trueTargetIndex = newRules.findIndex(r => r.id === activeRules[targetIdx].id);

    [newRules[trueIndex], newRules[trueTargetIndex]] = [newRules[trueTargetIndex], newRules[trueIndex]];
    
    // Re-adjust order values for the entire active set to be strictly sequential
    let orderCounter = 0;
    newRules.forEach(r => {
      if (!r._deleted) {
        r.order = orderCounter++;
      }
    });

    setRules(newRules);
    setHasChanges(true);
  };

  const handlePublish = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      const nextVersion = (community.rules_currentVersion || 0) + 1;
      
      // 1. Update Community settings and bump version
      const communityRef = doc(db, 'communities', id as string);
      batch.update(communityRef, {
        gate_requireRulesAcceptance: community.gate_requireRulesAcceptance || false,
        rules_currentVersion: nextVersion,
        rules_lastUpdatedAt: serverTimestamp()
      });

      // 2. Write Rules
      const rulesRef = collection(db, 'communities', id as string, 'rules');
      rules.forEach(rule => {
        if (rule.id.startsWith('new-')) {
          if (!rule._deleted) {
            const newDocRef = doc(rulesRef);
            const { _deleted, id: _, ...ruleData } = rule;
            batch.set(newDocRef, { ...ruleData, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), authorId: profile.uid });
          }
        } else {
          const existingDocRef = doc(db, 'communities', id as string, 'rules', rule.id);
          if (rule._deleted) {
            batch.delete(existingDocRef);
          } else {
            const { _deleted, id: _, ...ruleData } = rule;
            batch.update(existingDocRef, { ...ruleData, updatedAt: serverTimestamp() });
          }
        }
      });

      await batch.commit();
      
      // Clean up local state after successful save
      setHasChanges(false);
      alert(`Version ${nextVersion} published successfully! Incoming members will see these terms.`);
      window.location.reload(); // Reload to fetch fresh clean IDs from backend
    } catch (e) {
      console.error(e);
      alert('Failed to publish. Check if you have Admin permissions.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  const activeRules = rules.filter(r => !r._deleted);

  return (
    <div className="space-y-8">
      {/* Sleek Header Dashboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-8 rounded-3xl border border-border/50 shadow-sm gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
             <div className="p-2.5 bg-primary/10 rounded-2xl">
               <ShieldAlert className="w-7 h-7 text-primary" />
             </div>
             Rules Governance
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px] max-w-xl">
            Version control for your community's code of conduct. Live Version: <strong className="text-foreground bg-muted px-2 py-0.5 rounded-md">v{community?.rules_currentVersion || 0}</strong>
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center w-full md:w-auto relative z-10">
          {/* Custom Beautiful Toggle */}
          <div 
            onClick={toggleGate}
            className="flex items-center justify-between sm:justify-start gap-4 p-3 bg-muted/30 rounded-2xl border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex flex-col">
              <span className="font-bold text-[15px] text-foreground leading-none">Gatekeeper</span>
              <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                {community?.gate_requireRulesAcceptance ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors duration-300 ${community?.gate_requireRulesAcceptance ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
              <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ${community?.gate_requireRulesAcceptance ? 'translate-x-5' : ''}`}></div>
            </div>
          </div>

          <button 
            onClick={handlePublish}
            disabled={saving || !hasChanges}
            className={`font-bold px-8 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 ${
              hasChanges && !saving 
                ? 'bg-primary text-white hover:bg-primary/90 shadow-xl shadow-primary/20 hover:-translate-y-0.5' 
                : 'bg-muted text-muted-foreground/50 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {hasChanges ? 'Publish Changes' : 'Up to date'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {activeRules.map((rule, idx) => (
          <div 
            key={rule.id} 
            className={`bg-white rounded-3xl overflow-hidden border shadow-sm transition-all duration-300 group ${
              rule.active ? 'border-border/50 hover:border-border hover:shadow-md' : 'border-dashed border-muted-foreground/30 opacity-60 grayscale-[50%]'
            }`}
          >
            <div className="flex flex-col md:flex-row items-stretch">
              
              {/* Left Handle & Number */}
              <div className="hidden md:flex flex-col items-center justify-center px-4 bg-muted/10 border-r border-border/50 gap-3 w-16 cursor-grab active:cursor-grabbing group-hover:bg-muted/30 transition-colors">
                 <button onClick={() => moveRule(idx, 'up')} disabled={idx===0} className="text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors">
                   ▲
                 </button>
                 <span className="font-extrabold text-foreground/40 text-lg">{idx + 1}</span>
                 <button onClick={() => moveRule(idx, 'down')} disabled={idx===activeRules.length-1} className="text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors">
                   ▼
                 </button>
              </div>
              
              {/* Main Content Area */}
              <div className="flex-1 p-6">
                
                {/* Top Row: Mobile handle + Title */}
                <div className="flex gap-4 items-center mb-5">
                   {/* Mobile Handle */}
                   <div className="md:hidden flex items-center justify-center cursor-grab active:cursor-grabbing opacity-50">
                     <GripVertical className="w-6 h-6" />
                   </div>
                   
                   <div className="flex-1">
                     <input 
                       type="text" 
                       placeholder="Enter rule title (e.g. Respect everyone)"
                       value={rule.title} 
                       onChange={(e) => updateRule(rule.id, 'title', e.target.value)}
                       className="w-full bg-transparent font-extrabold text-xl text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 rounded-xl px-3 py-2 -ml-3 transition-all placeholder:text-muted-foreground/40"
                     />
                   </div>
                   
                   {/* Action Buttons Top Right */}
                   <div className="flex items-center gap-2">
                     <button 
                       onClick={() => updateRule(rule.id, 'active', !rule.active)} 
                       className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${rule.active ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                       title={rule.active ? "Disable Rule" : "Enable Rule"}
                     >
                       <Settings2 className="w-5 h-5" />
                     </button>
                     <button 
                       onClick={() => removeRule(rule.id)} 
                       className="w-10 h-10 flex items-center justify-center rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                     >
                       <Trash2 className="w-5 h-5" />
                     </button>
                   </div>
                </div>

                {/* Description */}
                <textarea 
                   placeholder="Add detailed description... What exactly does this rule mean in practice?"
                   value={rule.description}
                   onChange={(e) => updateRule(rule.id, 'description', e.target.value)}
                   className="w-full px-4 py-3 bg-muted/20 border border-border/50 focus:border-border focus:bg-muted/40 outline-none focus:ring-4 focus:ring-primary/10 rounded-2xl resize-none text-muted-foreground text-[15px] mb-5 transition-all"
                   rows={2}
                />

                {/* Bottom Row: Badges / Selects */}
                <div className="flex flex-wrap items-center gap-3">
                   <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/50">
                     <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Category</span>
                     <select value={rule.category} onChange={(e) => updateRule(rule.id, 'category', e.target.value)} className="bg-transparent text-sm font-bold text-foreground outline-none cursor-pointer">
                       {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                   
                   <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/50">
                     <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Type</span>
                     <select value={rule.type} onChange={(e) => updateRule(rule.id, 'type', e.target.value)} className="bg-transparent text-sm font-bold text-foreground outline-none cursor-pointer">
                       {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                     </select>
                   </div>

                   <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${
                     rule.severity === 'Crítica' ? 'bg-red-50 border-red-200 text-red-700' : 
                     rule.severity === 'Alta' ? 'bg-orange-50 border-orange-200 text-orange-700' : 
                     'bg-blue-50 border-blue-200 text-blue-700'
                   }`}>
                     <span className="text-xs font-extrabold uppercase tracking-widest opacity-60">Severity</span>
                     <select value={rule.severity} onChange={(e) => updateRule(rule.id, 'severity', e.target.value)} className="bg-transparent text-sm font-extrabold outline-none cursor-pointer">
                       {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                   </div>
                </div>

              </div>
            </div>
          </div>
        ))}

        <button 
          onClick={addRule}
          className="w-full py-8 mt-6 border-2 border-dashed border-border/80 hover:border-primary/50 bg-white/40 hover:bg-primary/5 rounded-[2rem] font-bold text-muted-foreground hover:text-primary transition-all flex flex-col items-center justify-center gap-3 group shadow-sm"
        >
          <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center border border-border/50 group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6" /> 
          </div>
          <span className="text-lg">Assemble New Rule</span>
        </button>
      </div>
    </div>
  );
}
