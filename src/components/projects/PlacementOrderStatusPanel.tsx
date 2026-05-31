import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import Select from '../ui/Select';
import Button from '../ui/Button';
import type { Project } from '../../types';
import type { PlacementOrder } from '../../types/placementOrder';
import {
  PROJECT_LIFECYCLE_STAGE_ORDER,
  PROJECT_LIFECYCLE_LABELS,
  type ProjectLifecycleStage,
} from '../../utils/projectWorkflow';
import { defaultPlacementOrder } from '../../types/placementOrder';
import { useProjectStore } from '../../store';

const LIFECYCLE_OPTIONS = PROJECT_LIFECYCLE_STAGE_ORDER.map((value) => ({
  value,
  label: PROJECT_LIFECYCLE_LABELS[value],
}));

interface PlacementOrderStatusPanelProps {
  project: Project;
  /** Resolved lifecycle stage from `resolveProjectWorkflow` (single source of truth). */
  resolvedStage: ProjectLifecycleStage;
}

export default function PlacementOrderStatusPanel({
  project,
  resolvedStage,
}: PlacementOrderStatusPanelProps) {
  const updateProject = useProjectStore((s) => s.updateProject);

  const [lifecycleStage, setLifecycleStage] = useState<ProjectLifecycleStage>(resolvedStage);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLifecycleStage(resolvedStage);
    setMessage(null);
    setError(null);
  }, [resolvedStage, project.id, project.updatedAt]);

  const dirty = lifecycleStage !== resolvedStage;

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    const nextOrder: PlacementOrder = {
      ...(project.placementOrder ?? defaultPlacementOrder()),
      lifecycleStage,
      updatedAt: new Date().toISOString(),
    };
    try {
      await updateProject(project.id, { placementOrder: nextOrder });
      setMessage('Project stage updated.');
    } catch {
      setError('Could not save project stage. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200/80 dark:border-gray-700/80">
      <Select
        label="Project stage"
        options={LIFECYCLE_OPTIONS}
        value={lifecycleStage}
        onChange={(v) => setLifecycleStage(v as ProjectLifecycleStage)}
      />
      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
        Matches project workflow above. Change only when you need to override the automatic stage.
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          icon={
            saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )
          }
        >
          {saving ? 'Saving…' : 'Save stage'}
        </Button>
        {message && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
