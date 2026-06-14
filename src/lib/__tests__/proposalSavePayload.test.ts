import { describe, expect, it } from 'vitest';
import type { ProposalData } from '../types/proposal';
import {
  assertNoFrontendOnlyFinancialKeys,
  buildProposalCreatePayload,
  buildProposalUpdatePayload,
  formatSupabasePersistenceError,
  safeProposalMoney,
  sanitizeProposalFinancialColumns,
} from '../proposalSavePayload';
import type { CreateProposalData } from '../proposalService';

function minimalProposalData(overrides: Partial<ProposalData> = {}): ProposalData {
  return {
    businessName: 'Acme Concrete',
    clientName: '',
    projectTitle: 'GU26-201 Single-Family Wood-Frame Residence',
    date: '6/14/2026',
    introduction: '',
    scope: '',
    timeline: [],
    pricing: [{ description: 'General', amount: '$10,000' }],
    terms: '',
    preparedBy: 'Estimator',
    ...overrides,
  };
}

describe('proposalSavePayload', () => {
  it('buildProposalCreatePayload creates a valid draft with DB columns only', () => {
    const input: CreateProposalData = {
      title: 'Proposal for GU26-201',
      template_type: 'classic',
      project_id: 'proj-123',
      data: minimalProposalData(),
    };

    const payload = buildProposalCreatePayload('user-1', input);
    assertNoFrontendOnlyFinancialKeys(payload);

    expect(payload.user_id).toBe('user-1');
    expect(payload.project_id).toBe('proj-123');
    expect(payload.title).toBe('Proposal for GU26-201');
    expect(payload.status).toBe('draft');
    expect(payload.template_type).toBe('classic');
    expect(typeof payload.total_amount).toBe('number');
    expect(Number.isFinite(payload.total_amount)).toBe(true);
  });

  it('does not include camelCase-only or frontend-only financial keys', () => {
    const payload = buildProposalCreatePayload('user-1', {
      title: 'Test',
      template_type: 'modern',
      data: minimalProposalData(),
    });

    assertNoFrontendOnlyFinancialKeys(payload);
    expect(payload).not.toHaveProperty('userId');
    expect(payload).not.toHaveProperty('projectId');
    expect(payload).not.toHaveProperty('totalAmount');
    expect(payload).not.toHaveProperty('equipment_cost');
    expect(payload).not.toHaveProperty('total_estimated_cost');
    expect(payload).not.toHaveProperty('markup_percent');
  });

  it('uses imported project title when provided', () => {
    const payload = buildProposalCreatePayload('user-1', {
      title: 'GU26-201 Single-Family Wood-Frame Residence Proposal',
      template_type: 'classic',
      project_id: 'e617617a-e58c-4cfb-90ef-bb78638e1305',
      data: minimalProposalData({
        projectTitle: 'GU26-201 Single-Family Wood-Frame Residence',
        clientName: '',
      }),
    });

    expect(payload.title).toBe('GU26-201 Single-Family Wood-Frame Residence Proposal');
    expect((payload.data as ProposalData).projectTitle).toBe(
      'GU26-201 Single-Family Wood-Frame Residence',
    );
  });

  it('handles missing optional client fields in jsonb data', () => {
    const payload = buildProposalCreatePayload('user-1', {
      title: 'Untitled',
      template_type: 'minimal',
      data: minimalProposalData({
        clientName: '',
        clientCompany: undefined,
        clientAddress: undefined,
      }),
    });

    const data = payload.data as ProposalData;
    expect(data.clientName).toBe('');
    expect(data.clientCompany).toBeUndefined();
    expect(payload.status).toBe('draft');
  });

  it('defaults invalid NaN totals to 0 in sanitized financial columns', () => {
    const sanitized = sanitizeProposalFinancialColumns({
      total_amount: NaN,
      labor_cost: NaN,
      material_cost: undefined as unknown as number,
      deposit_amount: NaN,
      gross_profit: NaN,
      gross_margin_percent: NaN,
      equipment_cost: 500,
      total_estimated_cost: 9000,
      markup_percent: 12,
    });

    expect(safeProposalMoney(NaN)).toBe(0);
    expect(sanitized.total_amount).toBe(0);
    expect(sanitized.labor_cost).toBe(0);
    expect(sanitized.material_cost).toBe(0);
    expect(sanitized.deposit_amount).toBe(0);
    expect(sanitized.gross_profit).toBe(0);
    expect(sanitized.gross_margin_percent).toBe(0);
    expect(sanitized).not.toHaveProperty('equipment_cost');
  });

  it('buildProposalUpdatePayload strips frontend-only financial keys', () => {
    const payload = buildProposalUpdatePayload({
      title: 'Updated',
      data: minimalProposalData(),
      status: 'draft',
    });

    assertNoFrontendOnlyFinancialKeys(payload);
    expect(payload.title).toBe('Updated');
    expect(payload.status).toBe('draft');
  });

  it('formatSupabasePersistenceError surfaces code message details hint', () => {
    expect(
      formatSupabasePersistenceError({
        code: 'PGRST204',
        message: "Could not find the 'equipment_cost' column of 'proposals' in the schema cache",
        details: null as unknown as string,
        hint: null as unknown as string,
      }),
    ).toContain('equipment_cost');
  });
});

describe('ProposalGenerator send path', () => {
  it('handleSendProposal stops when persistProposal throws (no email send)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/ProposalGenerator.tsx');
    const proposalGeneratorSource = fs.readFileSync(filePath, 'utf8');

    expect(proposalGeneratorSource).toMatch(/const saved = await persistProposal\(\)/);
    expect(proposalGeneratorSource).toMatch(/setSendEmailModal\(/);
    const sendHandlerStart = proposalGeneratorSource.indexOf('const handleSendProposal');
    const sendHandlerEnd = proposalGeneratorSource.indexOf('const handleSendProposalEmail');
    const sendHandler = proposalGeneratorSource.slice(sendHandlerStart, sendHandlerEnd);
    expect(sendHandler.indexOf('await persistProposal()')).toBeLessThan(
      sendHandler.indexOf('setSendEmailModal'),
    );
    expect(sendHandler).toContain('Could not send proposal');
  });
});
