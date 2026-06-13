import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingStep from '../OnboardingStep';

function renderPhoneStep(
  props: Partial<React.ComponentProps<typeof OnboardingStep>> = {},
) {
  const onChange = vi.fn();
  const onNext = vi.fn();
  const onBack = vi.fn();
  const onSkip = vi.fn();

  render(
    <OnboardingStep
      title="Phone Number"
      description="Enter your company phone number"
      placeholder="(555) 123-4567"
      value={props.value ?? ''}
      onChange={props.onChange ?? onChange}
      onNext={props.onNext ?? onNext}
      onBack={onBack}
      onSkip={props.onSkip ?? onSkip}
      type="tel"
      {...props}
    />,
  );

  return { onChange, onNext, onBack, onSkip };
}

describe('OnboardingStep phone number', () => {
  it('formats pasted long numbers to 10 digits', () => {
    const { onChange } = renderPhoneStep();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '12345678941231' } });

    expect(onChange).toHaveBeenLastCalledWith('(123) 456-7894');
  });

  it('normalizes an 11-digit number with leading 1 while typing', () => {
    const { onChange } = renderPhoneStep();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '11234567890' } });

    expect(onChange).toHaveBeenLastCalledWith('(123) 456-7890');
  });

  it('shows validation error when provided', () => {
    renderPhoneStep({
      value: '(123) 45',
      error: 'Enter a valid 10-digit phone number or skip this step.',
    });

    expect(
      screen.getByText('Enter a valid 10-digit phone number or skip this step.'),
    ).toBeInTheDocument();
  });

  it('still allows skip without entering a phone number', async () => {
    const user = userEvent.setup();
    const { onSkip } = renderPhoneStep();

    await user.click(screen.getByRole('button', { name: 'Skip' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
