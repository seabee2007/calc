import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { SafetyMeeting } from '../../../../types/fieldTools';
import Button from '../../../ui/Button';
import { safetyMeetingToolHref } from '../../../../utils/plannerRoutes';
import {
  DocumentsPanelFootnote,
  formatDocDate,
  PanelActionRow,
  SimpleDocumentsTable,
} from '../documentsPanelUtils';

interface Props {
  projectId: string;
  meetings: SafetyMeeting[];
  highlightSafetyId: string | null;
}

export default function SafetyMeetingsDocumentsPanel({
  projectId,
  meetings,
  highlightSafetyId,
}: Props) {
  const navigate = useNavigate();

  return (
    <>
      <PanelActionRow
        action={
          <Button
            variant="accent"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate(safetyMeetingToolHref(projectId))}
          >
            New safety meeting
          </Button>
        }
      />
      <SimpleDocumentsTable
        rows={meetings.map((m) => ({
          id: m.id,
          date: formatDocDate(m.meetingDate),
          title: m.projectName || 'Safety meeting',
          meta: m.supervisor ? `Supervisor: ${m.supervisor}` : m.workActivity || '—',
        }))}
        empty="No safety meetings saved for this project yet."
        highlightId={highlightSafetyId}
        buildHref={(id) => safetyMeetingToolHref(projectId, id)}
      />
      <DocumentsPanelFootnote />
    </>
  );
}
