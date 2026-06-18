import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserAvatarButton from './UserAvatarButton';

describe('UserAvatarButton', () => {
  it('renders first and last name initials', () => {
    render(
      <UserAvatarButton
        user={{ id: 'u1', email: 'user@example.com' } as never}
        profile={{ firstName: 'Donald', lastName: 'Duck', displayName: 'Donald Duck' }}
      />,
    );

    expect(screen.getByTestId('user-avatar-initials')).toHaveTextContent('DD');
  });

  it('does not render a generic user icon when initials are available', () => {
    const { container } = render(
      <UserAvatarButton
        user={{ id: 'u1', email: 'user@example.com' } as never}
        profile={{ firstName: 'Donald', lastName: 'Duck' }}
      />,
    );

    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByTestId('user-avatar-initials')).toHaveTextContent('DD');
  });

  it('calls onClick when pressed', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <UserAvatarButton
        user={{ id: 'u1', email: 'owner@example.com' } as never}
        profile={{ displayName: 'Owner' }}
        onClick={onClick}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Profile menu' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
