export interface SafetyJhaRow {
  id: string;
  task: string;
  hazards: string;
  controls: string;
  ppe: string;
  responsible: string;
}

export interface ToolboxTalk {
  topicKey: string;
  title: string;
  explanation: string;
  keyHazards: string[];
  safePractices: string[];
  crewReminder: string;
  supervisorQuestion: string;
}

export interface AttendanceRow {
  id: string;
  workerName: string;
  company: string;
  signature: string;
  time: string;
}

export interface SafetyMeeting {
  id?: string;
  userId?: string;
  projectId?: string | null;
  projectName: string;
  projectAddress: string;
  meetingDate: string;
  supervisor: string;
  companyName: string;
  weather: string;
  workActivity: string;
  toolboxTopic: string;
  toolboxContent: ToolboxTalk | null;
  jhaRows: SafetyJhaRow[];
  attendees: AttendanceRow[];
  createdAt?: string;
  updatedAt?: string;
}

export type InspectionStatus = 'pass' | 'fail' | 'na' | null;

export interface InspectionItem {
  id: string;
  label: string;
  status: InspectionStatus;
  notes: string;
}

export interface ConcreteInspectionChecklist {
  id?: string;
  userId?: string;
  projectId?: string | null;
  projectName: string;
  projectAddress: string;
  inspectionDate: string;
  inspector: string;
  contractor: string;
  mixDesign: string;
  placementType: string;
  pourArea: string;
  estimatedYards: string;
  prePourItems: InspectionItem[];
  duringPlacementItems: InspectionItem[];
  postPlacementItems: InspectionItem[];
  notes: string;
  inspectorSignature: string;
  contractorSignature: string;
  createdAt?: string;
  updatedAt?: string;
}

export function newRowId(): string {
  return crypto.randomUUID();
}
