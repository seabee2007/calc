import { Maximize2 } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import { useEstimateWorkspaceHeaderCollapse } from '../EstimateWorkspaceHeaderCollapseContext';

export default function EstimateWorkspaceFocusModeButton() {
  const header = useEstimateWorkspaceHeaderCollapse();

  if (!header?.enabled || header.isMobile || header.focusMode) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-10 px-3"
      aria-label="Enter focus mode"
      title="Enter focus mode"
      data-testid="estimate-workspace-focus-mode-button"
      onClick={() => header.setFocusMode(true)}
    >
      <Maximize2 className="mr-1.5 h-4 w-4" aria-hidden />
      Focus
    </Button>
  );
}
