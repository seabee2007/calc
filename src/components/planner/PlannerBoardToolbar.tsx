import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function PlannerBoardToolbar() {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
      <div className="relative">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          disabled
        >
          Group by Bucket
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}
