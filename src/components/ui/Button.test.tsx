import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('renders as a single button element inside paragraph content', () => {
    render(
      <p>
        Or{' '}
        <Button type="button" variant="ghost">
          create account
        </Button>
      </p>,
    );

    const button = screen.getByRole('button', { name: 'create account' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.parentElement?.tagName).toBe('P');
  });

  it('keeps icon and label as one button child tree', () => {
    render(
      <Button icon={<span data-testid="icon">*</span>}>
        Continue
      </Button>,
    );

    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue/ })).toBeInTheDocument();
  });
});
