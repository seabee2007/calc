export const CHANGE_ORDER_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
  'void',
] as const;

export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

export interface ChangeOrderLineItem {
  description: string;
  qty?: number;
  unit?: string;
  amount: number;
}

export interface ChangeOrder {
  id: string;
  projectId: string;
  userId: string;
  linkedFarId: string | null;
  linkedRfiId: string | null;
  linkedTaskId: string | null;
  displayNumber: string | null;
  title: string;
  scopeDescription: string;
  reasonForChange: string;
  terms: string;
  laborItems: ChangeOrderLineItem[];
  materialItems: ChangeOrderLineItem[];
  equipmentItems: ChangeOrderLineItem[];
  markupPercent: number;
  subtotal: number;
  total: number;
  scheduleImpact: string | null;
  status: ChangeOrderStatus;
  publicToken: string;
  sentAt: string | null;
  viewedAt: string | null;
  openedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeOrderInput {
  projectId: string;
  userId: string;
  title: string;
  scopeDescription: string;
  reasonForChange: string;
  terms?: string;
  laborItems?: ChangeOrderLineItem[];
  materialItems?: ChangeOrderLineItem[];
  equipmentItems?: ChangeOrderLineItem[];
  markupPercent?: number;
  scheduleImpact?: string | null;
  linkedFarId?: string | null;
  linkedRfiId?: string | null;
  linkedTaskId?: string | null;
}
