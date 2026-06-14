import { describe, expect, it } from 'vitest';
import {
  applyChangeOrderInvitePlaceholders,
  buildChangeOrderInviteMessageTemplate,
  buildChangeOrderInviteSubject,
} from '../changeOrderInviteEmail';

describe('changeOrderInviteEmail', () => {
  it('builds default subject from project name', () => {
    expect(buildChangeOrderInviteSubject('Riverfront Slab')).toBe(
      'Change Order for Riverfront Slab',
    );
  });

  it('applies placeholders in message template', () => {
    const message = applyChangeOrderInvitePlaceholders(buildChangeOrderInviteMessageTemplate(), {
      clientName: 'Jane',
      projectName: 'Riverfront Slab',
      changeOrderTitle: 'Add patio',
      changeOrderUrl: 'https://app.example.com/change-order/token-1',
      companyName: 'Concrete Co',
    });

    expect(message).toContain('Hi Jane,');
    expect(message).toContain('Riverfront Slab');
    expect(message).toContain('Add patio');
    expect(message).toContain('https://app.example.com/change-order/token-1');
    expect(message).toContain('Concrete Co');
  });
});
