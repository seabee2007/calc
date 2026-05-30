import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchNotifications, markNotificationRead } from '../../services/notificationService';
import type { FieldNotification } from '../../types/fieldPlanner';
import { useNavigate } from 'react-router-dom';

export default function FieldNotificationsBell() {
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
        className="relative rounded-lg p-2 text-slate-300 hover:bg-slate-800"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
          <p className="border-b border-slate-700 px-3 py-2 text-xs font-semibold text-cyan-400">
            Notifications
          </p>
          <ul className="max-h-64 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-800 ${
                    n.isRead ? 'text-slate-400' : 'text-white'
                  }`}
                  onClick={() => {
                    void markNotificationRead(n.id);
                    if (n.href) navigate(n.href);
                    setOpen(false);
                  }}
                >
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
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
