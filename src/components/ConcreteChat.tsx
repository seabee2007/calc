import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useProjectStore } from '../store';
import Button from './ui/Button';
import { buildChatProjectContext } from '../utils/chatProjectContext';
import ChatMarkdownMessage from './chat/ChatMarkdownMessage';
import AssistantMessageActions from './chat/AssistantMessageActions';

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

async function askConcrete(input: {
  question: string;
  pageLabel?: string;
  projectContext?: string | null;
}): Promise<{ answer: string }> {
  const res = await fetch(`${FN_BASE}/askConcrete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY!}`,
    },
    body: JSON.stringify(input),
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
  const { projects, currentProject, loadProjects } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  useEffect(() => {
    if (projects.length === 0) {
      void loadProjects();
    }
  }, [projects.length, loadProjects]);

  useEffect(() => {
    if (currentProject?.id) {
      setSelectedProjectId(currentProject.id);
    }
  }, [currentProject?.id]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const projectContextText = useMemo(
    () => buildChatProjectContext(selectedProject),
    [selectedProject],
  );

  const context = useMemo(() => {
    const pageLabel = resolvePageLabel(location.pathname);
    const projectName = selectedProject?.name?.trim();
    return {
      pageLabel,
      projectName: projectName || null,
      contextLine: projectName
        ? `${pageLabel} · ${projectName}`
        : `${pageLabel} · No project selected`,
    };
  }, [location.pathname, selectedProject?.name]);

  const sendMessage = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { id: nextMessageId(), role: 'user', content: q }]);
    setLoading(true);

    try {
      const { answer } = await askConcrete({
        question: q,
        pageLabel: context.pageLabel,
        projectContext: projectContextText,
      });
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

      <div className="border-b border-slate-700 bg-slate-900/80 px-4 py-3 space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">Project context</p>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          aria-label="Select project for AI context"
        >
          <option value="">No project — general guidance</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <p className="text-sm font-semibold text-white truncate">{context.contextLine}</p>
        {!context.projectName && (
          <p className="text-xs text-slate-500">
            Choose a project above for job-specific placement, mix, and order answers.
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
          <div className="space-y-4 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'user' ? (
                  <div className="max-w-[85%] rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white whitespace-pre-wrap">
                    {message.content}
                  </div>
                ) : (
                  <div className="w-full max-w-full rounded-2xl border border-slate-700 bg-slate-800/95 px-4 py-3 shadow-sm">
                    <ChatMarkdownMessage content={message.content} />
                    {!message.content.startsWith('Error:') && (
                      <AssistantMessageActions
                        content={message.content}
                        projectId={selectedProjectId || undefined}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-400 italic">
                  Analyzing placement factors…
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
          <Button
            type="button"
            variant="accent"
            onClick={() => void sendMessage()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="!h-11 !w-11 !min-h-0 shrink-0 !px-0"
          >
            <Send className="h-4 w-4" />
          </Button>
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
        <div className="fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6">
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
        </div>
      );
    }

    return (
      <div className="fixed inset-x-3 bottom-3 z-50 flex h-[min(36rem,85vh)] max-h-[85vh] flex-col sm:inset-x-auto sm:bottom-6 sm:right-6 sm:left-auto sm:w-[520px] sm:max-w-[calc(100vw-2rem)]">
        <ChatPanel onClose={handleClose} />
      </div>
    );
  }

  return <ChatPanel onClose={handleClose} />;
}
