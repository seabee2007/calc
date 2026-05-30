import React, { useRef } from 'react';
import { Camera, Paperclip } from 'lucide-react';
import Button from '../ui/Button';

interface FieldFilePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
}

export default function FieldFilePicker({
  files,
  onChange,
  label = 'Attachments',
}: FieldFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    onChange([...files, ...Array.from(list)]);
  };

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-900 dark:text-slate-200">{label}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          className="min-h-12 flex-1 sm:flex-none"
          icon={<Camera className="h-5 w-5" />}
          onClick={() => inputRef.current?.click()}
        >
          Add photo
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-h-12"
          icon={<Paperclip className="h-5 w-5" />}
          onClick={() => inputRef.current?.click()}
        >
          PDF / file
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf,.pdf,.dwg,.dxf"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-slate-400">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                className="text-xs text-red-600 hover:underline dark:text-red-400"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
