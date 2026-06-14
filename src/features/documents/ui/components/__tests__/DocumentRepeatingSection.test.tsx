import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DocumentRepeatingSectionAddButton,
  DocumentRepeatingSectionHeader,
} from '../DocumentRepeatingSection';

describe('DocumentRepeatingSection', () => {
  it('renders add button label on one line with nowrap styling', () => {
    render(<DocumentRepeatingSectionAddButton label="Add discrepancy" onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Add discrepancy' });
    expect(button).toHaveClass('whitespace-nowrap');
    expect(button).toHaveTextContent('Add discrepancy');
  });

  it('calls onAdd from section header', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <DocumentRepeatingSectionHeader
        title="Punch List Items / Discrepancies"
        description="Add each deficiency or punch item."
        addButtonLabel="Add discrepancy"
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add discrepancy' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
