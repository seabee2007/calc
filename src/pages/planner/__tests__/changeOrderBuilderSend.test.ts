import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('ChangeOrderBuilderPage send workflow', () => {
  const source = readSource('src/pages/planner/ChangeOrderBuilderPage.tsx');

  it('does not use browser alert for send validation', () => {
    const handleSendStart = source.indexOf('const handleSend = async');
    const handleSendEnd = source.indexOf('const handleSendEmailSuccess');
    const handleSendBlock = source.slice(handleSendStart, handleSendEnd);
    expect(handleSendBlock).not.toMatch(/\balert\s*\(/);
    expect(source).not.toContain('Failed to send change order.');
  });

  it('does not use mailto for client email', () => {
    expect(source).not.toContain('mailto:');
    expect(source).not.toContain('openMailto');
    expect(source).not.toContain('ProposalSentLinkModal');
    expect(source).not.toContain('Email link');
  });

  it('opens in-app send email modal after validate, save, and public link', () => {
    expect(source).toContain('ChangeOrderSendEmailModal');
    expect(source).toContain('ensurePublicChangeOrderLink');
    expect(source).toContain('openSendModal');
    expect(source).toContain('setSendModalOpen(true)');
    expect(source).toContain('Enter contractor printed name before sending.');
    expect(source).toContain('contractorValidationError');
    expect(source).toContain('[ChangeOrder] Send clicked');
    expect(source).toContain('[ChangeOrder] validating before send');
    expect(source).toContain('[ChangeOrder] saving before send');
    expect(source).toContain('[ChangeOrder] ensuring public change order URL');
    expect(source).toContain('[ChangeOrder] opening send modal');
  });

  it('defers route replace and planner reload during send so modal state is not lost', () => {
    expect(source).toContain('persistChangeOrder({ replaceRoute: false, skipReload: true })');
    expect(source).toContain('skipReload');
  });

  it('shows visible feedback for send failures', () => {
    expect(source).toContain('Could not save change order before sending.');
    expect(source).toContain('Could not create client review link.');
    expect(source).toContain('Could not prepare change order for sending.');
    expect(source).toContain('showPageToast');
    expect(source).not.toContain('if (busy || persistingRef.current) return;');
  });

  it('highlights client email in modal when project email is missing', () => {
    expect(source).toContain('sendModalHighlightEmail');
    expect(source).toContain('highlightEmail={sendModalHighlightEmail}');
  });

  it('marks change order sent only after successful email send', () => {
    expect(source).toContain('markChangeOrderSent');
    expect(source).toContain('handleSendEmailSuccess');
    expect(source).not.toContain('markSentAfterEmail');
    expect(source).not.toContain('ensureSent');
  });

  it('navigates to change orders list after successful send email', () => {
    expect(source).toContain('navigate(plannerChangeOrdersHref(projectId))');
  });

  it('uses local draft on /new without immediate DB insert', () => {
    expect(source).toContain('resolveChangeOrderNewDraft');
    expect(source).not.toContain('createChangeOrderManual');
    expect(source).not.toContain('createChangeOrderFromFar');
    expect(source).not.toContain('createChangeOrderFromRfi');
    expect(source).toContain('persistChangeOrder');
    expect(source).toContain('saveChangeOrder(coId');
  });

  it('guards against duplicate save/send submits', () => {
    expect(source).toContain('persistingRef');
    expect(source).toContain('Save already in progress');
    expect(source).toContain('isSending');
  });

  it('still supports export PDF', () => {
    expect(source).toContain('handlePdf');
    expect(source).toContain('Export PDF');
    expect(source).toContain('generateChangeOrderPDF');
  });
});

describe('change order email service', () => {
  it('exposes sendChangeOrderEmail through transactional edge function', () => {
    const source = readSource('src/services/emailService.ts');
    expect(source).toContain('sendChangeOrderEmail');
    expect(source).toContain("templateKey: 'changeOrderSent'");
    expect(source).not.toMatch(/from ['"]resend['"]/i);
  });
});

describe('change order public URL helper', () => {
  it('uses getPublicAppUrl in changeOrderTracking', () => {
    const source = readSource('src/lib/changeOrderTracking.ts');
    expect(source).toContain('getPublicAppUrl');
  });

  it('ensures public link in changeOrderService', () => {
    const source = readSource('src/services/changeOrderService.ts');
    expect(source).toContain('ensurePublicChangeOrderLink');
    expect(source).toContain('getPublicAppUrl');
  });
});

describe('change order route ids', () => {
  it('validates change order route ids before navigation', () => {
    const routesSource = readSource('src/utils/plannerRoutes.ts');
    expect(routesSource).toContain('assertValidChangeOrderRouteId');
    expect(routesSource).toContain("typeof changeOrderId !== 'string'");
  });

  it('does not use the legacy generic change order email copy', () => {
    const templatesSource = readSource('supabase/functions/_shared/emailTemplates.ts');
    expect(templatesSource).not.toContain('Project update');
    expect(templatesSource).not.toContain('Review the change order for your project.');
    expect(templatesSource).toContain('buildDefaultChangeOrderEmailText');

    const indexSource = readSource('supabase/functions/send-transactional-email/index.ts');
    expect(indexSource).toContain('validateChangeOrderSentPayload');
    expect(indexSource).toContain('[ChangeOrderEmail] Payload received');
  });

  it('stacks send modal above planner drawer', () => {
    const modalSource = readSource('src/components/change-order/ChangeOrderSendEmailModal.tsx');
    expect(modalSource).toContain('stackAboveDrawer');
  });
});
