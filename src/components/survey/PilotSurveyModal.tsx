import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { AUTH_ACCENT, authInputClassName } from '../auth/authBrandTheme';
import {
  EMPTY_PILOT_SURVEY,
  formValuesFromResponse,
  getMyPilotSurveyResponse,
  upsertMyPilotSurveyResponse,
} from '../../services/pilotSurveyService';
import type { PilotSurveyFormValues } from '../../types/pilotSurvey';
import {
  MOST_USEFUL_FEATURE_OPTIONS,
  WORK_ROLE_OPTIONS,
  YES_MAYBE_NO_OPTIONS,
  YES_SOMEWHAT_NO_OPTIONS,
} from '../../types/pilotSurvey';

interface PilotSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function SurveyToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[10060] -translate-x-1/2 rounded-full border border-cyan-400/30 bg-slate-950/95 px-4 py-2 text-sm text-cyan-100 shadow-lg shadow-cyan-950/40"
    >
      {message}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className={`text-sm font-semibold uppercase tracking-[0.18em] ${AUTH_ACCENT.brandLabel}`}>
      {children}
    </h3>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-sm font-medium text-slate-200">{children}</label>;
}

function SurveyTextarea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className={`${authInputClassName} min-h-[88px] w-full resize-y px-3 py-2`}
    />
  );
}

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option;
        return (
          <label
            key={option}
            className={`cursor-pointer rounded-xl border px-3 py-2 text-sm transition-colors ${
              selected
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                : 'border-white/10 bg-slate-950/70 text-slate-300 hover:border-cyan-400/30 hover:bg-slate-900/80'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={selected}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}

export default function PilotSurveyModal({ isOpen, onClose }: PilotSurveyModalProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [form, setForm] = useState<PilotSurveyFormValues>(EMPTY_PILOT_SURVEY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingResponse, setHasExistingResponse] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const setField = <K extends keyof PilotSurveyFormValues>(key: K, value: PilotSurveyFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    async function loadSurvey() {
      try {
        setLoading(true);
        setError(null);
        const existing = await getMyPilotSurveyResponse();
        if (!active) return;
        if (existing) {
          setForm(formValuesFromResponse(existing));
          setHasExistingResponse(true);
        } else {
          setForm(EMPTY_PILOT_SURVEY);
          setHasExistingResponse(false);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load your survey.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSurvey();
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, saving]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await upsertMyPilotSurveyResponse(form);
      setHasExistingResponse(true);
      setToast('Thank you — your feedback was submitted.');
      window.setTimeout(() => onClose(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your feedback. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <AnimatePresence mode="wait">
      {isOpen ? (
        <motion.div
          key="pilot-survey-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center"
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 0px)',
            paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
            paddingLeft: 'max(env(safe-area-inset-left), 0px)',
            paddingRight: 'max(env(safe-area-inset-right), 0px)',
          }}
        >
          <button
            type="button"
            aria-label="Close survey"
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              if (!saving) onClose();
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="relative z-10 flex h-[96dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:h-[min(92dvh,900px)] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${AUTH_ACCENT.brandLabel}`}>
                  Pilot Program
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                  Arden Project OS Pilot Survey
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!saving) onClose();
                }}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {hasExistingResponse ? (
              <div className="border-b border-cyan-400/20 bg-cyan-500/10 px-5 py-3 text-sm text-cyan-100 sm:px-6">
                Your feedback was submitted. You can update your answers anytime.
              </div>
            ) : null}

            <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                {loading ? (
                  <p className="text-sm text-slate-300">Loading your survey...</p>
                ) : (
                  <div className="space-y-8">
                    {error ? (
                      <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
                        {error}
                      </p>
                    ) : null}

                    <section className="space-y-4">
                      <SectionTitle>About You</SectionTitle>
                      <div>
                        <FieldLabel>What type of work do you do?</FieldLabel>
                        <Select
                          options={[
                            { value: '', label: 'Select one' },
                            ...WORK_ROLE_OPTIONS.map((option) => ({ value: option, label: option })),
                          ]}
                          value={form.workRole}
                          onChange={(value) => setField('workRole', value)}
                          fullWidth
                          className={authInputClassName}
                        />
                      </div>
                      <div>
                        <FieldLabel>
                          What do you currently use for estimating, scheduling, or project tracking?
                        </FieldLabel>
                        <SurveyTextarea
                          value={form.currentTools}
                          onChange={(value) => setField('currentTools', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>What kind of project did you test in Arden Project OS?</FieldLabel>
                        <SurveyTextarea
                          value={form.testedProjectType}
                          onChange={(value) => setField('testedProjectType', value)}
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <SectionTitle>First Impression</SectionTitle>
                      <div>
                        <FieldLabel>What was your first impression of the app?</FieldLabel>
                        <SurveyTextarea
                          value={form.firstImpression}
                          onChange={(value) => setField('firstImpression', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Did the app feel professional and trustworthy?</FieldLabel>
                        <RadioGroup
                          name="professionalTrustRating"
                          options={YES_SOMEWHAT_NO_OPTIONS}
                          value={form.professionalTrustRating}
                          onChange={(value) => setField('professionalTrustRating', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>What was confusing when you first opened the app?</FieldLabel>
                        <SurveyTextarea
                          value={form.initialConfusion}
                          onChange={(value) => setField('initialConfusion', value)}
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <SectionTitle>Ease of Use</SectionTitle>
                      <div>
                        <FieldLabel>Was it easy to find what you were looking for?</FieldLabel>
                        <RadioGroup
                          name="easyToFind"
                          options={YES_SOMEWHAT_NO_OPTIONS}
                          value={form.easyToFind}
                          onChange={(value) => setField('easyToFind', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Which feature or page was hardest to find?</FieldLabel>
                        <SurveyTextarea
                          value={form.hardestFeatureToFind}
                          onChange={(value) => setField('hardestFeatureToFind', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Did the workflow make sense from start to finish?</FieldLabel>
                        <RadioGroup
                          name="workflowMakesSense"
                          options={YES_SOMEWHAT_NO_OPTIONS}
                          value={form.workflowMakesSense}
                          onChange={(value) => setField('workflowMakesSense', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Where did the workflow feel slow, confusing, or hard to use?</FieldLabel>
                        <SurveyTextarea
                          value={form.workflowConfusingParts}
                          onChange={(value) => setField('workflowConfusingParts', value)}
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <SectionTitle>Design and Navigation</SectionTitle>
                      <div>
                        <FieldLabel>Was the app easy to read and navigate?</FieldLabel>
                        <RadioGroup
                          name="easyToReadNavigate"
                          options={YES_SOMEWHAT_NO_OPTIONS}
                          value={form.easyToReadNavigate}
                          onChange={(value) => setField('easyToReadNavigate', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Did any screen look crowded, unclear, or unfinished?</FieldLabel>
                        <SurveyTextarea
                          value={form.crowdedOrUnfinishedScreen}
                          onChange={(value) => setField('crowdedOrUnfinishedScreen', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>What screen or feature looked the best?</FieldLabel>
                        <SurveyTextarea
                          value={form.bestScreenOrFeature}
                          onChange={(value) => setField('bestScreenOrFeature', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>What screen or feature needs the most improvement?</FieldLabel>
                        <SurveyTextarea
                          value={form.needsImprovementScreenOrFeature}
                          onChange={(value) => setField('needsImprovementScreenOrFeature', value)}
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <SectionTitle>Features</SectionTitle>
                      <div>
                        <FieldLabel>Which feature was most useful to you?</FieldLabel>
                        <Select
                          options={[
                            { value: '', label: 'Select one' },
                            ...MOST_USEFUL_FEATURE_OPTIONS.map((option) => ({
                              value: option,
                              label: option,
                            })),
                          ]}
                          value={form.mostUsefulFeature}
                          onChange={(value) => setField('mostUsefulFeature', value)}
                          fullWidth
                          className={authInputClassName}
                        />
                      </div>
                      <div>
                        <FieldLabel>What feature was confusing or not useful?</FieldLabel>
                        <SurveyTextarea
                          value={form.confusingOrNotUsefulFeature}
                          onChange={(value) => setField('confusingOrNotUsefulFeature', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>What feature is missing that you expected to see?</FieldLabel>
                        <SurveyTextarea
                          value={form.missingExpectedFeature}
                          onChange={(value) => setField('missingExpectedFeature', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Would this app help you save time on real project work?</FieldLabel>
                        <RadioGroup
                          name="savesTimeRating"
                          options={YES_MAYBE_NO_OPTIONS}
                          value={form.savesTimeRating}
                          onChange={(value) => setField('savesTimeRating', value)}
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <SectionTitle>Bugs and Problems</SectionTitle>
                      <div>
                        <FieldLabel>
                          Did anything break, fail to save, or show wrong information?
                        </FieldLabel>
                        <SurveyTextarea
                          value={form.bugsOrWrongInfo}
                          onChange={(value) => setField('bugsOrWrongInfo', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>What is the one thing I should fix first?</FieldLabel>
                        <SurveyTextarea
                          value={form.fixFirst}
                          onChange={(value) => setField('fixFirst', value)}
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <SectionTitle>Final Feedback</SectionTitle>
                      <div>
                        <FieldLabel>What are the top 3 things you liked?</FieldLabel>
                        <SurveyTextarea
                          value={form.topThreeLiked}
                          onChange={(value) => setField('topThreeLiked', value)}
                          rows={4}
                        />
                      </div>
                      <div>
                        <FieldLabel>What are the top 3 things that need work?</FieldLabel>
                        <SurveyTextarea
                          value={form.topThreeNeedsWork}
                          onChange={(value) => setField('topThreeNeedsWork', value)}
                          rows={4}
                        />
                      </div>
                      <div>
                        <FieldLabel>Would you be willing to test the next version?</FieldLabel>
                        <RadioGroup
                          name="willingToTestNextVersion"
                          options={YES_MAYBE_NO_OPTIONS}
                          value={form.willingToTestNextVersion}
                          onChange={(value) => setField('willingToTestNextVersion', value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Any final comments?</FieldLabel>
                        <SurveyTextarea
                          value={form.finalComments}
                          onChange={(value) => setField('finalComments', value)}
                          rows={4}
                        />
                      </div>
                    </section>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-slate-950/95 px-5 py-4 sm:px-6">
                <Button
                  type="submit"
                  fullWidth
                  disabled={loading || saving}
                  isLoading={saving}
                  className={AUTH_ACCENT.primaryButton}
                >
                  {saving ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      {createPortal(modal, document.body)}
      <SurveyToast message={toast} />
    </>
  );
}
