import { useCallback, useRef, useState } from 'react';
import { HelpCircle, Upload } from 'lucide-react';
import {
  INVALID_BIM_FILE_ERROR,
  validateBimModelFileForUpload,
} from '../../services/bimModelUploadValidation';

interface Props {
  uploading?: boolean;
  onUpload: (file: File) => void | Promise<void>;
  disabled?: boolean;
}

export default function BimModelUpload({ uploading = false, onUpload, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;

      setValidationError(null);

      const validation = await validateBimModelFileForUpload(file);
      if (!validation.ok) {
        setValidationError(validation.error ?? INVALID_BIM_FILE_ERROR);
        return;
      }

      void onUpload(file);
    },
    [onUpload],
  );

  return (
    <div className="rounded-xl border border-dashed border-cyan-300 bg-cyan-50/70 p-4 shadow-sm dark:border-cyan-500/30 dark:bg-cyan-500/5">
      <input
        ref={inputRef}
        type="file"
        accept=".glb,model/gltf-binary"
        className="hidden"
        data-testid="bim-model-file-input"
        disabled={disabled || uploading}
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-sky-500 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none dark:from-cyan-400 dark:to-sky-500 dark:text-slate-950 dark:disabled:from-slate-800 dark:disabled:to-slate-800 dark:disabled:text-slate-500"
      >
        <Upload className="h-4 w-4" />
        {uploading ? 'Uploading model…' : 'Upload GLB Model'}
      </button>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
        Supported now: single-file .glb models. Coming later: IFC and zipped GLTF packages. Using Revit or SketchUp? Export to GLB for viewing, or IFC later for BIM takeoff.
      </p>
      <button
        type="button"
        onClick={() => setHelpOpen((value) => !value)}
        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        File format help
      </button>
      {helpOpen ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
          <p className="font-semibold text-slate-950 dark:text-slate-100">What can I upload?</p>
          <ul className="mt-2 space-y-1">
            <li>Upload .glb models for now.</li>
            <li>GLB is a single-file 3D model format that works well in the browser.</li>
            <li>Loose .gltf files are not supported yet because they often need .bin and texture files.</li>
            <li>IFC BIM import is planned for a later phase.</li>
            <li>Revit and SketchUp users should export or convert to GLB for now.</li>
          </ul>
          <div className="mt-3 space-y-1 border-t border-slate-200 pt-2 dark:border-slate-800">
            <p><strong>.glb</strong> · Supported now · 3D viewer + manual takeoff</p>
            <p><strong>.gltf</strong> · Not supported unless embedded · Usually missing .bin/textures</p>
            <p><strong>.zip</strong> · Future · Full GLTF package support</p>
            <p><strong>.ifc</strong> · Future · BIM object extraction</p>
            <p><strong>.rvt/.skp</strong> · Not directly supported · Export to IFC/GLB first</p>
            <p><strong>.obj/.fbx</strong> · Maybe later · Visual model only</p>
          </div>
        </div>
      ) : null}
      {validationError ? (
        <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300" data-testid="bim-upload-validation-error">
          {validationError}
        </p>
      ) : null}
    </div>
  );
}
