import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalSetupPanel from './ProposalSetupPanel';
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

describe('ProposalSetupPanel', () => {
  it('renders compact project and title setup on one row', () => {
    render(
      <ProposalSetupPanel
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
        proposalTitle=""
        onProposalTitleChange={vi.fn()}
        onAutoGenerateTitle={vi.fn()}
      />,
    );

    expect(screen.getByTestId('proposal-setup-panel')).toBeInTheDocument();
    expect(
      screen.getByText('Import a project or create proposal title'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Start from a project estimate, or create a proposal title manually.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('proposal-setup-controls')).toBeInTheDocument();
    expect(screen.getByTestId('proposal-project-selector')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Select a project...' })).toBeInTheDocument();
    expect(screen.getByTestId('proposal-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('proposal-auto-generate-title-button')).toBeInTheDocument();
    expect(screen.queryByText('Nothing imported yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Import Current Estimate')).not.toBeInTheDocument();
    expect(screen.queryByText('Save Draft')).not.toBeInTheDocument();
  });

  it('selects a project from the dropdown', async () => {
    const user = userEvent.setup();
    const onSelectProject = vi.fn();

    render(
      <ProposalSetupPanel
        projects={[
          {
            id: 'p1',
            name: 'Riverfront Slab',
            description: '',
            clientInfo: { clientName: 'Jane Client' },
          } as never,
        ]}
        selectedProjectId={null}
        onSelectProject={onSelectProject}
        proposalTitle=""
        onProposalTitleChange={vi.fn()}
        onAutoGenerateTitle={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByTestId('proposal-project-selector'), 'p1');
    expect(onSelectProject).toHaveBeenCalledWith('p1');
  });

  it('calls auto generate from the setup card', async () => {
    const user = userEvent.setup();
    const onAutoGenerateTitle = vi.fn();

    render(
      <ProposalSetupPanel
        projects={[]}
        selectedProjectId={null}
        onSelectProject={vi.fn()}
        proposalTitle=""
        onProposalTitleChange={vi.fn()}
        onAutoGenerateTitle={onAutoGenerateTitle}
      />,
    );

    await user.click(screen.getByTestId('proposal-auto-generate-title-button'));
    expect(onAutoGenerateTitle).toHaveBeenCalled();
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
