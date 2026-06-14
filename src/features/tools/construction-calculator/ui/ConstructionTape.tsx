import React, { useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import { useConstructionCalculatorTapeStore } from '../../../../store/constructionCalculatorTapeStore';
import { serializeTapeEntry } from '../domain/constructionCalculatorTape';
import { TEXT_MUTED } from '../../../../theme/appTheme';

interface ConstructionTapeProps {
  layout: 'desktop' | 'field';
}

export default function ConstructionTape({ layout }: ConstructionTapeProps) {
  const entries = useConstructionCalculatorTapeStore((s) => s.entries);
  const clearTape = useConstructionCalculatorTapeStore((s) => s.clearTape);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(layout === 'desktop');
  const isField = layout === 'field';

  const latestResult = entries.length > 0 ? entries[entries.length - 1].result : '';

  const handleCopy = async () => {
    if (!latestResult) return;
    try {
      await navigator.clipboard.writeText(latestResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const tapeContent = (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={`text-sm font-semibold ${isField ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
          Paperless tape
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!latestResult}
            icon={<Copy className="h-4 w-4" />}
            data-testid="tape-copy"
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTape}
            disabled={entries.length === 0}
            icon={<Trash2 className="h-4 w-4" />}
            data-testid="tape-clear"
          >
            Clear
          </Button>
        </div>
      </div>
      <ul
        className={`max-h-64 space-y-2 overflow-y-auto text-sm ${
          isField ? 'text-slate-300' : TEXT_MUTED
        }`}
        data-testid="construction-tape"
      >
        {entries.length === 0 && <li className="italic">No calculations yet.</li>}
        {[...entries].reverse().map((entry) => (
          <li key={entry.id} className="font-mono">
            <span>{entry.expression}</span>
            <span className={isField ? ' text-cyan-400' : ' text-cyan-700 dark:text-cyan-400'}>
              {' '}
              = {entry.result}
            </span>
          </li>
        ))}
      </ul>
    </>
  );

  if (isField) {
    return (
      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
        <button
          type="button"
          className="mb-2 w-full text-left text-sm font-medium text-slate-300"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? '▼' : '▶'} Tape ({entries.length})
        </button>
        {expanded && tapeContent}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-lg dark:border-slate-700/70 dark:bg-slate-900/85">
      {tapeContent}
    </div>
  );
}

export { serializeTapeEntry };
