import React from 'react';
import Toast from '../../components/ui/Toast';

interface ToastManagerProps {
  show: boolean;
  msg: string;
  type: 'success' | 'error' | 'warning';
}

export default function ToastManager({ show, msg, type }: ToastManagerProps) {
  if (!show) return null;

  return (
    <Toast
      id="project-action"
      title={type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Warning'}
      message={msg}
      type={type}
      onClose={() => {}}
    />
  );
}