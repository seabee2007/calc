import type { ProposalData } from '../types/proposal';
import type { ProposalFinancialFields, ProposalStatus } from '../types/proposalTracking';
import { computeProposalFinancials } from '../utils/proposalFinancials';
import type { CreateProposalData, UpdateProposalData } from './proposalService';

/** Denormalized columns on the `proposals` table (not stored in jsonb `data`). */
export const PROPOSAL_DB_FINANCIAL_COLUMNS = [
  'total_amount',
  'labor_cost',
  'material_cost',
  'deposit_amount',
  'gross_profit',
  'gross_margin_percent',
] as const;

export type ProposalDbFinancialColumn = (typeof PROPOSAL_DB_FINANCIAL_COLUMNS)[number];

export type ProposalDbFinancialFields = Pick<
  ProposalFinancialFields,
  ProposalDbFinancialColumn
>;

const FRONTEND_ONLY_FINANCIAL_KEYS = [
  'equipment_cost',
  'total_estimated_cost',
  'markup_percent',
] as const;

export function safeProposalMoney(value: number | undefined | null): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

/** Strip computed fields that are not persisted on `proposals`. */
export function sanitizeProposalFinancialColumns(
  financials: ProposalFinancialFields,
): ProposalDbFinancialFields {
  return {
    total_amount: safeProposalMoney(financials.total_amount),
    labor_cost: safeProposalMoney(financials.labor_cost),
    material_cost: safeProposalMoney(financials.material_cost),
    deposit_amount: safeProposalMoney(financials.deposit_amount),
    gross_profit: safeProposalMoney(financials.gross_profit),
    gross_margin_percent: safeProposalMoney(financials.gross_margin_percent),
  };
}

export function buildProposalCreatePayload(
  userId: string,
  proposalData: CreateProposalData,
): Record<string, unknown> {
  const financials = sanitizeProposalFinancialColumns(
    computeProposalFinancials(proposalData.data),
  );

  return {
    user_id: userId,
    project_id: proposalData.project_id ?? null,
    title: proposalData.title?.trim() || 'Untitled Proposal',
    template_type: proposalData.template_type,
    data: proposalData.data,
    status: 'draft' satisfies ProposalStatus,
    ...financials,
  };
}

export function buildProposalUpdatePayload(
  updates: UpdateProposalData,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    payload.title = updates.title.trim() || 'Untitled Proposal';
  }
  if (updates.template_type !== undefined) {
    payload.template_type = updates.template_type;
  }
  if (updates.data !== undefined) {
    payload.data = updates.data;
    Object.assign(
      payload,
      sanitizeProposalFinancialColumns(computeProposalFinancials(updates.data)),
    );
  }
  if (updates.project_id !== undefined) {
    payload.project_id = updates.project_id;
  }
  if (updates.status !== undefined) {
    payload.status = updates.status;
  }

  if (updates.total_amount !== undefined) {
    payload.total_amount = safeProposalMoney(updates.total_amount);
  }
  if (updates.labor_cost !== undefined) {
    payload.labor_cost = safeProposalMoney(updates.labor_cost);
  }
  if (updates.material_cost !== undefined) {
    payload.material_cost = safeProposalMoney(updates.material_cost);
  }
  if (updates.deposit_amount !== undefined) {
    payload.deposit_amount = safeProposalMoney(updates.deposit_amount);
  }

  return payload;
}

/** Guardrail for tests — payload must not include frontend-only financial keys. */
export function assertNoFrontendOnlyFinancialKeys(payload: Record<string, unknown>): void {
  for (const key of FRONTEND_ONLY_FINANCIAL_KEYS) {
    if (key in payload) {
      throw new Error(`Unexpected frontend-only key in proposal save payload: ${key}`);
    }
  }
}

export function formatSupabasePersistenceError(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}): string {
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : 'Unknown database error';
}
