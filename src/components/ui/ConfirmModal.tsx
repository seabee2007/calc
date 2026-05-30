import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';

export type ConfirmVariant = 'danger' | 'success' | 'primary';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: ConfirmVariant;
  showWarningIcon?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const confirmButtonClass: Record<ConfirmVariant, string> = {
  danger: '',
  primary: '',
  success:
    '!bg-emerald-600 hover:!bg-emerald-500 active:!bg-emerald-700 dark:!bg-emerald-600 dark:hover:!bg-emerald-500',
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  showWarningIcon = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const titleId = useId();
  const descId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);
  onCancelRef.current = onCancel;
  onConfirmRef.current = onConfirm;

  useEffect(() => {
    if (isOpen) {
      void soundService.play('modal');
      void hapticService.modal();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const savedScrollY = window.scrollY;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void soundService.play('click');
        void hapticService.button();
        onCancelRef.current();
        return;
      }
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        void soundService.play('click');
        void hapticService.button();
        onConfirmRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => confirmRef.current?.focus(), 50);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      window.scrollTo(0, savedScrollY);
    };
  }, [isOpen]);

  const buttonVariant =
    confirmVariant === 'danger' ? 'danger' : 'primary';

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
            onClick={() => onCancel()}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
            style={{
              paddingTop: 'max(env(safe-area-inset-top), 1rem)',
              paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
            }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descId}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', damping: 22 }}
              className="pointer-events-auto w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-3">
                {showWarningIcon && (
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400"
                    aria-hidden
                  >
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="text-lg font-semibold text-slate-100">
                    {title}
                  </h2>
                  <p id={descId} className="mt-2 text-sm text-slate-300 whitespace-pre-line">
                    {message}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={onCancel}>
                  {cancelLabel}
                </Button>
                <Button
                  ref={confirmRef}
                  type="button"
                  variant={buttonVariant}
                  className={confirmButtonClass[confirmVariant]}
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
