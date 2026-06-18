import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactUs from './ContactUs';
import { SUPPORT_EMAIL } from '../../config/brand';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_MAILING_ADDRESS_LINES,
  COMPANY_PHONE,
} from '../../lib/companyInfo';

vi.mock('../support/SupportRequestModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="support-request-modal">Support modal open</div> : null,
}));

describe('ContactUs', () => {
  it('keeps support email visible', () => {
    render(<ContactUs />);
    expect(screen.getByRole('button', { name: SUPPORT_EMAIL })).toBeInTheDocument();
  });

  it('shows legal mailing address and business phone', () => {
    const { container } = render(<ContactUs />);
    const text = container.textContent ?? '';

    expect(text).toContain(COMPANY_LEGAL_NAME);
    for (const line of COMPANY_MAILING_ADDRESS_LINES) {
      expect(text).toContain(line);
    }
    expect(screen.getByRole('link', { name: COMPANY_PHONE })).toHaveAttribute(
      'href',
      'tel:+15753101681',
    );
    expect(text).not.toMatch(/Insert Legal Business Mailing Address/i);
  });

  it('opens support request modal when support email is clicked', async () => {
    const user = userEvent.setup();
    render(<ContactUs />);

    expect(screen.queryByTestId('support-request-modal')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: SUPPORT_EMAIL }));
    expect(screen.getByTestId('support-request-modal')).toBeInTheDocument();
  });
});
