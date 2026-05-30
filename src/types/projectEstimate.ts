import type { ChangeOrderLineItem } from './changeOrder';

export interface ProjectCustomEstimates {
  laborItems: ChangeOrderLineItem[];
  materialItems: ChangeOrderLineItem[];
  equipmentItems: ChangeOrderLineItem[];
  updatedAt?: string;
}

export const EMPTY_PROJECT_CUSTOM_ESTIMATES: ProjectCustomEstimates = {
  laborItems: [],
  materialItems: [],
  equipmentItems: [],
};
