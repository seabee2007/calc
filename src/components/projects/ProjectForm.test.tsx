import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectForm from './ProjectForm';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../store', () => ({
  useProjectStore: (selector: (state: { projects: [] }) => unknown) =>
    selector({ projects: [] }),
}));

vi.mock('../../services/clientPortalService', () => ({
  fetchClientPortalByProjectId: vi.fn().mockResolvedValue(null),
  getClientPortalUrl: (token: string) => `https://example.com/portal/${token}`,
}));

function renderProjectForm(
  props: Partial<React.ComponentProps<typeof ProjectForm>> = {},
) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  render(
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
    />,
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
});
