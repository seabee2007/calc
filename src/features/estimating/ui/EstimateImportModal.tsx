import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { PLANNER_MUTED, TEXT_BODY } from './estimateWorkspaceTheme';
import EstimateImportPreview, { hasImportPreviewErrors } from './EstimateImportPreview';
import {
  finalizeImportedDraftLines,
  hasDuplicateImportedActivityCodes,
  parseEstimateFile,
  type EstimateImportPreview as EstimateImportPreviewData,
  type ImportedEstimateData,
} from '../importExport/estimateImportParser';
import type { EstimateImportApplyMode } from '../importExport/estimateImportApply';

interface Props {
  isOpen: boolean;
  saving: boolean;
  onClose: () => void;
  onApply: (payload: {
    mode: EstimateImportApplyMode;
    importedData: ImportedEstimateData;
    autoRenumberDuplicates: boolean;
  }) => Promise<void>;
}

export default function EstimateImportModal({ isOpen, saving, onClose, onApply }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importedData, setImportedData] = useState<ImportedEstimateData | null>(null);
  const [preview, setPreview] = useState<EstimateImportPreviewData | null>(null);
  const [autoRenumberDuplicates, setAutoRenumberDuplicates] = useState(false);

  const resetState = () => {
    setSelectedFileName(null);
    setParsing(false);
    setParseError(null);
    setImportedData(null);
    setPreview(null);
    setAutoRenumberDuplicates(false);
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
    setImportedData(null);
    setPreview(null);
    setAutoRenumberDuplicates(false);

    const result = await parseEstimateFile(file);
    setParsing(false);

    if (result.errors.length > 0 && !result.importedData) {
      setParseError(result.errors[0] ?? 'Could not import the selected file.');
      setPreview(
        result.preview ?? {
          divisionCount: 0,
          lineItemCount: 0,
          estimatedTotal: 0,
          divisions: [],
          warnings: result.warnings,
          errors: result.errors,
        },
      );
      return;
    }

    if (!result.importedData || !result.preview) {
      setParseError('Could not import the selected file.');
      return;
    }

    setImportedData(result.importedData);
    setPreview(result.preview);
  };

  const duplicateCodes = importedData
    ? hasDuplicateImportedActivityCodes(importedData.draftLines)
    : [];
  const hasDuplicateCodes = duplicateCodes.length > 0;
  const canApply = Boolean(
    importedData &&
      preview &&
      !hasImportPreviewErrors(preview) &&
      !saving &&
      (!hasDuplicateCodes || autoRenumberDuplicates),
  );

  const handleApply = async (mode: EstimateImportApplyMode) => {
    if (!importedData || !canApply) return;

    const finalized = finalizeImportedDraftLines(importedData.draftLines, {
      autoRenumberDuplicates,
      strictDuplicates: !autoRenumberDuplicates,
    });

    if (finalized.errors.length > 0) {
      setParseError(finalized.errors[0]);
      setPreview((current) =>
        current
          ? {
              ...current,
              errors: [...current.errors, ...finalized.errors],
              warnings: [...current.warnings, ...finalized.warnings],
            }
          : current,
      );
      return;
    }

    await onApply({
      mode,
      importedData: {
        ...importedData,
        draftLines: finalized.draftLines,
        warnings: [...importedData.warnings, ...finalized.warnings],
      },
      autoRenumberDuplicates,
    });
    resetState();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import estimate" size="lg">
      <div className="space-y-4">
        <p className={`text-sm ${TEXT_BODY}`}>
          Upload a Concrete Calc Bid Estimate Template file (.xlsx or .csv). Imported rows become
          normal estimate divisions and line items with structured activity codes.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
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

        {preview ? <EstimateImportPreview preview={preview} /> : null}

        {hasDuplicateCodes ? (
          <label className={`flex items-start gap-2 text-sm ${TEXT_BODY}`}>
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
              checked={autoRenumberDuplicates}
              onChange={(event) => setAutoRenumberDuplicates(event.target.checked)}
            />
            <span>
              Auto-renumber duplicate activity codes ({duplicateCodes.join(', ')})
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
            Add to current estimate
          </Button>
          <Button
            type="button"
            variant="accent"
            disabled={!canApply}
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
