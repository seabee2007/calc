import { Pin, PinOff } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import { useEstimateWorkspaceHeaderCollapse } from '../EstimateWorkspaceHeaderCollapseContext';

export default function EstimateWorkspaceHeaderPinButton() {
  const collapse = useEstimateWorkspaceHeaderCollapse();

  if (!collapse?.enabled || collapse.isMobile) {
    return null;
  }

  const isPinned = collapse.isPinned;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-10 w-10 px-0"
      aria-label={isPinned ? 'Keep header visible' : 'Auto-hide header'}
      title={isPinned ? 'Keep header visible' : 'Auto-hide header'}
      data-testid="estimate-workspace-header-pin"
      onClick={() => collapse.setPinned(!isPinned)}
    >
      {isPinned ? <Pin className="h-4 w-4" aria-hidden /> : <PinOff className="h-4 w-4" aria-hidden />}
    </Button>
  );
}
