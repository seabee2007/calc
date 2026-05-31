import type { ConcreteInspectionChecklist } from '../../types/fieldTools';
import { createEmptyInspectionChecklistItems } from '../../data/concreteInspectionChecklistItems';

export function emptyConcreteInspection(): ConcreteInspectionChecklist {
  const today = new Date().toISOString().slice(0, 10);
  const items = createEmptyInspectionChecklistItems();
  return {
    projectId: null,
    projectName: '',
    projectAddress: '',
    inspectionDate: today,
    inspector: '',
    contractor: '',
    mixDesign: '',
    placementType: '',
    pourArea: '',
    estimatedYards: '',
    ...items,
    notes: '',
    inspectorSignature: '',
    contractorSignature: '',
  };
}
