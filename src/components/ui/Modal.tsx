import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';
import {
  MODAL_BODY,
  MODAL_CLOSE_BTN,
  MODAL_HEADER,
  MODAL_PANEL,
  MODAL_TITLE,
} from '../../theme/appTheme';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Stack above planner task drawer (z 10050). */
  stackAboveDrawer?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  stackAboveDrawer = false,
}) => {
  if (title === 'Choose Estimate Type' || title === 'Change estimate type?' || title === 'Schedule tabs will be hidden') {
    // #region agent log
    fetch('http://127.0.0.1:7822/ingest/f8847b5c-ebf8-4ffb-8ef5-2ae8f29ce67d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0c8c0'},body:JSON.stringify({sessionId:'d0c8c0',runId:'change-button-pre-fix-1',hypothesisId:'H3,H4',location:'Modal.tsx:35',message:'shared modal received props',data:{title,isOpenType:typeof isOpen,isOpen:Boolean(isOpen),size,stackAboveDrawer},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  const prevIsOpen = useRef(isOpen);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      soundService.play('modal');
      hapticService.modal();
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const savedScrollY = window.scrollY;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundService.play('click');
        hapticService.button();
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      window.scrollTo(0, savedScrollY);
    };
  }, [isOpen]);

  const handleClose = () => {
    soundService.play('click');
    hapticService.button();
    onClose();
  };

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const overlayTransition = { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };
  const panelTransition = { type: 'spring' as const, damping: 28, stiffness: 300 };

  const modalContent = (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="modal-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={overlayTransition}
          className={
            stackAboveDrawer
              ? 'fixed inset-0 z-[10101] flex items-center justify-center overflow-hidden p-4'
              : 'fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4'
          }
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 1rem)',
            paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
            paddingLeft: 'max(env(safe-area-inset-left), 1rem)',
            paddingRight: 'max(env(safe-area-inset-right), 1rem)',
          }}
        >
          <motion.div
            role="presentation"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={panelTransition}
            className={`pointer-events-auto relative z-10 flex w-full max-h-[min(90dvh,100%)] flex-col ${MODAL_PANEL} ${sizeClasses[size]}`}
            onClick={(e) => e.stopPropagation()}
          >
              <div className={MODAL_HEADER}>
                <h2 className={MODAL_TITLE}>
                  {title}
                </h2>

                <button
                  type="button"
                  onClick={handleClose}
                  className={MODAL_CLOSE_BTN}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div
                className={`${MODAL_BODY}
                  [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:dark:text-white
                  [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:dark:text-white
                  [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:dark:text-white
                  [&_p]:leading-relaxed
                  [&_li]:leading-relaxed
                  [&_strong]:text-slate-900 [&_strong]:dark:text-white
                  [&_a]:text-blue-600 [&_a]:underline [&_a]:dark:text-blue-400
                  [&_hr]:border-slate-200 [&_hr]:dark:border-slate-700
                  [&_td]:text-slate-800 [&_td]:dark:text-slate-200
                  [&_th]:text-slate-900 [&_th]:dark:text-slate-100`}
              >
                {children}
              </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
