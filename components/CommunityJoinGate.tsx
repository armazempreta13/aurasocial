'use client';

import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import {
  collection,
  getDocs,
  orderBy,
  query,
  writeBatch,
  doc,
  serverTimestamp,
  arrayUnion,
  increment,
} from 'firebase/firestore';
import { Check, FileText, Loader2, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from 'react-i18next';

interface JoinGateProps {
  communityId: string;
  communityName: string;
  currentVersion: number;
  requireApproval?: boolean;
  onAcceptSuccess: () => void;
  onCancel: () => void;
  forceOverlay?: boolean;
}

export default function CommunityJoinGate({
  communityId,
  communityName,
  currentVersion,
  requireApproval,
  onAcceptSuccess,
  onCancel,
  forceOverlay,
}: JoinGateProps) {
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
          orderBy('order', 'asc'),
        );
        const snap = await getDocs(q);
        setRules(snap.docs.map((communityRule) => ({ id: communityRule.id, ...communityRule.data() })));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    void fetchRules();
  }, [communityId]);

  const handleAccept = async () => {
    if (!profile || !checked) return;
    setSubmitting(true);

    try {
      const batch = writeBatch(db);

      if (!forceOverlay) {
        if (requireApproval) {
          batch.set(doc(db, 'community_requests', `${communityId}_${profile.uid}`), {
            communityId,
            userId: profile.uid,
            status: 'pending',
            createdAt: serverTimestamp(),
          });
        } else {
          batch.update(doc(db, 'communities', communityId), {
            members: arrayUnion(profile.uid),
            memberCount: increment(1),
            updatedAt: serverTimestamp(),
          });
          batch.set(doc(db, 'communities', communityId, 'members', profile.uid), {
            uid: profile.uid,
            memberSince: serverTimestamp(),
          });
        }
      }

      batch.set(doc(db, 'communities', communityId, 'rule_acceptances', profile.uid), {
        userId: profile.uid,
        rulesVersion: currentVersion,
        acceptedAt: serverTimestamp(),
      });

      await batch.commit();
      onAcceptSuccess();
    } catch (error) {
      console.error(error);
      alert(t('gate.error', 'Falha ao confirmar a leitura das regras. Tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="shrink-0 border-b border-border/50 bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            {t('gate.title', 'Leia e aceite as regras')}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {forceOverlay
              ? t('gate.subtitle_update', { name: communityName })
              : t('gate.subtitle_join', { name: communityName })}
          </p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-8">
          {rules.filter((rule) => rule.active).map((rule, index) => (
            <div key={rule.id}>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/50 text-sm font-bold text-muted-foreground">
                  {index + 1}
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-bold text-foreground">{rule.title}</h3>
                  {rule.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">{rule.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-muted/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                      {rule.category}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                        rule.severity === 'Crítica'
                          ? 'border-red-200 bg-red-50 text-red-600'
                          : rule.severity === 'Alta'
                            ? 'border-orange-200 bg-orange-50 text-orange-600'
                            : 'border-border/50 text-muted-foreground'
                      }`}
                    >
                      {rule.severity} {t('gate.severity', 'gravidade')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">
              {t('gate.no_rules', 'Nenhuma regra específica definida. Use o bom senso.')}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/50 bg-white p-8">
          <label
            className="group mb-6 flex cursor-pointer items-start gap-3"
            onClick={() => setChecked((current) => !current)}
          >
            <div
              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                checked ? 'border-primary bg-primary text-white' : 'border-border group-hover:border-primary/50'
              }`}
            >
              {checked && <Check className="h-4 w-4" />}
            </div>
            <span className="font-semibold text-foreground">
              {t('gate.agree', { name: communityName })}
            </span>
          </label>

          <div className="flex gap-3">
            {!forceOverlay && (
              <button
                onClick={onCancel}
                className="flex-1 rounded-2xl py-4 font-bold text-muted-foreground transition-colors hover:bg-muted/50"
              >
                {t('gate.cancel', 'Cancelar')}
              </button>
            )}
            <button
              onClick={handleAccept}
              disabled={!checked || submitting}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 font-bold transition-all ${
                checked && !submitting
                  ? 'bg-primary text-white shadow-xl shadow-primary/20 hover:bg-primary/90'
                  : 'cursor-not-allowed bg-muted text-muted-foreground'
              }`}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {forceOverlay
                    ? t('gate.complete_update', 'Confirmar atualização')
                    : t('gate.complete_join', 'Entrar na comunidade')}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
