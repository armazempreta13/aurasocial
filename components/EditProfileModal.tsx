import { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { handleFirestoreError, OperationType } from '@/lib/firebase-errors';
import { uploadImage } from '@/lib/image-utils';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserData: any;
  onSave: (data: any) => void;
}

export function EditProfileModal({ isOpen, onClose, currentUserData, onSave }: EditProfileModalProps) {
  const { profile } = useAppStore();
  const [formData, setFormData] = useState({
    displayName: currentUserData?.displayName || '',
    bio: currentUserData?.bio || '',
    location: currentUserData?.location || '',
    education: currentUserData?.education || '',
    work: currentUserData?.work || '',
    relationship: currentUserData?.relationship || '',
    photoURL: currentUserData?.photoURL || '',
    coverURL: currentUserData?.coverURL || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<'photoURL' | 'coverURL' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (file: File, field: 'photoURL' | 'coverURL') => {
    if (!profile) return;
    
    setUploadingField(field);

    try {
      const result = await uploadImage(file);
      setFormData(prev => ({ ...prev, [field]: result.url }));
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Failed to upload image: ${error.message}`);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, formData);
      onSave(formData);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <h2 className="text-xl font-bold text-foreground">Edit Profile</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
          <form id="edit-profile-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Images Section */}
            <div className="flex flex-col gap-6">
              <h3 className="text-[15px] font-bold text-foreground">Profile Images</h3>
              
              {/* Profile Photo */}
              <div className="flex flex-col gap-3">
                <label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Profile Photo</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-muted overflow-hidden border-2 border-border/50 relative group">
                    {formData.photoURL ? (
                      <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}
                    {uploadingField === 'photoURL' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={!!uploadingField}
                        className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" /> Upload New
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({ ...formData, photoURL: '' })}
                        className="px-4 py-2 rounded-xl text-[13px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <input 
                      type="file" 
                      ref={photoInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'photoURL')}
                    />
                    <input 
                      type="url" 
                      name="photoURL"
                      value={formData.photoURL}
                      onChange={handleChange}
                      placeholder="Or paste image URL..." 
                      className="w-full bg-muted/30 border border-border/50 rounded-xl py-2 px-4 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Cover Photo */}
              <div className="flex flex-col gap-3">
                <label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Cover Photo</label>
                <div className="flex flex-col gap-3">
                  <div className="w-full h-32 rounded-xl bg-muted overflow-hidden border-2 border-border/50 relative group">
                    {formData.coverURL ? (
                      <img src={formData.coverURL} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-10 h-10" />
                      </div>
                    )}
                    {uploadingField === 'coverURL' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                          <span className="text-white text-[12px] font-bold">{Math.round(uploadProgress)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={!!uploadingField}
                      className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> Change Cover
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, coverURL: '' })}
                      className="px-4 py-2 rounded-xl text-[13px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <input 
                    type="file" 
                    ref={coverInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'coverURL')}
                  />
                  <input 
                    type="url" 
                    name="coverURL"
                    value={formData.coverURL}
                    onChange={handleChange}
                    placeholder="Or paste cover image URL..." 
                    className="w-full bg-muted/30 border border-border/50 rounded-xl py-2 px-4 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-border/50 w-full my-2"></div>

            {/* Details Section */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[15px] font-bold text-foreground">Personal Details</h3>
              
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Name</label>
                <input 
                  type="text" 
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  required
                  className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Bio</label>
                <textarea 
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Tell people about yourself..."
                  className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Location</label>
                  <input 
                    type="text" 
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="City, Country"
                    className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Education</label>
                  <input 
                    type="text" 
                    name="education"
                    value={formData.education}
                    onChange={handleChange}
                    placeholder="University or School"
                    className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Work</label>
                  <input 
                    type="text" 
                    name="work"
                    value={formData.work}
                    onChange={handleChange}
                    placeholder="Company or Role"
                    className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Relationship</label>
                  <input 
                    type="text" 
                    name="relationship"
                    value={formData.relationship}
                    onChange={handleChange}
                    placeholder="Single, Married, etc."
                    className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  />
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 bg-gray-50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-semibold text-[14px] text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="edit-profile-form"
            disabled={isSaving || !!uploadingField}
            className="px-8 py-2.5 rounded-xl font-semibold text-[14px] bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}
