import { Plus } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import { TEXT_FOREGROUND, TEXT_MUTED } from '../../../../theme/appTheme';

const ADD_BUTTON_CLASS =
  'w-full shrink-0 gap-2 whitespace-nowrap rounded-lg px-4 py-2 min-w-fit sm:w-auto';

interface DocumentRepeatingSectionAddButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function DocumentRepeatingSectionAddButton({
  label,
  onClick,
  disabled,
}: DocumentRepeatingSectionAddButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      className={ADD_BUTTON_CLASS}
      icon={<Plus className="h-4 w-4 shrink-0" aria-hidden />}
      onClick={onClick}
    >
      <span className="whitespace-nowrap">{label}</span>
    </Button>
  );
}

interface DocumentRepeatingSectionHeaderProps {
  title: string;
  description?: string;
  addButtonLabel: string;
  onAdd: () => void;
  addButtonDisabled?: boolean;
}

export function DocumentRepeatingSectionHeader({
  title,
  description,
  addButtonLabel,
  onAdd,
  addButtonDisabled,
}: DocumentRepeatingSectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>{title}</h2>
        {description ? (
          <p className={`mt-1 text-xs ${TEXT_MUTED}`}>{description}</p>
        ) : null}
      </div>
      <DocumentRepeatingSectionAddButton
        label={addButtonLabel}
        onClick={onAdd}
        disabled={addButtonDisabled}
      />
    </div>
  );
}
