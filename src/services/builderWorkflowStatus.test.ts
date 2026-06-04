import { describe, expect, it } from 'vitest';
import {
  formatWorkflowStatusLabel,
  isFarBuilderWorkflowClosed,
  isFarBuilderWorkflowOpen,
  isRfiBuilderWorkflowClosed,
  isRfiBuilderWorkflowOpen,
  normalizeBuilderWorkflowStatus,
  partitionFarBuilderDocument,
  partitionRfiBuilderDocument,
  partitionRfiBuilderDocuments,
  resolveBuilderWorkflowStatusDisplay,
  RFI_WORKFLOW_STATUSES,
} from './builderWorkflowStatus';

describe('builderWorkflowStatus', () => {
  it('formats snake_case and display labels', () => {
    expect(formatWorkflowStatusLabel('under_review')).toBe('Under Review');
    expect(formatWorkflowStatusLabel('Submitted')).toBe('Submitted');
    expect(normalizeBuilderWorkflowStatus('void')).toBe('Void');
  });

  it('resolves display from builder_workflow_status first', () => {
    expect(
      resolveBuilderWorkflowStatusDisplay(
        { builder_workflow_status: 'Answered', status: 'draft' },
        'Draft',
      ),
    ).toBe('Answered');
  });

  it('falls back to answers.status then contract status', () => {
    expect(
      resolveBuilderWorkflowStatusDisplay({ builder_workflow_status: null, status: 'draft' }, 'Submitted'),
    ).toBe('Submitted');
    expect(resolveBuilderWorkflowStatusDisplay({ builder_workflow_status: null, status: 'draft' })).toBe(
      'Draft',
    );
  });

  it('includes expected RFI statuses', () => {
    expect(RFI_WORKFLOW_STATUSES).toContain('Answered');
    expect(RFI_WORKFLOW_STATUSES).toContain('Closed');
  });

  it('classifies RFI builder open vs closed vs drafts', () => {
    expect(isRfiBuilderWorkflowOpen('Under Review')).toBe(true);
    expect(isRfiBuilderWorkflowOpen('Answered')).toBe(true);
    expect(isRfiBuilderWorkflowOpen('Draft')).toBe(false);
    expect(isRfiBuilderWorkflowClosed('Closed')).toBe(true);
    expect(isRfiBuilderWorkflowClosed('Void')).toBe(true);

    expect(partitionRfiBuilderDocument({ builder_workflow_status: 'under_review', status: 'draft' })).toBe(
      'open',
    );
    expect(partitionRfiBuilderDocument({ builder_workflow_status: 'Answered', status: 'draft' })).toBe('open');
    expect(partitionRfiBuilderDocument({ builder_workflow_status: 'Closed', status: 'draft' })).toBe('closed');
    expect(partitionRfiBuilderDocument({ builder_workflow_status: null, status: 'draft' })).toBe('drafts');
  });

  it('partitions RFI builder document lists', () => {
    const parts = partitionRfiBuilderDocuments([
      { id: '1', builder_workflow_status: 'Draft', status: 'draft' } as never,
      { id: '2', builder_workflow_status: 'Submitted', status: 'draft' } as never,
      { id: '3', builder_workflow_status: 'Closed', status: 'draft' } as never,
    ]);
    expect(parts.drafts).toHaveLength(1);
    expect(parts.open).toHaveLength(1);
    expect(parts.closed).toHaveLength(1);
  });

  it('classifies FAR builder open vs closed vs drafts', () => {
    expect(isFarBuilderWorkflowOpen('Draft')).toBe(false);
    expect(isFarBuilderWorkflowOpen('Approved')).toBe(true);
    expect(isFarBuilderWorkflowClosed('Closed')).toBe(true);
    expect(partitionFarBuilderDocument({ builder_workflow_status: 'Under Review', status: 'draft' })).toBe(
      'open',
    );
    expect(partitionFarBuilderDocument({ builder_workflow_status: 'Void', status: 'draft' })).toBe('closed');
    expect(partitionFarBuilderDocument({ builder_workflow_status: null, status: 'draft' })).toBe('drafts');
  });
});
