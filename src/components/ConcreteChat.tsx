import React, { useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

// Read your function base URL from env
const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
if (!FN_BASE) {
  console.warn("Missing VITE_SUPABASE_FUNCTIONS_URL in .env, chat functionality may be limited");
}

async function askConcrete(question: string): Promise<{ answer: string }> {
  const res = await fetch(`${FN_BASE}/askConcrete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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

interface ConcreteChatProps {
  isModal?: boolean;
  onClose?: () => void;
}

export default function ConcreteChat({ isModal, onClose }: ConcreteChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const q = input.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);

    try {
      const { answer } = await askConcrete(q);
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (err: any) {
      console.error(err);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // For the persistent chat button
  if (!isModal) {
    if (!open) {
      return (
        <button
          onClick={() => setOpen(true)}
          className="p-3 bg-blue-600 rounded-full shadow-lg text-white hover:bg-blue-700 transition-colors"
          aria-label="Open chat"
        >
          💬
        </button>
      );
    }

    return (
      <div className="w-80 h-96 bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-4 bg-blue-600 text-white rounded-t-lg">
          <h2 className="text-lg font-semibold">Concrete Expert</h2>
          <button 
            onClick={() => setOpen(false)}
            className="text-xl font-bold text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto h-64 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p>Welcome! Ask me anything about concrete calculations, mix designs, or best practices.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-gray-500 italic">
              Thinking...
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <div className="flex space-x-2">
            <input
              className="flex-1 p-2 border rounded focus:outline-none focus:ring"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Ask about concrete..."
            />
            <button
              onClick={handleSend}
              className="px-4 bg-blue-600 text-white rounded"
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    );
  }

  // For the modal version
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>Welcome! Ask me anything about concrete calculations, mix designs, or best practices.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-gray-500 italic">
            Thinking...
          </div>
        )}
      </div>

      <div className="p-4 border-t mt-auto">
        <div className="flex space-x-2">
          <input
            className="flex-1 p-2 border rounded focus:outline-none focus:ring"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Ask about concrete..."
          />
          <button
            onClick={handleSend}
            className="px-4 bg-blue-600 text-white rounded"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}