import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { soundService } from '../../services/soundService';

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
  success: 'border-green-500 bg-green-50 dark:bg-green-900/50',
  error: 'border-red-500 bg-red-50 dark:bg-red-900/50',
  info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/50',
  warning: 'border-amber-500 bg-amber-50 dark:bg-amber-900/50',
};

const Toast: React.FC<ToastProps> = ({
  id,
  title,
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  useEffect(() => {
    // Play sound when toast appears
    soundService.play(type);

    if (duration === Infinity) return;
    
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, id, onClose, type]);
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <motion.div
        className={`max-w-sm w-full shadow-lg rounded-lg pointer-events-auto overflow-hidden border ${toastStyles[type]} mx-4`}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3">
              {toastIcons[type]}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
              {message && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{message}</p>}
            </div>
            <button
              onClick={() => onClose(id)}
              className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
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