import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import DefinitionSearch from './DefinitionSearch';
import {
  DEFINITION_CATEGORIES,
  filterDefinitions,
  findDefinitionByTerm,
  type DefinitionCategoryId,
} from './definitions';
import { useDefinitionsHelpStore } from './definitionsHelpStore';

export default function DefinitionsHelpModal() {
  const isOpen = useDefinitionsHelpStore((state) => state.isOpen);
  const focusTerm = useDefinitionsHelpStore((state) => state.focusTerm);
  const close = useDefinitionsHelpStore((state) => state.close);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<DefinitionCategoryId | 'all'>('all');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveCategory('all');
      return;
    }

    if (focusTerm) {
      setQuery(focusTerm);
      const match = findDefinitionByTerm(focusTerm);
      if (match) {
        setActiveCategory(match.category);
      }
    }
  }, [focusTerm, isOpen]);

  const filteredDefinitions = useMemo(
    () =>
      filterDefinitions({
        query,
        category: activeCategory,
        focusTerm: focusTerm && !query ? focusTerm : undefined,
      }),
    [activeCategory, focusTerm, query],
  );

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [close, isOpen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const categoryLabelById = new Map(DEFINITION_CATEGORIES.map((category) => [category.id, category.label]));

  return createPortal(
    <div className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/60 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        role="dialog"
        aria-labelledby="definitions-help-title"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div>
            <h2 id="definitions-help-title" className="text-lg font-semibold text-white">
              Definitions & Help
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Plain-language explanations for estimating, scheduling, and project terms.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close definitions help"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <DefinitionSearch
          query={query}
          activeCategory={activeCategory}
          onQueryChange={setQuery}
          onCategoryChange={setActiveCategory}
          resultCount={filteredDefinitions.length}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {filteredDefinitions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/60 px-4 py-8 text-center text-sm text-slate-400">
              No definitions found. Try another search word or category.
            </p>
          ) : (
            <ul className="space-y-4">
              {filteredDefinitions.map((definition) => (
                <li
                  key={definition.term}
                  className="rounded-lg border border-slate-700 bg-slate-950/50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{definition.term}</h3>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-300">
                      {categoryLabelById.get(definition.category) ?? definition.category}
                    </span>
                    {definition.relatedArea ? (
                      <span className="rounded-full bg-cyan-950 px-2 py-0.5 text-[11px] text-cyan-300">
                        {definition.relatedArea}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-200">{definition.shortDefinition}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{definition.plainEnglish}</p>

                  {definition.example ? (
                    <p className="mt-2 text-sm text-slate-400">
                      <span className="font-medium text-slate-300">Example:</span> {definition.example}
                    </p>
                  ) : null}

                  {definition.aliases && definition.aliases.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Also called: {definition.aliases.join(', ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-700 px-5 py-3 text-xs text-slate-500">
          More guides and walkthroughs are coming soon.
        </div>
      </div>
    </div>,
    document.body,
  );
}
