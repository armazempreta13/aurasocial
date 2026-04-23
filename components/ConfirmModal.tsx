import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirmar', 
  cancelText = 'Cancelar',
  variant = 'danger'
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') {
        onConfirm();
        onClose();
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
  }, [isOpen, onConfirm, onClose]);

  if (!isOpen || !mounted) return null;

  const variantStyles = {
    danger: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      button: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200',
      icon: <Trash2 className="w-6 h-6" />,
      border: 'border-rose-100'
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
      icon: <AlertTriangle className="w-6 h-6" />,
      border: 'border-amber-100'
    },
    info: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      button: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200',
      icon: <AlertTriangle className="w-6 h-6" />,
      border: 'border-indigo-100'
    }
  };

  const currentVariant = variantStyles[variant];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-[400px] bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
      >
        <div className="p-8 pb-6 flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-2xl ${currentVariant.bg} ${currentVariant.text} flex items-center justify-center mb-5 border-2 ${currentVariant.border} shadow-sm`}>
            {currentVariant.icon}
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            {title}
          </h3>
          
          <p className="text-slate-500 text-[15px] leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3.5 rounded-2xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-6 py-3.5 rounded-2xl text-white font-bold text-sm transition-all active:scale-95 shadow-lg ${currentVariant.button}`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
