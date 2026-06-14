import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import AppPage from '../components/ui/AppPage';
import PageHeader from '../components/ui/PageHeader';
import ResourceHubCategoryCard from '../features/resources/ui/ResourceHubCategoryCard';
import {
  RESOURCE_FILTER_TYPE_LABELS,
  RESOURCE_HUB_CATEGORIES,
} from '../features/resources/resourceCatalog';
import { PREMIUM_INNER_PANEL } from '../theme/appTheme';

export default function ResourcesHubPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <AppPage data-testid="resources-hub-page">
        <PageHeader
          title="Resources"
          subtitle="Printable forms, calculation references, estimating tables, and field guides for construction project teams."
          className="mb-8"
        />

        <div
          className={`mb-8 rounded-xl border border-dashed border-slate-300/80 p-4 dark:border-slate-600/80 ${PREMIUM_INNER_PANEL}`}
          aria-hidden={false}
        >
          <label htmlFor="resources-search-stub" className="sr-only">
            Search resources
          </label>
          <input
            id="resources-search-stub"
            type="search"
            disabled
            placeholder="Search resources (coming soon)"
            className="mb-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
          />
          <div className="flex flex-wrap gap-2">
            {RESOURCE_FILTER_TYPE_LABELS.map((label) => (
              <span
                key={label}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {RESOURCE_HUB_CATEGORIES.map((category) => (
            <ResourceHubCategoryCard key={category.id} category={category} />
          ))}
        </div>
      </AppPage>
    </motion.div>
  );
}
