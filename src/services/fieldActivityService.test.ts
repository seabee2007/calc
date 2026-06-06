import { describe, expect, it } from 'vitest';
import type { ProjectDocumentRow } from './projectDocumentService';
import {
  builderChangeOrderToActivityItem,
  builderFarToActivityItem,
  builderRfiToActivityItem,
} from './fieldActivityService';

function doc(
  overrides: Partial<ProjectDocumentRow> & Pick<ProjectDocumentRow, 'id' | 'title'>,
): ProjectDocumentRow {
  return {
    id: overrides.id,
    user_id: 'user-1',
    project_id: 'proj-1',
    title: overrides.title,
    document_type: 'rfi',
    pack_key: 'GENERIC_RFI',
    status: 'draft',
    current_version_id: null,
    latest_version_number: 1,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T12:00:00Z',
    builder_workflow_status: null,
    ...overrides,
  };
}

describe('fieldActivityService builder mappers', () => {
  it('maps open builder RFI to field activity item', () => {
    const item = builderRfiToActivityItem(
      doc({ id: 'rfi-doc-1', title: 'Clarify footing', builder_workflow_status: 'Submitted' }),
      'Demo Project',
      'Alex Field',
    );
    expect(item).toMatchObject({
      id: 'builder-rfi-rfi-doc-1',
      type: 'rfi',
      projectId: 'proj-1',
      projectName: 'Demo Project',
      employeeName: 'Alex Field',
      summary: 'RFI submitted — Clarify footing',
      status: 'Submitted',
    });
    expect(item?.href).toContain('/contract-builder');
  });

  it('skips draft builder RFI', () => {
    const item = builderRfiToActivityItem(
      doc({ id: 'rfi-draft', title: 'Draft only', builder_workflow_status: 'Draft' }),
      'Demo Project',
      'Alex Field',
    );
    expect(item).toBeNull();
  });

  it('maps open builder FAR to field activity item', () => {
    const item = builderFarToActivityItem(
      doc({
        id: 'far-doc-1',
        title: 'Grade change',
        document_type: 'far',
        pack_key: 'GENERIC_FAR',
        builder_workflow_status: 'Under Review',
      }),
      'Demo Project',
      'Alex Field',
    );
    expect(item).toMatchObject({
      id: 'builder-far-far-doc-1',
      type: 'field_adjustment',
      status: 'Under Review',
    });
  });

  it('maps active builder change order to field activity item', () => {
    const item = builderChangeOrderToActivityItem(
      doc({
        id: 'co-doc-1',
        title: 'CO #4',
        document_type: 'change_order',
        pack_key: 'GENERIC_CHANGE_ORDER',
        builder_workflow_status: 'Submitted',
      }),
      'Demo Project',
      'Owner User',
    );
    expect(item).toMatchObject({
      id: 'builder-co-co-doc-1',
      type: 'owner_response',
      summary: 'Change order — CO #4',
      status: 'Submitted',
    });
    expect(item?.href).toContain('/change-orders/co-doc-1');
  });
});
