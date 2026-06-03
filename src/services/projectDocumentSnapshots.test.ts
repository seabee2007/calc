import { describe, expect, it } from 'vitest';
import {
  extractBuilderWorkflowStatus,
  extractDocumentNumber,
} from './projectDocumentSnapshots';

describe('projectDocumentSnapshots', () => {
  it('extractDocumentNumber maps by document type', () => {
    expect(extractDocumentNumber('rfi', { rfiNumber: 'RFI-12' })).toBe('RFI-12');
    expect(extractDocumentNumber('submittal', { submittalNumber: 'SUB-3' })).toBe('SUB-3');
    expect(extractDocumentNumber('daily_report', { reportNumber: 'DR-1' })).toBe('DR-1');
    expect(extractDocumentNumber('change_order', { changeOrderNumber: 'CO-9' })).toBe('CO-9');
  });

  it('extractBuilderWorkflowStatus defaults to Draft', () => {
    expect(extractBuilderWorkflowStatus({})).toBe('Draft');
    expect(extractBuilderWorkflowStatus({ status: 'submitted' })).toBe('submitted');
  });
});
