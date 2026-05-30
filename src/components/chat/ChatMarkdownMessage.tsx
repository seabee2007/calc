import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMarkdownMessageProps {
  content: string;
}

const ChatMarkdownMessage: React.FC<ChatMarkdownMessageProps> = ({ content }) => (
  <div className="chat-markdown text-sm leading-relaxed text-slate-100">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
      h3: ({ children }) => (
        <h3 className="mt-4 mb-2 text-sm font-bold text-cyan-300 first:mt-0">{children}</h3>
      ),
      h4: ({ children }) => (
        <h4 className="mt-3 mb-1.5 text-sm font-semibold text-cyan-200">{children}</h4>
      ),
      p: ({ children }) => (
        <p className="mb-2 last:mb-0 text-sm leading-relaxed text-slate-100">{children}</p>
      ),
      ul: ({ children }) => (
        <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-slate-100">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-slate-100">{children}</ol>
      ),
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      strong: ({ children }) => (
        <strong className="font-semibold text-white">{children}</strong>
      ),
      em: ({ children }) => <em className="text-slate-200">{children}</em>,
      hr: () => <hr className="my-3 border-slate-600" />,
      code: ({ children }) => (
        <code className="rounded bg-slate-900/80 px-1 py-0.5 text-xs text-cyan-200">
          {children}
        </code>
      ),
    }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

export default ChatMarkdownMessage;
