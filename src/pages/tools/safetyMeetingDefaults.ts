import type { SafetyMeeting } from '../../types/fieldTools';

export function emptySafetyMeeting(): SafetyMeeting {
  const today = new Date().toISOString().slice(0, 10);
  return {
    projectId: null,
    projectName: '',
    projectAddress: '',
    meetingDate: today,
    supervisor: '',
    companyName: '',
    weather: '',
    workActivity: '',
    toolboxTopic: '',
    toolboxContent: null,
    jhaRows: [],
    attendees: [],
  };
}
