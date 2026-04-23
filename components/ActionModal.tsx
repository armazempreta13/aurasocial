'use client';

import { motion, AnimatePresence } from 'motion/react';
import { X, Hash, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'info' | 'warning' | 'danger';
}

export function ActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'info'
}: ActionModalProps) {
  const { t } = useTranslation('common');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800"
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 ${
                variant === 'info' ? 'bg-primary/10 text-primary' : 
                variant === 'warning' ? 'bg-amber-100 text-amber-600' : 
                'bg-rose-100 text-rose-600'
              }`}>
                {variant === 'info' ? <Hash size={32} /> : <AlertCircle size={32} />}
              </div>

              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
                {title}
              </h3>
              
              <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed mb-8">
                {message}
              </p>

              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                >
                  {confirmLabel || t('common.confirm', 'Confirmar')}
                </button>
                
                <button
                  onClick={onClose}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold py-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                >
                  {cancelLabel || t('common.cancel', 'Cancelar')}
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
