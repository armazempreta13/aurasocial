'use client';

import { useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Video, Hash, Sparkles, X, Upload, Loader2, Globe, Users, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firebase-errors';
import { uploadImage, UploadResult } from '@/lib/image-utils';
import { extractHashtags } from '@/lib/hashtags';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

export function CreatePost({ communityId, communityName }: { communityId?: string, communityName?: string }) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const { profile } = useAppStore();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageMetadata, setImageMetadata] = useState<UploadResult | null>(null);
  const [showImageInput, setShowImageInput] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hashtags = useMemo(() => extractHashtags(content), [content]);

  const handleFileUpload = async (file: File) => {
    if (!profile) return;
    
    setIsUploading(true);
    try {
      const result = await uploadImage(file);
      setImageUrl(result.url);
      setImageMetadata(result);
      setShowImageInput(false);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if ((!content.trim() && !imageUrl.trim()) || !profile || isSubmitting || isUploading) return;
    
    setIsSubmitting(true);

    // OPTIMISTIC UX LAYER (Instant appearance)
    const tempId = 'optimistic_' + Date.now();
    const optimisticPost = {
      id: tempId,
      authorId: profile.uid,
      authorName: profile.displayName || 'Anonymous',
      authorPhoto: profile.photoURL || '',
      content: content.trim(),
      hashtags,
      imageUrl: imageUrl.trim() || null,
      hasImage: !!imageUrl.trim(),
      visibility: communityId ? 'friends' : visibility,
      communityId: communityId || null,
      communityName: communityName || null,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      score: 0,
      createdAt: Date.now(),
      _isOptimistic: true
    };

    // Update Cache Immediately
    queryClient.setQueryData(['posts', undefined, communityId, 'posts', ''], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page: any, idx: number) => {
          if (idx === 0) {
            return { ...page, docs: [{ id: tempId, data: () => optimisticPost }, ...page.docs] };
          }
          return page;
        })
      };
    });

    try {
      await addDoc(collection(db, 'posts'), {
        ...optimisticPost,
        _isOptimistic: false, // Turn off for remote
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      setContent('');
      setImageUrl('');
      setImageMetadata(null);
      setShowImageInput(false);
      
      // Sync finalize
      queryClient.invalidateQueries({ queryKey: ['posts'] });

      // BROADCAST SYNC (Part 6)
      if (typeof window !== 'undefined') {
        const syncChannel = new BroadcastChannel('aura_feed_sync');
        syncChannel.postMessage({ type: 'invalidate_posts' });
        syncChannel.close();
      }
    } catch (error) {
      // Revert cache on fail
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className={`relative bg-white rounded-[28px] shadow-[0_12px_40px_rgba(0,0,0,0.03)] p-6 mb-10 border transition-all duration-300 ${isDragging ? 'border-[#7a63f1] bg-[#7a63f1]/5 scale-[1.01]' : 'border-slate-100'}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0 ring-2 ring-transparent">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium">
              {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="bg-slate-50 rounded-[22px] px-6 py-5 flex items-center cursor-text hover:bg-white transition-all border border-slate-100 focus-within:border-[#7a63f1]/40 focus-within:bg-white focus-within:shadow-[0_12px_36px_rgba(122,99,241,0.12)]">
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={communityName ? `Post in ${communityName}...` : profile?.displayName ? t('create_post.placeholder', { name: profile.displayName.split(' ')[0] }) : t('create_post.placeholder_anon', 'Share your thoughts...')}
              className="bg-transparent w-full focus:outline-none text-[15px] text-foreground placeholder:text-muted-foreground resize-none min-h-[40px]"
              rows={content.split('\n').length}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#8a94a6] bg-slate-50 w-fit px-3 py-1.5 rounded-lg border border-slate-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {t('create_post.hashtag_tip', 'As hashtags são detectadas automaticamente e alimentam o sistema de tendências.')}
            </div>
            {hashtags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1 transition-all">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-full bg-[#7a63f1]/10 text-[#7a63f1] text-[12px] font-bold border border-[#7a63f1]/20 shadow-sm"
                  >
                    #{tag.replace('#', '')}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 font-medium pl-1">
                {t('create_post.add_tags_example', 'Adicione tags no seu texto como #design ou #frontend.')}
              </p>
            )}
          </div>
          
          {isUploading && (
            <div className="mt-2 p-4 bg-muted/30 rounded-xl border border-border/50 flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm font-medium text-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Optimizing & Uploading...
                </div>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-full"></div>
              </div>
            </div>
          )}

          {showImageInput && !isUploading && (
            <div className="mt-2 flex flex-col gap-3 p-4 bg-muted/30 rounded-xl border border-dashed border-border animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-bold text-foreground">Add Photo/Video</h4>
                <button onClick={() => setShowImageInput(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex flex-col gap-3">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-border/50 rounded-xl bg-white hover:bg-primary/5 hover:border-primary/30 cursor-pointer transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-[14px] font-semibold text-foreground">Click to upload or drag and drop</p>
                  <p className="text-[12px] text-muted-foreground mt-1">Images and videos supported</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={onFileSelect} 
                    className="hidden" 
                    accept="image/*,video/*"
                  />
                </div>
                
                <div className="relative flex items-center">
                  <div className="flex-1 h-px bg-border/50"></div>
                  <span className="px-3 text-[12px] text-muted-foreground font-medium">OR</span>
                  <div className="flex-1 h-px bg-border/50"></div>
                </div>

                <input 
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste an image URL here..."
                  className="w-full bg-white border border-border/50 rounded-xl px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                />
              </div>
            </div>
          )}
          
          {imageUrl && !isUploading && (
            <div className="mt-2 relative rounded-xl overflow-hidden border border-border/50 group">
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover max-h-[400px]" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <button 
                onClick={() => setImageUrl('')}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/40 mt-3">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button 
            type="button"
            onClick={() => setShowImageInput(!showImageInput)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-[16px] font-bold text-[13px] transition-all hover:scale-[1.03] active:scale-95 ${showImageInput || imageUrl ? 'bg-[#7a63f1] text-white shadow-[0_8px_20px_rgba(122,99,241,0.2)]' : 'bg-slate-50 text-slate-500 hover:text-[#7a63f1] hover:bg-[#7a63f1]/5 border border-slate-100'}`}
          >
            <ImageIcon className="w-4.5 h-4.5" /> <span>{t('create_post.photo_video', 'Foto/Vídeo')}</span>
          </button>
          
          <button type="button" className="flex items-center gap-2.5 px-4 py-2.5 rounded-[16px] bg-sky-50 text-sky-600 hover:bg-sky-100 font-bold text-[13px] transition-all hover:scale-[1.05] active:scale-95 border border-sky-100/50 shadow-sm">
            <Video className="w-4.5 h-4.5" /> <span>{t('create_post.live', 'Ao Vivo')}</span>
          </button>
          
          <button type="button" className="flex items-center gap-2.5 px-4 py-2.5 rounded-[16px] bg-amber-50 text-amber-600 hover:bg-amber-100 font-bold text-[13px] transition-all hover:scale-[1.05] active:scale-95 border border-amber-100/50 shadow-sm">
            <Sparkles className="w-4.5 h-4.5" /> <span>{t('create_post.activity', 'Sentimentos')}</span>
          </button>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="relative group/privacy">
            <select 
              value={visibility} 
              onChange={(e) => setVisibility(e.target.value as any)}
              className="appearance-none bg-muted/40 hover:bg-muted text-foreground text-[12px] font-black pl-8 pr-8 py-2.5 rounded-2xl border border-border/20 focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all min-w-[110px]"
            >
              <option value="public">{t('privacy.public', 'Public')}</option>
              <option value="friends">{t('privacy.friends', 'Friends')}</option>
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#7a63f1]">
              {visibility === 'public' ? <Globe className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          
          <button 
            onClick={handleSubmit} 
            disabled={(!content.trim() && !imageUrl.trim()) || isSubmitting || isUploading} 
            className="bg-gradient-to-r from-[#7a63f1] to-[#6c55e0] text-white px-10 py-3 rounded-[20px] font-black text-[15px] transition-all disabled:opacity-50 disabled:grayscale shadow-[0_12px_24px_-8px_rgba(122,99,241,0.6)] active:scale-95 whitespace-nowrap hover:shadow-[0_15px_30px_-8px_rgba(122,99,241,0.7)] hover:-translate-y-0.5"
          >
            {isSubmitting ? t('create_post.posting', 'Postando...') : t('create_post.button', 'Publicar')}
          </button>
        </div>
      </div>
      
      {isDragging && (
        <div className="absolute inset-0 z-10 bg-primary/10 backdrop-blur-[2px] rounded-2xl flex items-center justify-center pointer-events-none border-4 border-dashed border-primary animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Upload className="w-8 h-8 animate-bounce" />
            </div>
            <p className="text-xl font-bold text-foreground">Drop to upload</p>
          </div>
        </div>
      )}
    </div>
  );
}
