import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import {
  BORDER_DEFAULT,
  FOCUS_RING,
  MODAL_CLOSE_BTN,
  SURFACE_ELEVATED,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../../theme/appTheme';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number;
  onClose: (id: string) => void;
}

const toastIcons = {
  success: <CheckCircle className="h-6 w-6 text-green-500" />,
  error: <AlertCircle className="h-6 w-6 text-red-500" />,
  info: <Info className="h-6 w-6 text-blue-500" />,
  warning: <AlertTriangle className="h-6 w-6 text-amber-500" />,
};

const toastStyles = {
  success: `border-emerald-500 ${SURFACE_ELEVATED}`,
  error: `border-red-500 ${SURFACE_ELEVATED}`,
  info: `border-blue-500 ${SURFACE_ELEVATED}`,
  warning: `border-amber-500 ${SURFACE_ELEVATED}`,
};

const Toast: React.FC<ToastProps> = ({
  id,
  title,
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // Remove toast sound - user requested no toast sounds
    // soundService.play(type);

    if (duration === Infinity) return;
    
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, id, onClose, type]);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        className={`pointer-events-auto mx-4 w-full max-w-sm overflow-hidden rounded-lg border shadow-lg ${toastStyles[type]} ${BORDER_DEFAULT}`}
        initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={prefersReducedMotion ? undefined : { scale: 0.9, opacity: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="p-4">
          <div className="flex items-start">
            <div className="mr-3 flex-shrink-0">
              {toastIcons[type]}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-medium ${TEXT_FOREGROUND}`}>{title}</h3>
              {message ? <p className={`mt-1 text-sm ${TEXT_BODY}`}>{message}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => onClose(id)}
              aria-label="Dismiss notification"
              className={`ml-4 flex-shrink-0 ${MODAL_CLOSE_BTN} ${FOCUS_RING}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Toast;