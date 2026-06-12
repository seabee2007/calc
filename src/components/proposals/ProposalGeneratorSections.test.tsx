import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalProjectSourcePanel from './ProposalProjectSourcePanel';
import ProposalBusinessInfoCollapsible from './ProposalBusinessInfoCollapsible';
import ProposalClientRecipientSection from './ProposalClientRecipientSection';
import { EMPTY_PROPOSAL_DOCUMENT_FIELDS } from '../../types/proposal';
import { EMPTY_US_ADDRESS } from '../../types/address';
import { emptyProposalPricingState } from '../../utils/proposalPricing';

const sampleData = {
  businessName: 'Acme Concrete',
  businessEmail: 'office@acme.com',
  businessPhone: '(555) 123-4567',
  businessLogoUrl: 'https://example.com/logo.png',
  clientName: 'Jane Client',
  clientCompany: 'Client Co',
  clientEmail: 'jane@client.com',
  clientPhone: '(555) 111-2222',
  clientAddress: '',
  clientAddressParts: { ...EMPTY_US_ADDRESS },
  projectTitle: 'Riverfront Slab',
  date: 'January 1, 2026',
  introduction: 'Intro',
  scope: 'Scope text',
  timeline: [{ phase: '', start: '', end: '' }],
  ...emptyProposalPricingState(),
  ...EMPTY_PROPOSAL_DOCUMENT_FIELDS,
};

describe('ProposalProjectSourcePanel', () => {
  it('renders project import selector', () => {
    render(
      <ProposalProjectSourcePanel
        projects={[
          {
            id: 'p1',
            name: 'Riverfront Slab',
            description: '',
            clientInfo: { clientName: 'Jane Client' },
          } as never,
        ]}
        selectedProjectId={null}
        onSelectProject={vi.fn()}
        onImportProject={vi.fn()}
        onClearProject={vi.fn()}
      />,
    );

    expect(screen.getByTestId('proposal-project-selector')).toBeInTheDocument();
    expect(
      screen.getByText('Create proposal manually or import details from an existing project.'),
    ).toBeInTheDocument();
  });
});

describe('ProposalBusinessInfoCollapsible', () => {
  it('is collapsed by default and can expand', async () => {
    const user = userEvent.setup();
    const onToggleExpanded = vi.fn();

    render(
      <ProposalBusinessInfoCollapsible
        data={sampleData}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        onFieldChange={vi.fn()}
        onAddressChange={vi.fn()}
        onPhoneChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('proposal-business-info-summary')).toHaveTextContent(
      'Acme Concrete',
    );
    expect(screen.queryByPlaceholderText('Your Business Name')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('proposal-business-info-toggle'));
    expect(onToggleExpanded).toHaveBeenCalled();
  });

  it('shows editable business fields when expanded', () => {
    render(
      <ProposalBusinessInfoCollapsible
        data={sampleData}
        expanded
        onToggleExpanded={vi.fn()}
        onFieldChange={vi.fn()}
        onAddressChange={vi.fn()}
        onPhoneChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('Your Business Name')).toBeInTheDocument();
  });
});

describe('ProposalClientRecipientSection', () => {
  it('shows auto-filled client recipient fields from imported project context', () => {
    render(
      <ProposalClientRecipientSection
        data={sampleData}
        selectedProjectId="p1"
        onFieldChange={vi.fn()}
        onAddressChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('proposal-client-name-input')).toHaveValue('Jane Client');
    expect(screen.getByTestId('proposal-recipient-email-input')).toHaveValue('jane@client.com');
  });

  it('allows overriding proposal recipient email', async () => {
    const user = userEvent.setup();
    const onFieldChange = vi.fn();

    render(
      <ProposalClientRecipientSection
        data={sampleData}
        selectedProjectId="p1"
        onFieldChange={onFieldChange}
        onAddressChange={vi.fn()}
      />,
    );

    await user.clear(screen.getByTestId('proposal-recipient-email-input'));
    await user.type(screen.getByTestId('proposal-recipient-email-input'), 'portal@example.com');

    expect(onFieldChange).toHaveBeenCalled();
  });
});
