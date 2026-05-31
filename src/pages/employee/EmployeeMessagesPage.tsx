import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchMessagesForUser,
  markMessageRead,
  sendFieldMessage,
} from '../../services/fieldMessageService';
import type { FieldMessage } from '../../types/fieldPlanner';
import { fetchAssignedProjects } from '../../services/employeeService';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';

export default function EmployeeMessagesPage() {
  const { user, isOwner } = useAuth();
  const [messages, setMessages] = useState<FieldMessage[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!user) return;
    const msgs = await fetchMessagesForUser(user.id, isOwner);
    setMessages(msgs);
    if (!isOwner) {
      const p = await fetchAssignedProjects(user.id);
      setProjects(p.map((x) => ({ id: x.id, name: x.name })));
      if (!projectId && p[0]) setProjectId(p[0].id);
    }
  };

  useEffect(() => {
    void reload();
  }, [user, isOwner]);

  const handleSend = async () => {
    if (!user || !projectId || !text.trim()) return;
    setBusy(true);
    try {
      await sendFieldMessage({
        projectId,
        senderId: user.id,
        message: text.trim(),
      });
      setText('');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Messages</h1>

      <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-lg border p-3 ${
              m.isRead ? 'border-slate-700 bg-slate-800/50' : 'border-cyan-500/40 bg-cyan-950/20'
            }`}
          >
            <p className="text-xs text-slate-400">
              {m.projectName} · {m.senderName}
            </p>
            <p className="text-sm text-slate-100 mt-1">{m.message}</p>
            <p className="text-xs text-slate-500 mt-1">
              {new Date(m.createdAt).toLocaleString()}
            </p>
            {!m.isRead && m.recipientId === user?.id && (
              <button
                type="button"
                className="mt-2 text-xs text-cyan-400"
                onClick={() => void markMessageRead(m.id).then(reload)}
              >
                Mark read
              </button>
            )}
          </li>
        ))}
        {messages.length === 0 && <p className="text-sm text-slate-500">No messages.</p>}
      </ul>

      {!isOwner && projects.length > 0 && (
        <div className="space-y-2 border-t border-slate-700 pt-4">
          <Select
            label="Project"
            value={projectId}
            onChange={setProjectId}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message to office…"
            rows={3}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          />
          <Button
            variant="accent"
            fullWidth
            className="min-h-[48px]"
            onClick={() => void handleSend()}
            disabled={busy}
          >
            Send
          </Button>
        </div>
      )}
    </div>
  );
}
