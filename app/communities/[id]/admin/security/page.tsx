'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Lock, Save, Loader2, ShieldCheck, UserCheck } from 'lucide-react';

export default function CommunityAdminSecurityPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState({
    requireApproval: false,
    restrictPosting: false,
    postRequiresApproval: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      const docSnap = await getDoc(doc(db, 'communities', id as string));
      if (docSnap.exists()) {
        const d = docSnap.data();
        setData({
          requireApproval: d.security?.requireApproval || false,
          restrictPosting: d.security?.restrictPosting || false,
          postRequiresApproval: d.security?.postRequiresApproval || false,
        });
      }
      setLoading(false);
    };
    fetchDoc();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'communities', id as string), {
        security: data
      });
      alert('Security settings updated!');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Security & Join</h1>
          <p className="text-muted-foreground mt-1">Control who can join and how they interact.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white font-bold px-6 py-2.5 rounded-full hover:bg-primary/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Security
        </button>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-border/50 shadow-sm space-y-8">
        
        <div className="space-y-4">
          <label className={`flex items-start gap-4 p-5 border rounded-2xl cursor-pointer transition-all ${data.requireApproval ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:bg-muted/30'}`}>
            <input 
              type="checkbox" 
              checked={data.requireApproval} 
              onChange={e => setData({...data, requireApproval: e.target.checked})} 
              className="mt-1 w-5 h-5 text-primary rounded" 
            />
            <div>
              <div className="font-bold text-foreground text-lg flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" /> Require Approval to Join
              </div>
              <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                When enabled, new members will be added to a waitlist. An Admin or Moderator must manually approve their entrance before they can see the feed.
              </div>
            </div>
          </label>

          <label className={`flex items-start gap-4 p-5 border rounded-2xl cursor-pointer transition-all ${data.restrictPosting ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:bg-muted/30'}`}>
            <input 
              type="checkbox" 
              checked={data.restrictPosting} 
              onChange={e => setData({...data, restrictPosting: e.target.checked})} 
              className="mt-1 w-5 h-5 text-primary rounded" 
            />
            <div>
              <div className="font-bold text-foreground text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Restrict Posting to Approved Members
              </div>
              <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                If checked, only members with a "Trusted" badge or higher can create new posts. Normal users can only comment. (Badge system coming soon).
              </div>
            </div>
          </label>

          <label className={`flex items-start gap-4 p-5 border rounded-2xl cursor-pointer transition-all ${data.postRequiresApproval ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:bg-muted/30'}`}>
            <input
              type="checkbox"
              checked={data.postRequiresApproval}
              onChange={e => setData({ ...data, postRequiresApproval: e.target.checked })}
              className="mt-1 w-5 h-5 text-primary rounded"
            />
            <div>
              <div className="font-bold text-foreground text-lg flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" /> Aprovar posts antes de publicar
              </div>
              <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Quando ativado, posts de membros comuns ficam como "pendentes" atÃ© um Admin/Mod aprovar.
              </div>
            </div>
          </label>
        </div>

      </div>
    </div>
  );
}
