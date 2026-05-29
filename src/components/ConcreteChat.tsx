import React, { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useProjectStore } from '../store';
import Button from './ui/Button';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  'Can I place today?',
  'Estimate crew size',
  'Ready mix order help',
  'Weather risks',
  'ACI guidance',
] as const;

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
if (!FN_BASE) {
  console.warn(
    'Missing VITE_SUPABASE_FUNCTIONS_URL in .env, chat functionality may be limited',
  );
}

let messageSeq = 0;
function nextMessageId(): string {
  messageSeq += 1;
  return `msg-${messageSeq}-${Date.now()}`;
}

async function askConcrete(question: string): Promise<{ answer: string }> {
  const res = await fetch(`${FN_BASE}/askConcrete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY!}`,
    },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Function error (${res.status}): ${errText}`);
  }

  return res.json();
}

function resolvePageLabel(pathname: string): string {
  if (pathname === '/' || pathname === '/dispatch' || pathname === '/qc') {
    return 'Dashboard';
  }
  if (pathname.startsWith('/projects')) return 'Projects';
  if (pathname.startsWith('/pour-planner')) return 'Placement Planner';
  if (pathname.startsWith('/mix-design-advisor')) return 'Mix Design Advisor';
  if (pathname.startsWith('/proposal-generator') || pathname.startsWith('/proposals')) {
    return 'Proposals';
  }
  if (pathname.startsWith('/calculator')) return 'Calculators';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/resources')) return 'Resources';
  return 'ConcreteCalc';
}

interface ConcreteChatProps {
  isModal?: boolean;
  onClose?: () => void;
}

function ChatPanel({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentProject } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const context = useMemo(() => {
    const pageLabel = resolvePageLabel(location.pathname);
    const projectName = currentProject?.name?.trim();
    return {
      pageLabel,
      projectName: projectName || null,
      contextLine: projectName
        ? `${pageLabel} · ${projectName}`
        : `${pageLabel} · No project selected`,
    };
  }, [location.pathname, currentProject?.name]);

  const sendMessage = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { id: nextMessageId(), role: 'user', content: q }]);
    setLoading(true);

    try {
      const { answer } = await askConcrete(q);
      setMessages((m) => [
        ...m,
        { id: nextMessageId(), role: 'assistant', content: answer },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(err);
      setMessages((m) => [
        ...m,
        { id: nextMessageId(), role: 'assistant', content: `Error: ${message}` },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  if (!user) {
    return (
      <div className="flex h-full flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-700">
        <ChatHeader onClose={onClose} />
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">
            Sign in to use ConcreteCalc AI
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Get placement, mix, labor, and ready-mix guidance tied to your projects.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/login')}>
              Sign In
            </Button>
            <Button onClick={() => navigate('/signup')}>Create Account</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
      <ChatHeader onClose={onClose} />

      <div className="border-b border-slate-700 bg-slate-900/80 px-4 py-3">
        <p className="text-xs uppercase tracking-widest text-slate-500">Project context</p>
        <p className="text-sm font-semibold text-white truncate">{context.contextLine}</p>
        {!context.projectName && (
          <p className="text-xs text-slate-500 mt-0.5">
            Select a project in Calculators or Projects for job-specific answers.
          </p>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 && (
          <>
            <div className="p-5 text-center border-b border-slate-800/80">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/20 text-2xl">
                🧱
              </div>
              <h4 className="text-lg font-bold text-white">Ask ConcreteCalc AI</h4>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Get help with concrete quantities, mix design, placement planning, labor,
                weather risk, rebar, and ready-mix ordering.
              </p>
            </div>

            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Quick questions
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-left text-sm text-slate-200 hover:border-blue-500 hover:bg-blue-950/40 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {messages.length > 0 && (
          <div className="space-y-3 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-700 bg-slate-800 text-slate-100'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-400 italic">
                  Thinking…
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-700 bg-slate-950/90 p-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ConcreteCalc AI…"
            rows={1}
            disabled={loading}
            className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 border-b border-blue-500/30 px-5 py-4 shrink-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-white font-bold text-lg leading-tight">ConcreteCalc AI</h3>
          <p className="text-blue-200 text-sm">Concrete placement assistant</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConcreteChat({ isModal, onClose }: ConcreteChatProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const handleClose = () => {
    if (onClose) onClose();
    else setOpen(false);
  };

  if (!isModal) {
    if (!user) return null;

    if (!open) {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 px-4 py-3 shadow-lg border border-blue-500/40 text-white hover:border-blue-400 transition-colors"
          aria-label="Open ConcreteCalc AI"
        >
          <span className="text-lg" aria-hidden>
            🧱
          </span>
          <span className="text-sm font-semibold hidden sm:inline">Ask AI</span>
        </button>
      );
    }

    return (
      <div className="w-[min(100vw-2rem,400px)] h-[min(32rem,85vh)]">
        <ChatPanel onClose={handleClose} />
      </div>
    );
  }

  return <ChatPanel onClose={handleClose} />;
}
