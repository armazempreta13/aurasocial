'use client';

import { X, ChevronLeft, ChevronRight, Download, Share2, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  authorName?: string;
  authorPhoto?: string;
  content?: string;
  likesCount?: number;
  commentsCount?: number;
}

export function Lightbox({ isOpen, onClose, imageUrl, authorName, authorPhoto, content, likesCount = 0, commentsCount = 0 }: LightboxProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoaded(false);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/95 flex flex-col lg:flex-row"
      >
        {/* Main Image Area */}
        <div className="relative flex-1 flex items-center justify-center p-4 lg:p-8">
          <button 
            onClick={onClose}
            className="absolute top-4 left-4 z-[210] w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <motion.img 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            src={imageUrl} 
            alt="Full size" 
            className="max-w-full max-h-full object-contain shadow-2xl"
            onLoad={() => setIsLoaded(true)}
          />

          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Sidebar (Facebook-like) */}
        <div className="w-full lg:w-[360px] bg-white h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                {authorPhoto ? (
                  <img src={authorPhoto} alt={authorName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground font-bold">
                    {authorName?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <div className="font-bold text-foreground leading-tight">{authorName}</div>
                <div className="text-[12px] text-muted-foreground">Just now</div>
              </div>
            </div>
            <button className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {content && (
              <p className="text-[15px] text-foreground mb-6 whitespace-pre-wrap leading-relaxed">
                {content}
              </p>
            )}
            
            <div className="flex items-center gap-4 text-muted-foreground text-sm mb-4">
              <button className="flex items-center gap-1 hover:text-primary transition-colors">
                <Download className="w-4 h-4" /> Save
              </button>
              <button className="flex items-center gap-1 hover:text-primary transition-colors">
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>

          {/* Footer/Actions */}
          <div className="p-4 border-t border-border/50 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 text-primary font-bold text-sm">
                👍 {likesCount}
              </div>
              <div className="text-muted-foreground text-sm">
                {commentsCount} Comments
              </div>
            </div>
            <div className="flex border-y border-border/50 py-1 mb-4">
              <button className="flex-1 py-2 flex items-center justify-center gap-2 text-muted-foreground hover:bg-muted rounded-lg font-bold text-sm transition-colors">
                Like
              </button>
              <button className="flex-1 py-2 flex items-center justify-center gap-2 text-muted-foreground hover:bg-muted rounded-lg font-bold text-sm transition-colors">
                Comment
              </button>
              <button className="flex-1 py-2 flex items-center justify-center gap-2 text-muted-foreground hover:bg-muted rounded-lg font-bold text-sm transition-colors">
                Share
              </button>
            </div>
            
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
                {/* Current user photo would go here */}
              </div>
              <div className="flex-1 bg-muted rounded-full px-3 py-1.5 text-sm text-muted-foreground">
                Write a comment...
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
