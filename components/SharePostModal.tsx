import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SharePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (caption: string) => void;
  postAuthor: string;
  postContent: string;
}

export function SharePostModal({ isOpen, onClose, onConfirm, postAuthor, postContent }: SharePostModalProps) {
  const { t } = useTranslation('common');
  const [caption, setCaption] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (caption.length <= 2000) {
          onConfirm(caption);
          onClose();
        }
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, caption, onConfirm, onClose]);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Modal Content container to assist in centering */}
      <div className="flex min-h-full items-center justify-center w-full">
        <div className="relative w-full max-w-[540px] bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-300 pointer-events-auto">
          <div className="p-5 sm:p-7 border-b border-border/50 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Share2 className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-foreground">
                {t('share_modal.title', 'Share this post')}
              </h3>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-all active:scale-90"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-5 sm:p-7 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.1em] ml-1">
                {t('share_modal.caption_label', 'Add a caption (optional)')}
              </label>
              <textarea
                autoFocus
                id="share-modal-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t('share_modal.placeholder', 'What do you think about this?')}
                className="w-full bg-slate-50 border-2 border-transparent focus:border-primary/20 rounded-[22px] p-5 text-[16px] focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all min-h-[140px] resize-none placeholder:text-muted-foreground/50"
              />
              <div className="flex justify-end pr-2">
                <span className={`text-[10px] font-bold ${caption.length > 1800 ? 'text-red-500' : 'text-muted-foreground/40'}`}>
                  {caption.length} / 2000
                </span>
              </div>
            </div>

            <div className="bg-slate-50/80 rounded-[28px] p-6 border border-border/40 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
              <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.15em] mb-3">
                {t('share_modal.preview', 'Sharing post by')} {postAuthor}
              </p>
              <div className="relative">
                <p className="text-[15px] text-foreground/80 leading-relaxed line-clamp-3 italic">
                  "{postContent}"
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 gap-4">
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-100/80 text-[13px] font-bold text-slate-600">
                <Globe className="w-4 h-4 text-slate-400" />
                {t('post_card.public', 'Public')}
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-2xl font-bold text-muted-foreground hover:bg-slate-100 transition-all active:scale-95"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    onConfirm(caption);
                    onClose();
                  }}
                  disabled={caption.length > 2000}
                  className="px-10 py-3 rounded-2xl bg-primary text-white font-bold hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {t('common.share', 'Share Now')}
                  <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-black items-center justify-center">Ctrl+↵</kbd>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
