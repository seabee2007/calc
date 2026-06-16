import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProjectForm from './ProjectForm';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../features/projects/data/projectScopeTemplates', () => {
  const templates = [
    {
      id: 'res-wood-frame-house',
      label: 'New Single-Family Wood-Frame House',
      category: 'Residential',
      description: 'Full construction of a new wood-frame residence',
      scopeText: 'RESIDENTIAL TEMPLATE SCOPE TEXT',
    },
    {
      id: 'metal-pemb',
      label: 'Pre-Engineered Metal Building (PEMB)',
      category: 'Metal & Pre-Engineered',
      description: 'Pre-engineered metal building supply and erection',
      scopeText: 'METAL TEMPLATE SCOPE TEXT',
    },
  ];
  return {
    PROJECT_SCOPE_TEMPLATES: templates,
    getProjectScopeTemplateById: (id: string) => templates.find(t => t.id === id),
    getProjectScopeTemplatesByCategory: () => ({
      Residential: [templates[0]],
      'Metal & Pre-Engineered': [templates[1]],
    }),
  };
});

vi.mock('../../store', () => ({
  useProjectStore: (selector: (state: { projects: [] }) => unknown) =>
    selector({ projects: [] }),
}));

vi.mock('../../services/clientPortalService', () => ({
  fetchClientPortalByProjectId: vi.fn().mockResolvedValue(null),
  getClientPortalUrl: (token: string) => `https://example.com/portal/${token}`,
}));

const mockHasFeature = vi.fn((feature: string) => feature === 'client_portal');

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    hasFeature: mockHasFeature,
    loading: false,
  }),
}));

function renderProjectForm(
  props: Partial<React.ComponentProps<typeof ProjectForm>> = {},
) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  render(
    <MemoryRouter>
      <ProjectForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isEditing
        hidePourDate
        initialData={{
        name: 'Test Project',
        description: 'Scope text',
        clientInfo: {
          clientName: 'Jane Client',
          clientCompany: 'Client Co',
          clientEmail: 'jane@client.com',
          clientPhone: '(555) 111-2222',
          clientAddressSameAsJobsite: true,
        },
        jobsiteAddress: {
          street: '123 Main St',
          street2: '',
          city: 'Atlanta',
          state: 'GA',
          zip: '30301',
        },
        projectCrewSize: 7,
      }}
      {...props}
      />
    </MemoryRouter>,
  );

  return { onSubmit, onCancel };
}

async function enableClientPortalInvite(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('checkbox', { name: /Invite client to view project dashboard/i }),
  );
}

describe('ProjectForm client portal access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasFeature.mockImplementation((feature: string) => feature === 'client_portal');
  });

  it('does not render duplicate client name/email/phone fields in Client Access', async () => {
    const user = userEvent.setup();
    renderProjectForm();

    await enableClientPortalInvite(user);

    const preview = screen.getByTestId('client-portal-invite-preview');
    expect(within(preview).queryByRole('textbox')).not.toBeInTheDocument();
    expect(document.querySelectorAll('input[name="clientPortalAccess.clientName"]')).toHaveLength(0);
    expect(document.querySelectorAll('input[name="clientPortalAccess.clientEmail"]')).toHaveLength(0);
    expect(document.querySelectorAll('input[name="clientPortalAccess.clientPhone"]')).toHaveLength(0);
    expect(document.querySelectorAll('input[name="clientInfo.clientName"]')).toHaveLength(1);
    expect(document.querySelectorAll('input[name="clientInfo.clientEmail"]')).toHaveLength(1);
  });

  it('shows invite preview from main client fields', async () => {
    const user = userEvent.setup();
    renderProjectForm();

    await enableClientPortalInvite(user);

    const preview = screen.getByTestId('client-portal-invite-preview');
    expect(within(preview).getByText('Jane Client')).toBeInTheDocument();
    expect(within(preview).getByText('jane@client.com')).toBeInTheDocument();
    expect(within(preview).getByText(/Phone: \(555\) 111-2222/)).toBeInTheDocument();
  });

  it('updates invite preview when main client email changes', async () => {
    const user = userEvent.setup();
    renderProjectForm();

    await enableClientPortalInvite(user);

    const emailInput = screen.getByTestId('client-info-email-input');
    await user.clear(emailInput);
    await user.type(emailInput, 'updated@client.com');

    const preview = screen.getByTestId('client-portal-invite-preview');
    expect(within(preview).getByText('updated@client.com')).toBeInTheDocument();
  });

  it('shows missing email warning and focuses main client email input', async () => {
    const user = userEvent.setup();
    renderProjectForm({
      initialData: {
        name: 'Test Project',
        description: 'Scope text',
        clientInfo: {
          clientName: 'Jane Client',
          clientAddressSameAsJobsite: true,
        },
        jobsiteAddress: {
          street: '123 Main St',
          street2: '',
          city: 'Atlanta',
          state: 'GA',
          zip: '30301',
        },
        projectCrewSize: 7,
      },
    });

    await enableClientPortalInvite(user);

    expect(
      screen.getByText('Client email is required to send a portal invite.'),
    ).toBeInTheDocument();

    const emailInput = screen.getByTestId('client-info-email-input');
    await user.click(screen.getByRole('button', { name: 'Add client email' }));
    expect(emailInput).toHaveFocus();
  });

  it('requires a valid invite email when portal invite is enabled', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderProjectForm({
      initialData: {
        name: 'Test Project',
        description: 'Scope text',
        clientInfo: {
          clientName: 'Jane Client',
          clientAddressSameAsJobsite: true,
        },
        jobsiteAddress: {
          street: '123 Main St',
          street2: '',
          city: 'Atlanta',
          state: 'GA',
          zip: '30301',
        },
        projectCrewSize: 7,
      },
    });

    await enableClientPortalInvite(user);
    await user.click(screen.getByRole('button', { name: 'Update Project' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Client email is required to send a portal invite.'),
    ).toBeInTheDocument();
  });

  it('uses override invite email for portal invite only', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderProjectForm();

    await enableClientPortalInvite(user);
    await user.click(screen.getByRole('button', { name: 'Use different invite email' }));
    await user.type(
      screen.getByTestId('invite-email-override-input'),
      'portal@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Update Project' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.clientInfo.clientEmail).toBe('jane@client.com');
    expect(payload.clientPortalAccess).toMatchObject({
      enabled: true,
      clientEmail: 'portal@example.com',
      overrideInviteEmail: 'portal@example.com',
      clientName: 'Jane Client',
    });
  });

  it('does not require client email when portal invite is disabled', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderProjectForm({
      initialData: {
        name: 'Test Project',
        description: 'Scope text',
        clientInfo: {
          clientName: 'Jane Client',
          clientAddressSameAsJobsite: true,
        },
        jobsiteAddress: {
          street: '123 Main St',
          street2: '',
          city: 'Atlanta',
          state: 'GA',
          zip: '30301',
        },
        projectCrewSize: 7,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Update Project' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].clientInfo.clientEmail).toBeFalsy();
    expect(onSubmit.mock.calls[0][0].clientPortalAccess?.enabled).toBe(false);
  });

  it('shows helper text for portal invite settings panel', async () => {
    const user = userEvent.setup();
    renderProjectForm();

    await enableClientPortalInvite(user);

    expect(
      screen.getByText(
        'Client portal access uses the client information above. You can override the invite email if needed.',
      ),
    ).toBeInTheDocument();
  });

  it('locks client portal invite for users without client_portal entitlement', () => {
    mockHasFeature.mockReturnValue(false);
    renderProjectForm();

    expect(screen.getByTestId('client-portal-locked')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-required-client_portal')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Invite client to view project dashboard/i }),
    ).toBeDisabled();
  });

  it('strips client portal access from submit payload when entitlement is missing', async () => {
    mockHasFeature.mockReturnValue(false);
    const user = userEvent.setup();
    const { onSubmit } = renderProjectForm({
      initialData: {
        name: 'Test Project',
        description: 'Scope text',
        clientInfo: {
          clientName: 'Jane Client',
          clientEmail: 'jane@client.com',
          clientAddressSameAsJobsite: true,
        },
        jobsiteAddress: {
          street: '123 Main St',
          street2: '',
          city: 'Atlanta',
          state: 'GA',
          zip: '30301',
        },
        projectCrewSize: 7,
        clientPortalAccess: {
          enabled: true,
          clientName: 'Jane Client',
          clientEmail: 'jane@client.com',
        },
      },
    });

    await user.click(screen.getByRole('button', { name: 'Update Project' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].clientPortalAccess?.enabled).toBe(false);
  });
});

describe('scope template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the template select dropdown', () => {
    renderProjectForm();
    expect(screen.getByTestId('scope-template-select')).toBeInTheDocument();
  });

  it('selecting a template with an empty scope populates the textarea immediately', async () => {
    const user = userEvent.setup();
    renderProjectForm({
      initialData: {
        name: 'Test Project',
        description: '',
        clientInfo: {
          clientName: 'Jane Client',
          clientCompany: 'Client Co',
          clientEmail: 'jane@client.com',
          clientPhone: '(555) 111-2222',
          clientAddressSameAsJobsite: true,
        },
        jobsiteAddress: {
          street: '123 Main St',
          street2: '',
          city: 'Atlanta',
          state: 'GA',
          zip: '30301',
        },
        projectCrewSize: 7,
      },
    });

    await user.selectOptions(
      screen.getByTestId('scope-template-select'),
      'res-wood-frame-house',
    );

    const textarea = screen.getByRole('textbox', { name: /project scope/i });
    expect(textarea).toHaveValue('RESIDENTIAL TEMPLATE SCOPE TEXT');
    expect(screen.queryByText(/Replace current scope/)).not.toBeInTheDocument();
  });

  it('selecting a template with existing scope shows the confirmation banner', async () => {
    const user = userEvent.setup();
    renderProjectForm();

    await user.selectOptions(
      screen.getByTestId('scope-template-select'),
      'metal-pemb',
    );

    expect(screen.getByText(/Replace current scope with this template/)).toBeInTheDocument();
  });

  it('clicking Replace in the confirmation applies the template text', async () => {
    const user = userEvent.setup();
    renderProjectForm();

    await user.selectOptions(
      screen.getByTestId('scope-template-select'),
      'metal-pemb',
    );

    await user.click(screen.getByRole('button', { name: 'Replace' }));

    const textarea = screen.getByRole('textbox', { name: /project scope/i });
    expect(textarea).toHaveValue('METAL TEMPLATE SCOPE TEXT');
    expect(screen.queryByText(/Replace current scope/)).not.toBeInTheDocument();
  });

  it('clicking Cancel leaves the original scope unchanged and hides the banner', async () => {
    const user = userEvent.setup();
    renderProjectForm();

    await user.selectOptions(
      screen.getByTestId('scope-template-select'),
      'metal-pemb',
    );

    expect(screen.getByText(/Replace current scope with this template/)).toBeInTheDocument();

    await user.click(screen.getByTestId('scope-template-cancel'));

    const textarea = screen.getByRole('textbox', { name: /project scope/i });
    expect(textarea).toHaveValue('Scope text');
    expect(screen.queryByText(/Replace current scope/)).not.toBeInTheDocument();
  });
});
