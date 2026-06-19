import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import { PLANNER_MUTED, TEXT_BODY } from '../estimateWorkspaceTheme';
import ActivityExcelImportPreview, {
  hasActivityExcelPreviewErrors,
} from './ActivityExcelImportPreview';
import {
  parseActivityExcelFile,
  previewImportableRowCount,
} from '../../excel/estimateExcelImportParser';
import type {
  ActivityExcelEstimateType,
  ActivityExcelImportMode,
  ActivityExcelImportPreview as ActivityExcelImportPreviewData,
  ParsedActivityGroup,
} from '../../excel/estimateExcelTypes';
import { loadProjectActivitiesWithLineItems } from '../../application/constructionActivityService';

interface Props {
  isOpen: boolean;
  saving: boolean;
  projectId: string;
  estimateId: string;
  estimateType: ActivityExcelEstimateType;
  onClose: () => void;
  onApply: (payload: {
    mode: ActivityExcelImportMode;
    groups: ParsedActivityGroup[];
  }) => Promise<void>;
}

export default function ActivityExcelImportModal({
  isOpen,
  saving,
  projectId,
  estimateId,
  estimateType,
  onClose,
  onApply,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ActivityExcelImportPreviewData | null>(null);
  const [importableGroups, setImportableGroups] = useState<ParsedActivityGroup[]>([]);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  const resetState = () => {
    setSelectedFileName(null);
    setParsing(false);
    setParseError(null);
    setPreview(null);
    setImportableGroups([]);
    setReplaceConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (saving) return;
    resetState();
    onClose();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setParsing(true);
    setParseError(null);
    setPreview(null);
    setImportableGroups([]);
    setReplaceConfirmed(false);

    const existingResult = await loadProjectActivitiesWithLineItems(projectId, estimateId);
    const existingLoaded = existingResult.data ?? [];
    const existingActivities = existingLoaded.map((entry) => entry.activity);
    const existingLineItemsByActivityId = new Map(
      existingLoaded.map((entry) => [entry.activity.id, entry.lineItems]),
    );

    const result = await parseActivityExcelFile({
      file,
      expectedEstimateType: estimateType,
      existingActivities,
      existingLineItemsByActivityId,
    });

    setParsing(false);

    if (result.errors.length > 0 && !result.preview) {
      setParseError(result.errors[0] ?? 'Could not import the selected file.');
      return;
    }

    if (!result.preview) {
      setParseError('Could not import the selected file.');
      return;
    }

    setPreview(result.preview);
    setImportableGroups(result.importableGroups);
    if (result.errors.length > 0) {
      setParseError(result.errors[0] ?? null);
    }
  };

  const importableCount = preview ? previewImportableRowCount(preview) : 0;
  const canApply = Boolean(
    preview &&
      importableGroups.length > 0 &&
      !hasActivityExcelPreviewErrors(preview) &&
      !saving,
  );

  const handleApply = async (mode: ActivityExcelImportMode) => {
    if (!canApply) return;
    if (mode === 'replace' && !replaceConfirmed) {
      setParseError('Confirm replace mode before replacing all current construction activities.');
      return;
    }
    await onApply({ mode, groups: importableGroups });
    resetState();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import construction activities" size="lg">
      <div className="space-y-4">
        <p className={`text-sm ${TEXT_BODY}`}>
          Upload an Arden {estimateType === 'bid' ? 'Bid' : 'Detailed'} Estimate Template file (.xlsx).
          Rows are grouped into construction activities and line items. Totals are recalculated in Arden.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Upload className="h-4 w-4" />}
            disabled={saving || parsing}
            onClick={() => fileInputRef.current?.click()}
          >
            {parsing ? 'Reading file...' : 'Choose file'}
          </Button>
          {selectedFileName ? (
            <span className={`text-sm ${PLANNER_MUTED}`}>{selectedFileName}</span>
          ) : null}
        </div>

        {parseError ? (
          <p className="text-sm text-red-700 dark:text-red-300">{parseError}</p>
        ) : null}

        {preview ? <ActivityExcelImportPreview preview={preview} /> : null}

        {preview && !hasActivityExcelPreviewErrors(preview) ? (
          <label className={`flex items-start gap-2 text-sm ${TEXT_BODY}`}>
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
              checked={replaceConfirmed}
              onChange={(event) => setReplaceConfirmed(event.target.checked)}
            />
            <span>
              I understand replace mode removes all current construction activities before importing.
            </span>
          </label>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={saving} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canApply}
            isLoading={saving}
            onClick={() => handleApply('add')}
          >
            Import {importableCount} valid row{importableCount === 1 ? '' : 's'}
          </Button>
          <Button
            type="button"
            variant="accent"
            disabled={!canApply || !replaceConfirmed}
            isLoading={saving}
            onClick={() => handleApply('replace')}
          >
            Replace current estimate
          </Button>
        </div>
      </div>
    </Modal>
  );
}
