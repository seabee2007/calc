export function buildChangeOrderInviteSubject(projectName: string): string {
  const name = projectName.trim() || 'your project';
  return `Change Order for ${name}`;
}

export function buildChangeOrderInviteMessageTemplate(): string {
  return [
    'Hi {clientName},',
    '',
    'A change order is ready for your review.',
    '',
    'Project:',
    '{projectName}',
    '',
    'Change Order:',
    '{changeOrderTitle}',
    '',
    'Review and respond here:',
    '{changeOrderUrl}',
    '',
    'Please review the change order and approve or decline it using the secure link.',
    '',
    'Thank you,',
    '{companyName}',
  ].join('\n');
}

export function applyChangeOrderInvitePlaceholders(
  template: string,
  values: {
    clientName: string;
    projectName: string;
    changeOrderTitle: string;
    changeOrderUrl: string;
    companyName: string;
  },
): string {
  return template
    .replaceAll('{clientName}', values.clientName)
    .replaceAll('{projectName}', values.projectName)
    .replaceAll('{changeOrderTitle}', values.changeOrderTitle)
    .replaceAll('{changeOrderUrl}', values.changeOrderUrl)
    .replaceAll('{companyName}', values.companyName);
}

export { isTransactionalEmailEnabled } from './clientPortalInviteEmail';
