// Add QC Record types
export interface QCRecord {
  id: string;
  projectId: string;
  date: string;
  temperature: number;
  humidity: number;
  slump: number;
  air_Content: number;
  cylindersMade: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Update Project interface
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  calculations: Calculation[];
  wasteFactor?: number;
  pourDate?: string;
  mixProfile?: MixProfileType;
  qcRecords?: QCRecord[]; // Add this line
}