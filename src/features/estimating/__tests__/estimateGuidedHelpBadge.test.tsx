import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EstimateGuidedHelpBadge from '../ui/components/EstimateGuidedHelpBadge';

describe('EstimateGuidedHelpBadge', () => {
  it('opens the guide when the help affordance is clicked', async () => {
    const user = userEvent.setup();
    const onOpenGuide = vi.fn();
    const onDismiss = vi.fn();

    render(<EstimateGuidedHelpBadge onOpenGuide={onOpenGuide} onDismiss={onDismiss} />);

    const openButtons = screen.getAllByRole('button', { name: 'Open estimate help' });
    await user.click(openButtons[0]!);

    expect(onOpenGuide).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses the guided help badge', async () => {
    const user = userEvent.setup();
    const onOpenGuide = vi.fn();
    const onDismiss = vi.fn();

    render(<EstimateGuidedHelpBadge onOpenGuide={onOpenGuide} onDismiss={onDismiss} />);

    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss estimate help' });
    await user.click(dismissButtons[0]!);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenGuide).not.toHaveBeenCalled();
  });

  it('renders the mobile guide affordance copy', () => {
    render(<EstimateGuidedHelpBadge onOpenGuide={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Need help? Guide')).toBeInTheDocument();
  });
});
