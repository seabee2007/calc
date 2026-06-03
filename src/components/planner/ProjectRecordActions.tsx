import Button from '../ui/Button';

export type RowAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export type DangerAction = RowAction & {
  isLoading?: boolean;
  confirmMode?: boolean;
  onCancelConfirm?: () => void;
};

export interface ProjectRecordActionsProps {
  primary: RowAction;
  secondaries?: RowAction[];
  danger?: DangerAction;
  className?: string;
}

const DANGER_OUTLINE_CLASS =
  'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30';

function renderAction(
  action: RowAction,
  variant: 'accent' | 'outline',
  extraClassName?: string,
) {
  const { label, href, onClick, disabled } = action;
  if (href) {
    return (
      <Button
        key={label}
        size="sm"
        variant={variant}
        as="a"
        href={href}
        className={extraClassName}
        disabled={disabled}
      >
        {label}
      </Button>
    );
  }
  return (
    <Button
      key={label}
      size="sm"
      variant={variant}
      onClick={onClick}
      className={extraClassName}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}

export default function ProjectRecordActions({
  primary,
  secondaries = [],
  danger,
  className = '',
}: ProjectRecordActionsProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-2 ${className}`.trim()}
    >
      {renderAction(primary, 'accent')}

      {secondaries.map((action) => renderAction(action, 'outline'))}

      {danger ? (
        <>
          <Button
            size="sm"
            variant={danger.confirmMode ? 'danger' : 'outline'}
            className={danger.confirmMode ? undefined : DANGER_OUTLINE_CLASS}
            onClick={danger.onClick}
            disabled={danger.disabled}
            isLoading={danger.isLoading}
          >
            {danger.confirmMode ? 'Confirm delete' : danger.label}
          </Button>
          {danger.confirmMode && danger.onCancelConfirm ? (
            <Button size="sm" variant="ghost" onClick={danger.onCancelConfirm}>
              Cancel
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
