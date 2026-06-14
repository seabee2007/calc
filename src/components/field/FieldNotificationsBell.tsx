import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Eye,
  Send,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchNotifications, markNotificationRead } from '../../services/notificationService';
import type { FieldNotification } from '../../types/fieldPlanner';
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
      return <ClipboardCheck className={className} aria-hidden />;
    default:
      return <Bell className={className} aria-hidden />;
  }
}

export default function FieldNotificationsBell({
  buttonClassName = 'relative rounded-lg p-2 text-slate-300 hover:bg-slate-800',
}: FieldNotificationsBellProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FieldNotification[]>([]);

  useEffect(() => {
    if (!user) return;
    void fetchNotifications(user.id, 15).then(setItems);
  }, [user, open]);

  const unread = items.filter((n) => !n.isRead).length;

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={['relative', buttonClassName].join(' ')}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
          <p className="border-b border-slate-700 px-3 py-2 text-xs font-semibold text-cyan-400">
            Notifications
          </p>
          <ul className="max-h-64 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`flex w-full gap-2 px-3 py-2 text-left text-sm hover:bg-slate-800 ${
                    n.isRead ? 'text-slate-400' : 'text-white'
                  }`}
                  onClick={() => {
                    setItems((current) =>
                      current.map((item) =>
                        item.id === n.id ? { ...item, isRead: true } : item,
                      ),
                    );
                    void markNotificationRead(n.id);
                    if (n.href) navigate(n.href);
                    setOpen(false);
                  }}
                >
                  <NotificationIcon type={n.type} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-medium">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-slate-500">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </span>
                    {n.body ? <span className="mt-0.5 block text-xs text-slate-500">{n.body}</span> : null}
                  </span>
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-3 py-4 text-sm text-slate-500">No notifications</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
