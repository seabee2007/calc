import { HelpCircle } from 'lucide-react';
import { useDefinitionsHelpStore } from './definitionsHelpStore';

interface Props {
  className?: string;
  showLabel?: boolean;
  focusTerm?: string;
}

export default function HelpButton({ className = '', showLabel = true, focusTerm }: Props) {
  const open = useDefinitionsHelpStore((state) => state.open);

  return (
    <button
      type="button"
      onClick={() => open(focusTerm)}
      className={className}
      aria-label="Open definitions and help"
      title="Definitions & Help"
    >
      <span className="inline-flex items-center gap-1.5">
        <HelpCircle className="h-4 w-4" aria-hidden />
        {showLabel ? <span>Help</span> : null}
      </span>
    </button>
  );
}
