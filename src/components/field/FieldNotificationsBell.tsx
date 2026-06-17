import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Eye,
  FileText,
  MessageSquare,
  Send,
  X,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  dismissNotification,
  fetchNotifications,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  toFieldNotification,
} from '../../services/notificationService';
import type { AppNotification } from '../../lib/notificationTypes';
import { notificationSeverityClass } from '../../lib/notificationTypes';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

interface FieldNotificationsBellProps {
  buttonClassName?: string;
}

function NotificationIcon({ type }: { type: string }) {
  const className = 'mt-0.5 h-4 w-4 shrink-0 text-cyan-400';
  switch (type) {
    case 'proposal_accepted':
      return <CheckCircle2 className={className} aria-hidden />;
    case 'proposal_viewed':
      return <Eye className={className} aria-hidden />;
    case 'proposal_declined':
      return <XCircle className={className} aria-hidden />;
    case 'proposal_deposit_paid':
      return <DollarSign className={className} aria-hidden />;
    case 'proposal_sent':
      return <Send className={className} aria-hidden />;
    case 'task_submitted':
    case 'field_activity':
      return <ClipboardCheck className={className} aria-hidden />;
    case 'employee_message':
      return <MessageSquare className={className} aria-hidden />;
    case 'document_uploaded':
    case 'document_needs_review':
      return <FileText className={className} aria-hidden />;
    default:
      return <Bell className={className} aria-hidden />;
  }
}

export default function FieldNotificationsBell({
  buttonClassName = 'relative rounded-lg p-2 text-slate-300 hover:bg-slate-800',
}: FieldNotificationsBellProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [rows, count] = await Promise.all([
      listNotifications(user.id, 15),
      getUnreadNotificationCount(user.id),
    ]);
    setItems(rows);
    setUnreadCount(count);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user, open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative" data-testid="notifications-bell-root">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={['relative', buttonClassName].join(' ')}
        aria-label="Notifications"
        title="Notifications"
        data-testid="notifications-bell"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white"
            data-testid="notifications-unread-badge"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
          data-testid="notifications-panel"
        >
          <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
            <p className="text-xs font-semibold text-cyan-400">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-[11px] font-medium text-slate-400 hover:text-white"
                data-testid="notifications-mark-all-read"
                onClick={() => {
                  void markAllNotificationsRead(user.id).then(refresh);
                }}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {items.map((n) => {
              const legacy = toFieldNotification(n);
              const isUnread = !legacy.isRead;
              return (
                <li key={n.id} className="group border-b border-slate-800/80 last:border-b-0">
                  <div className="flex items-start gap-1">
                    <button
                      type="button"
                      className={`flex flex-1 gap-2 px-3 py-2 text-left text-sm hover:bg-slate-800 ${
                        isUnread ? 'text-white' : 'text-slate-400'
                      }`}
                      data-testid="notification-item"
                      onClick={() => {
                        setItems((current) =>
                          current.map((item) =>
                            item.id === n.id
                              ? { ...item, readAt: new Date().toISOString() }
                              : item,
                          ),
                        );
                        void markNotificationRead(n.id).then(refresh);
                        if (n.actionUrl) navigate(n.actionUrl);
                        setOpen(false);
                      }}
                    >
                      <NotificationIcon type={n.type} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`font-medium ${notificationSeverityClass(n.severity)}`}>
                            {n.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-500">
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </span>
                        {n.message ? (
                          <span className="mt-0.5 block text-xs text-slate-500">{n.message}</span>
                        ) : null}
                        {n.actionLabel ? (
                          <span className="mt-1 block text-[11px] font-medium text-cyan-400">
                            {n.actionLabel}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss notification"
                      className="mt-2 mr-2 rounded p-1 text-slate-500 opacity-0 transition-opacity hover:bg-slate-800 hover:text-white group-hover:opacity-100"
                      data-testid="notification-dismiss"
                      onClick={() => {
                        void dismissNotification(n.id).then(refresh);
                      }}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="px-3 py-4 text-sm text-slate-500" data-testid="notifications-empty">
                <p>No notifications yet.</p>
                <p className="mt-1 text-xs text-slate-600">
                  Important project updates will appear here.
                </p>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Backward-compatible export for tests that still import fetchNotifications via bell mocks. */
export { fetchNotifications };
