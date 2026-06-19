import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TermsOfService from './TermsOfService';
import { COMPANY_LEGAL_NAME, COMPANY_PHONE, PRODUCT_OPERATOR_PHRASE } from '../../lib/companyInfo';

describe('TermsOfService liability protections', () => {
  it('includes availability, backup, consequential damages, and liability cap language', () => {
    const { container } = render(<TermsOfService />);
    const text = container.textContent ?? '';

    expect(text).toMatch(/AS IS/i);
    expect(text).toMatch(/AS AVAILABLE/i);
    expect(text).toMatch(/uninterrupted, timely, secure, error-free/i);
    expect(text).toMatch(/independent, duplicate records/i);
    expect(text).toMatch(/consequential/i);
    expect(text).toMatch(/loss of profits/i);
    expect(text).toMatch(/loss of data/i);
    expect(text).toMatch(/twelve \(12\) months/i);
    expect(text).toMatch(/\$100/);
    expect(text).not.toMatch(/CONCRETE CALC AND ITS/i);
    expect(text).not.toMatch(/Insert Legal/i);

    expect(screen.getByRole('heading', { name: /28\. Availability, Outages, and Data Responsibility/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /29\. Contractor Deadlines, Bids, and Project Outcomes/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /32\. Exclusion of Consequential Damages/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /33\. Limitation of Liability/i })).toBeInTheDocument();
  });

  it('shows legal operator and contact information', () => {
    render(<TermsOfService />);

    expect(screen.getByText(PRODUCT_OPERATOR_PHRASE)).toBeInTheDocument();
    expect(screen.getAllByText(COMPANY_LEGAL_NAME).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: COMPANY_PHONE })).toBeInTheDocument();
  });
});
