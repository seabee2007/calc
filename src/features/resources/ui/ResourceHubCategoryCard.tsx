import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { ResourceCategory } from '../resourceCatalog';
import { getResourceCategoryIcon } from '../resourceCategoryIcons';
import { PREMIUM_PANEL } from '../../../theme/appTheme';

interface ResourceHubCategoryCardProps {
  category: ResourceCategory;
}

export default function ResourceHubCategoryCard({ category }: ResourceHubCategoryCardProps) {
  const navigate = useNavigate();
  const Icon = getResourceCategoryIcon(category.icon);
  const isAvailable = category.status !== 'coming-soon';

  const handleClick = () => {
    if (!isAvailable) return;
    window.scrollTo(0, 0);
    navigate(category.route);
  };

  return (
    <article
      className={`flex h-full flex-col rounded-xl border p-5 transition-shadow ${PREMIUM_PANEL} ${
        isAvailable
          ? 'cursor-pointer hover:shadow-lg focus-within:ring-2 focus-within:ring-cyan-500/40'
          : 'opacity-90'
      }`}
      data-testid={`resource-category-${category.id}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            isAvailable
              ? 'bg-cyan-600/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400'
              : 'bg-slate-200/80 text-slate-500 dark:bg-slate-700/80 dark:text-slate-400'
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        {category.status === 'coming-soon' ? (
          <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Coming soon
          </span>
        ) : null}
      </div>

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{category.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {category.description}
      </p>

      {isAvailable ? (
        <button
          type="button"
          onClick={handleClick}
          className="mt-4 inline-flex items-center text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          Open
          <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
        </button>
      ) : (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          This library is being prepared for a future release.
        </p>
      )}
    </article>
  );
}
