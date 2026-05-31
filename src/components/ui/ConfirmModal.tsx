import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useModalLayer } from '../../hooks/useModalLayer';
import Button from './Button';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';
import {
  MODAL_PANEL,
  MODAL_TITLE,
  TEXT_BODY,
} from '../../theme/appTheme';

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
  success: '',
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

  useModalLayer(isOpen, onCancel);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
    const t = window.setTimeout(() => confirmRef.current?.focus(), 50);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const buttonVariant =
    confirmVariant === 'danger'
      ? 'danger'
      : confirmVariant === 'success'
        ? 'success'
        : 'primary';

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal-overlay bg-black/50 backdrop-blur-sm"
            onClick={() => onCancel()}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-modal flex items-center justify-center p-4 pointer-events-none"
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
              className={`pointer-events-auto w-full max-w-md p-5 ${MODAL_PANEL}`}
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
                  <h2 id={titleId} className={MODAL_TITLE}>
                    {title}
                  </h2>
                  <p id={descId} className={`mt-2 text-sm whitespace-pre-line ${TEXT_BODY}`}>
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
