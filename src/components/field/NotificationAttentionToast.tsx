import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  dismissNotification,
  listOwnerAttentionNotifications,
  markNotificationRead,
} from '../../services/notificationService';
import type { AppNotification } from '../../lib/notificationTypes';
import Button from '../ui/Button';

const SHOWN_TOAST_KEY = 'arden_notification_toast_shown';

function readShownToastIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SHOWN_TOAST_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistShownToastId(id: string): void {
  const shown = readShownToastIds();
  shown.add(id);
  sessionStorage.setItem(SHOWN_TOAST_KEY, JSON.stringify([...shown]));
}

export default function NotificationAttentionToast() {
  const { user, isOwner } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState<AppNotification | null>(null);

  const loadToast = useCallback(async () => {
    if (!user || !isOwner) {
      setToast(null);
      return;
    }

    const candidates = await listOwnerAttentionNotifications(user.id, 5);
    const shown = readShownToastIds();
    const next = candidates.find((item) => !shown.has(item.id)) ?? null;
    setToast(next);
  }, [user, isOwner]);

  useEffect(() => {
    void loadToast();
  }, [loadToast]);

  if (!toast) return null;

  const handleDismiss = () => {
    persistShownToastId(toast.id);
    void dismissNotification(toast.id).finally(() => {
      setToast(null);
      void loadToast();
    });
  };

  const handleOpen = () => {
    persistShownToastId(toast.id);
    void markNotificationRead(toast.id);
    if (toast.actionUrl) navigate(toast.actionUrl);
    setToast(null);
    void loadToast();
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex justify-center px-4"
      data-testid="notification-attention-toast"
    >
      <div className="pointer-events-auto w-full max-w-xl rounded-xl border border-amber-500/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-300">{toast.title}</p>
            <p className="mt-1 text-sm text-slate-200">{toast.message}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification toast"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            data-testid="notification-attention-dismiss"
            onClick={handleDismiss}
          >
            ×
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {toast.actionUrl ? (
            <Button variant="accent" size="sm" data-testid="notification-attention-open" onClick={handleOpen}>
              {toast.actionLabel ?? 'Open'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
