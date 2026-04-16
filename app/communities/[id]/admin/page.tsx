'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Save, Loader2, Image as ImageIcon } from 'lucide-react';

export default function CommunityAdminGeneralPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      const docSnap = await getDoc(doc(db, 'communities', id as string));
      if (docSnap.exists()) {
        setData(docSnap.data());
      }
      setLoading(false);
    };
    fetchDoc();
  }, [id]);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateDoc(doc(db, 'communities', id as string), {
        name: data.name,
        description: data.description,
        type: data.type,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null; // Let the layout show the loader if this mounts after

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">General Settings</h1>
        <p className="text-muted-foreground mt-1">Manage the identity, branding, and visibility of your community.</p>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-border/50 shadow-sm space-y-8">
        
        {/* Cover Photo / Appearance */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4">Appearance</h3>
          <div className="relative w-full h-48 bg-muted rounded-2xl border border-border/50 border-dashed overflow-hidden flex flex-col items-center justify-center group cursor-pointer hover:bg-muted/80 transition-colors">
            {data.image ? (
              <img src={data.image} className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" />
            ) : (
              <ImageIcon className="w-10 h-10 text-muted-foreground mb-2" />
            )}
            <div className="absolute opacity-0 group-hover:opacity-100 bg-black/60 text-white font-semibold px-4 py-2 rounded-full transition-opacity backdrop-blur-md">
              Change Cover Photo (Coming soon)
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="space-y-5">
           <div>
             <label className="block font-semibold text-foreground mb-2">Community Name</label>
             <input 
               type="text" 
               value={data.name || ''} 
               onChange={e => setData({...data, name: e.target.value})}
               className="w-full p-4 bg-muted/30 border border-border/50 rounded-xl focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-medium text-foreground"
             />
           </div>
           
           <div>
             <label className="block font-semibold text-foreground mb-2">Description</label>
             <textarea 
               value={data.description || ''} 
               onChange={e => setData({...data, description: e.target.value})}
               rows={4}
               className="w-full p-4 bg-muted/30 border border-border/50 rounded-xl focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all text-foreground resize-none"
             />
             <p className="text-sm text-muted-foreground mt-2">Describe what this community is about. This is visible to anyone checking out the group.</p>
           </div>
        </div>

        {/* Privacy */}
        <div className="pt-6 border-t border-border/50">
          <h3 className="text-lg font-bold text-foreground mb-4">Privacy & Visibility</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-4 p-4 border border-border/50 rounded-xl cursor-pointer hover:bg-muted/30 transition-colors">
              <input type="radio" name="visibility" value="Public" checked={data.type === 'Public'} onChange={() => setData({...data, type: 'Public'})} className="w-5 h-5 text-primary" />
              <div>
                <div className="font-bold text-foreground">Public Community</div>
                <div className="text-sm text-muted-foreground">Anyone can find the community and see members. Posts might be visible depending on rules.</div>
              </div>
            </label>
            <label className="flex items-center gap-4 p-4 border border-border/50 rounded-xl cursor-pointer hover:bg-muted/30 transition-colors">
              <input type="radio" name="visibility" value="Private" checked={data.type === 'Private'} onChange={() => setData({...data, type: 'Private'})} className="w-5 h-5 text-primary" />
              <div>
                <div className="font-bold text-foreground">Private Community</div>
                <div className="text-sm text-muted-foreground">Only members can see who's in the group and what they post. Membership is by approval.</div>
              </div>
            </label>
          </div>
        </div>

      </div>

      <div className="flex items-center justify-end gap-4 py-4">
        {saveSuccess && <span className="text-emerald-600 font-medium">Changes saved successfully!</span>}
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white font-bold px-8 py-3 rounded-full hover:bg-primary/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

    </div>
  );
}
