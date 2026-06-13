import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClearableNumberInput from './ClearableNumberInput';

describe('ClearableNumberInput', () => {
  it('shows an empty field with placeholder when value is zero', () => {
    render(
      <ClearableNumberInput
        label="Permits ($)"
        value={0}
        onChange={vi.fn()}
        data-testid="permits-input"
      />,
    );

    const input = screen.getByTestId('permits-input');
    expect(input).toHaveValue(null);
    expect(input).toHaveAttribute('placeholder', '0');
  });

  it('allows clearing and typing a new number', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ClearableNumberInput
        label="Permits ($)"
        value={0}
        onChange={onChange}
        data-testid="permits-input"
      />,
    );

    const input = screen.getByTestId('permits-input');
    await user.click(input);
    await user.type(input, '125');

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toBe(125);
  });

  it('treats a cleared field as zero for calculations', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ClearableNumberInput
        label="Fees ($)"
        value={250}
        onChange={onChange}
        data-testid="fees-input"
      />,
    );

    const input = screen.getByTestId('fees-input');
    await user.clear(input);

    expect(onChange).toHaveBeenCalledWith(0);
  });
});
