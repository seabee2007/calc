import React from 'react';
import { Save, Printer, FileDown, Eraser, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import { FIELD_TOOL_STICKY_BAR } from './fieldToolTheme';

interface FieldToolStickyActionsProps {
  onSave: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
  onClear: () => void;
  saving?: boolean;
  exporting?: boolean;
  saveLabel?: string;
}

export default function FieldToolStickyActions({
  onSave,
  onPrint,
  onExportPdf,
  onClear,
  saving = false,
  exporting = false,
  saveLabel = 'Save',
}: FieldToolStickyActionsProps) {
  return (
    <div className={FIELD_TOOL_STICKY_BAR}>
      <div className="flex flex-wrap gap-2 justify-end max-w-5xl mx-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<Eraser className="h-4 w-4" />}
          onClick={onClear}
          disabled={saving || exporting}
        >
          Clear form
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Printer className="h-4 w-4" />}
          onClick={onPrint}
          disabled={saving || exporting}
        >
          Print
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={
            exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />
          }
          onClick={onExportPdf}
          disabled={saving || exporting}
        >
          Export PDF
        </Button>
        <Button
          type="button"
          variant="accent"
          size="sm"
          icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          onClick={onSave}
          disabled={saving || exporting}
        >
          {saving ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </div>
  );
}
