import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import {
  CALCULATOR_HELP_CHIPS,
  CALCULATOR_HELP_MODAL_SUBTITLE,
  CALCULATOR_HELP_MODAL_TITLE,
  CALCULATOR_HELP_SECTIONS,
  type CalculatorHelpChip,
  type CalculatorHelpSection,
} from './constructionCalculatorHelpContent';

interface ConstructionCalculatorHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: 'desktop' | 'field';
}

function FormulaBlock({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-1.5">
      {lines.map((line) => (
        <li
          key={line}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function BulletList({ items, label }: { items: string[]; label: string }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </h4>
      <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-700 dark:text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function HelpSectionBody({ section }: { section: CalculatorHelpSection }) {
  return (
    <div className="space-y-3 pt-1">
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{section.description}</p>
      {section.formulas && section.formulas.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Formulas
          </h4>
          <FormulaBlock lines={section.formulas} />
        </div>
      )}
      {section.inputs && section.inputs.length > 0 && <BulletList label="Inputs" items={section.inputs} />}
      {section.outputs && section.outputs.length > 0 && (
        <BulletList label="Outputs" items={section.outputs} />
      )}
      {section.examples && section.examples.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Examples
          </h4>
          <FormulaBlock lines={section.examples} />
        </div>
      )}
      {section.notes && section.notes.length > 0 && (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Notes
          </h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-amber-900 dark:text-amber-100/90">
            {section.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HelpSectionAccordion({
  section,
  expanded,
  onToggle,
  sectionRef,
  isDesktop,
}: {
  section: CalculatorHelpSection;
  expanded: boolean;
  onToggle: () => void;
  sectionRef: (el: HTMLElement | null) => void;
  isDesktop: boolean;
}) {
  const showBody = isDesktop || expanded;

  return (
    <section
      id={`help-section-${section.id}`}
      ref={sectionRef}
      className="scroll-mt-4 border-b border-slate-200 last:border-b-0 dark:border-slate-700/70"
      data-testid={`help-section-${section.id}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 py-3 text-left md:py-2"
        aria-expanded={showBody}
      >
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{section.title}</span>
        <span className="text-slate-400 md:hidden" aria-hidden>
          {expanded ? '−' : '+'}
        </span>
      </button>
      {showBody && (
        <div className="pb-4">
          <HelpSectionBody section={section} />
        </div>
      )}
    </section>
  );
}

export default function ConstructionCalculatorHelpModal({
  isOpen,
  onClose,
  layout,
}: ConstructionCalculatorHelpModalProps) {
  const isField = layout === 'field';
  const [activeChip, setActiveChip] = useState<CalculatorHelpChip | null>(null);
  const [selectedId, setSelectedId] = useState<string>('core-dimension-math');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(['core-dimension-math']));
  const [isDesktop, setIsDesktop] = useState(false);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const visibleSections =
    activeChip === null
      ? CALCULATOR_HELP_SECTIONS
      : CALCULATOR_HELP_SECTIONS.filter((s) => s.chip === activeChip);

  // Selecting a section must always reveal it. Clear any active chip filter so a
  // section hidden by the filter can't leave unrelated content on screen
  // (e.g. selecting "Blocks" while the Circle filter still shows "Cone Volume").
  const focusSection = useCallback((sectionId: string) => {
    setSelectedId(sectionId);
    // Accordion mode (mobile/field) focuses a single section so the selected
    // nav item and the displayed content always match.
    setExpandedIds(new Set([sectionId]));
    requestAnimationFrame(() => {
      const el = sectionRefs.current.get(sectionId);
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const selectSection = useCallback(
    (sectionId: string) => {
      const target = CALCULATOR_HELP_SECTIONS.find((s) => s.id === sectionId);
      // Clear a chip filter that would otherwise hide the chosen section and
      // leave unrelated content on screen.
      setActiveChip((current) => (target && current && target.chip !== current ? null : current));
      focusSection(sectionId);
    },
    [focusSection],
  );

  const handleChipClick = (chip: CalculatorHelpChip) => {
    const next = activeChip === chip ? null : chip;
    setActiveChip(next);
    const first = CALCULATOR_HELP_SECTIONS.find((s) => (next === null ? true : s.chip === chip));
    if (first) {
      focusSection(first.id);
    }
  };

  const toggleSection = (id: string) => {
    setSelectedId(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={CALCULATOR_HELP_MODAL_TITLE}
      size="xl"
      panelClassName="max-h-[85vh]"
    >
      <div data-testid="calculator-help-modal" className="-mt-1 flex max-h-[calc(85vh-5rem)] flex-col">
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">{CALCULATOR_HELP_MODAL_SUBTITLE}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {CALCULATOR_HELP_CHIPS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleChipClick(id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeChip === id
                  ? 'bg-cyan-600 text-white'
                  : isField
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 gap-6 overflow-hidden">
          <nav
            className="hidden w-44 shrink-0 flex-col gap-0.5 overflow-y-auto pr-2 md:flex"
            aria-label="Help sections"
          >
            {CALCULATOR_HELP_SECTIONS.map((section) => {
              const isSelected = selectedId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  data-testid={`help-nav-${section.id}`}
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={() => selectSection(section.id)}
                  className={`rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                    isSelected
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  {section.title}
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {visibleSections.map((section) => (
              <HelpSectionAccordion
                key={section.id}
                section={section}
                expanded={expandedIds.has(section.id)}
                onToggle={() => toggleSection(section.id)}
                sectionRef={(el) => {
                  if (el) sectionRefs.current.set(section.id, el);
                  else sectionRefs.current.delete(section.id);
                }}
                isDesktop={isDesktop}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
