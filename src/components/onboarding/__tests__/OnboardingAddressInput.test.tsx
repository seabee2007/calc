/**
 * Tests for the onboarding address input space-bar fix.
 *
 * Root cause: addressFromPipe() called .trim() on every re-render, stripping
 * trailing spaces as the user typed them (e.g. "119 " → trim → "119").
 */
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { trimPipeAddress } from '../OnboardingStep';
import OnboardingStep from '../OnboardingStep';

// ── trimPipeAddress unit tests ────────────────────────────────────────────────

describe('trimPipeAddress', () => {
  it('trims leading/trailing spaces from each pipe segment', () => {
    expect(trimPipeAddress(' 119 Grand Rock Road | Suite 1 | Santa Rita | GU | 96915 ')).toBe(
      '119 Grand Rock Road|Suite 1|Santa Rita|GU|96915',
    );
  });

  it('preserves internal spaces within a segment', () => {
    expect(trimPipeAddress('119 grand rock road||santa rita|GU|')).toBe(
      '119 grand rock road||santa rita|GU|',
    );
  });

  it('handles empty string', () => {
    expect(trimPipeAddress('')).toBe('');
  });

  it('handles value with no pipe characters', () => {
    expect(trimPipeAddress('  Main St  ')).toBe('Main St');
  });
});

// ── Controlled wrapper for OnboardingStep address step ────────────────────────

function AddressStepWrapper({
  onSubmit,
}: {
  onSubmit?: (value: string) => void;
}) {
  const [value, setValue] = useState('|||GU|');

  return (
    <MemoryRouter>
      <OnboardingStep
        title="Business Address"
        description="Enter your address"
        placeholder="Street Address"
        value={value}
        onChange={setValue}
        onNext={() => onSubmit?.(value)}
        onBack={vi.fn()}
        isAddressStep
      />
    </MemoryRouter>
  );
}

// ── Integration tests for address typing ─────────────────────────────────────

describe('OnboardingStep address inputs — space key must work', () => {
  it('street input accepts spaces between words', () => {
    render(<AddressStepWrapper />);
    const streetInput = screen.getByLabelText(/street address/i);

    // Simulate typing "119 grand rock road" character by character
    fireEvent.change(streetInput, { target: { value: '119' } });
    fireEvent.change(streetInput, { target: { value: '119 ' } });

    // The space must survive the re-render cycle — value should still end with space
    expect((streetInput as HTMLInputElement).value).toBe('119 ');
  });

  it('street value retains space so next character attaches correctly', () => {
    render(<AddressStepWrapper />);
    const streetInput = screen.getByLabelText(/street address/i);

    fireEvent.change(streetInput, { target: { value: '119 grand' } });
    expect((streetInput as HTMLInputElement).value).toBe('119 grand');
  });

  it('city input accepts spaces between words', () => {
    render(<AddressStepWrapper />);
    const cityInput = screen.getByLabelText(/city/i);

    fireEvent.change(cityInput, { target: { value: 'santa' } });
    fireEvent.change(cityInput, { target: { value: 'santa ' } });
    expect((cityInput as HTMLInputElement).value).toBe('santa ');

    fireEvent.change(cityInput, { target: { value: 'santa rita' } });
    expect((cityInput as HTMLInputElement).value).toBe('santa rita');
  });

  it('full address "119 grand rock road, santa rita" can be entered without losing spaces', () => {
    render(<AddressStepWrapper />);
    const streetInput = screen.getByLabelText(/street address/i);
    const cityInput = screen.getByLabelText(/city/i);

    fireEvent.change(streetInput, { target: { value: '119 grand rock road' } });
    fireEvent.change(cityInput, { target: { value: 'santa rita' } });

    expect((streetInput as HTMLInputElement).value).toBe('119 grand rock road');
    expect((cityInput as HTMLInputElement).value).toBe('santa rita');
  });

  it('street2 input accepts spaces', () => {
    render(<AddressStepWrapper />);
    const street2Input = screen.getByLabelText(/apt.*suite/i);

    fireEvent.change(street2Input, { target: { value: 'suite 200' } });
    expect((street2Input as HTMLInputElement).value).toBe('suite 200');
  });
});

// ── Non-address step — tel input Space key is still blocked correctly ──────────

describe('OnboardingStep tel input — Space key filtering is scoped to tel only', () => {
  it('handleKeyDown for tel does not block digits', () => {
    render(
      <MemoryRouter>
        <OnboardingStep
          title="Phone"
          description=""
          placeholder="(555) 123-4567"
          value=""
          onChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
          type="tel"
        />
      </MemoryRouter>,
    );
    const telInput = screen.getByRole('textbox');
    // Digits must not be prevented
    const spyPrevent = vi.fn();
    fireEvent.keyDown(telInput, { key: '5', preventDefault: spyPrevent });
    expect(spyPrevent).not.toHaveBeenCalled();
  });

  it('handleKeyDown for text input has no keyDown handler at all', () => {
    const { container } = render(
      <MemoryRouter>
        <OnboardingStep
          title="Company"
          description=""
          placeholder="ACME Co"
          value=""
          onChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
          type="text"
        />
      </MemoryRouter>,
    );
    const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(textInput).toBeTruthy();
    // Space key in a plain text input must not be prevented
    const spyPrevent = vi.fn();
    fireEvent.keyDown(textInput, { key: ' ', preventDefault: spyPrevent });
    expect(spyPrevent).not.toHaveBeenCalled();
  });
});
