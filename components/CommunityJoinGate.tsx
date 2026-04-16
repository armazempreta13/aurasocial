'use client';

import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, getDocs, orderBy, query, writeBatch, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Shield, Check, FileText, Loader2, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from 'react-i18next';

interface JoinGateProps {
  communityId: string;
  communityName: string;
  currentVersion: number;
  onAcceptSuccess: () => void;
  onCancel: () => void;
  forceOverlay?: boolean; // if true, user is already a member but needs to re-accept. Canceling kicks them out or blocks UI.
}

export default function CommunityJoinGate({ communityId, communityName, currentVersion, onAcceptSuccess, onCancel, forceOverlay }: JoinGateProps) {
  const { t } = useTranslation('common');
  const { profile } = useAppStore();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const q = query(
          collection(db, 'communities', communityId, 'rules'),
          orderBy('order', 'asc')
        );
        const snap = await getDocs(q);
        setRules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, [communityId]);

  const handleAccept = async () => {
    if (!profile || !checked) return;
    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Join Community (if not already)
      if (!forceOverlay) {
        batch.update(doc(db, 'communities', communityId), {
           members: arrayUnion(profile.uid)
           // ideally we'd bump memberCount but it requires transaction, skipping precise count for prototype
        });
      }

      // 2. Write Contract to Subcollection
      batch.set(doc(db, 'communities', communityId, 'rule_acceptances', profile.uid), {
         userId: profile.uid,
         rulesVersion: currentVersion,
         acceptedAt: serverTimestamp()
      });

      await batch.commit();
      onAcceptSuccess();
    } catch (e) {
      console.error(e);
      alert(t('gate.error', 'Failed to process acceptance. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Loader2 className="w-10 h-10 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-muted/30 p-8 border-b border-border/50 text-center relative shrink-0">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-foreground tracking-tight">{t('gate.title', 'Read and agree to our rules')}</h2>
          <p className="text-muted-foreground mt-2">
            {forceOverlay ? t('gate.subtitle_update', { name: communityName }) : t('gate.subtitle_join', { name: communityName })}
          </p>
        </div>

        {/* Rules Feed */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {rules.filter(r => r.active).map((rule, idx) => (
             <div key={rule.id} className="group">
                <div className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg mb-1">{rule.title}</h3>
                    {rule.description && (
                      <p className="text-muted-foreground text-sm leading-relaxed">{rule.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 bg-muted/30 px-2 py-0.5 rounded-full">{rule.category}</span>
                       <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${rule.severity === 'Crítica' ? 'border-red-200 text-red-600 bg-red-50' : rule.severity === 'Alta' ? 'border-orange-200 text-orange-600 bg-orange-50' : 'border-border/50 text-muted-foreground'}`}>{rule.severity} {t('gate.severity', 'Severity')}</span>
                    </div>
                  </div>
                </div>
             </div>
          ))}
          {rules.length === 0 && (
             <div className="text-center text-muted-foreground py-10">{t('gate.no_rules', 'No specific rules defined. Please use common sense.')}</div>
          )}
        </div>

        {/* Footer Accept */ }
        <div className="p-8 border-t border-border/50 bg-white shrink-0">
           <label className="flex items-start gap-3 cursor-pointer group mb-6">
              <div className={`mt-1 w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-primary border-primary text-white' : 'border-border group-hover:border-primary/50'}`}>
                 {checked && <Check className="w-4 h-4" />}
              </div>
              <span className="font-semibold text-foreground">
                {t('gate.agree', { name: communityName })}
              </span>
           </label>
           
           <div className="flex gap-3">
             {!forceOverlay && (
               <button 
                 onClick={onCancel}
                 className="flex-1 py-4 font-bold text-muted-foreground hover:bg-muted/50 rounded-2xl transition-colors"
               >
                 {t('gate.cancel', 'Cancel')}
               </button>
             )}
             <button 
               onClick={handleAccept}
               disabled={!checked || submitting}
               className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${checked && !submitting ? 'bg-primary text-white hover:bg-primary/90 shadow-xl shadow-primary/20' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
             >
               {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <> {forceOverlay ? t('gate.complete_update') : t('gate.complete_join')} <ArrowRight className="w-5 h-5" /></>}
             </button>
           </div>
        </div>

      </div>
    </div>
  );
}
