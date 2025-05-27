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
      // Supabase anonymous key for auth; your function has CORS=* so the browser will allow it
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY!}`,
    },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Function error (${res.status}): ${errText}`);
  }

  return res.json(); // { answer: string }
}

export default function ConcreteChat() {
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

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="p-3 bg-blue-600 rounded-full shadow-lg text-white"
          aria-label="Open chat"
        >
          💬
        </button>
      ) : (
        <div className="flex flex-col w-80 h-96 bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between p-2 bg-blue-600 text-white rounded-t-lg">
            <span>Concrete Expert</span>
            <button onClick={() => setOpen(false)} className="text-lg">
              ✕
            </button>
          </div>

          <div className="flex-1 p-2 overflow-y-auto space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "text-right" : "text-left"}
              >
                <div
                  className={`inline-block p-2 rounded-lg ${
                    m.role === "user" ? "bg-blue-100" : "bg-gray-100"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div className="italic text-gray-500">typing…</div>}
          </div>

          <div className="p-2 border-t">
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
      )}
    </div>
  );
}