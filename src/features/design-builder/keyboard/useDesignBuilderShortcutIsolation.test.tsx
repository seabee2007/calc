import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { useDesignBuilderShortcutIsolation } from './useDesignBuilderShortcutIsolation';

function dispatchKeyboardEvent(target: Element | Window, type: 'keydown' | 'keyup', init: KeyboardEventInit) {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function Harness({ enabled = true }: { enabled?: boolean }) {
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const { altPressed } = useDesignBuilderShortcutIsolation({ enabled, rootElement });

  return (
    <div>
      <div ref={setRootElement} data-testid="design-builder-root" tabIndex={-1}>
        <button type="button" data-testid="inside-builder">Inside builder</button>
        <input data-testid="builder-input" aria-label="Builder input" />
      </div>
      <button type="button" data-testid="outside-builder">Outside builder</button>
      <output data-testid="alt-pressed">{altPressed ? 'pressed' : 'released'}</output>
    </div>
  );
}

describe('useDesignBuilderShortcutIsolation', () => {
  it('prevents Alt keydown inside Design Builder', () => {
    render(<Harness />);

    let event: KeyboardEvent;
    act(() => {
      event = dispatchKeyboardEvent(screen.getByTestId('inside-builder'), 'keydown', { key: 'Alt' });
    });

    expect(event!.defaultPrevented).toBe(true);
    expect(screen.getByTestId('alt-pressed')).toHaveTextContent('pressed');
  });

  it('prevents Alt keyup inside Design Builder', () => {
    render(<Harness />);
    act(() => {
      dispatchKeyboardEvent(screen.getByTestId('inside-builder'), 'keydown', { key: 'Alt' });
    });

    let event: KeyboardEvent;
    act(() => {
      event = dispatchKeyboardEvent(screen.getByTestId('inside-builder'), 'keyup', { key: 'Alt' });
    });

    expect(event!.defaultPrevented).toBe(true);
    expect(screen.getByTestId('alt-pressed')).toHaveTextContent('released');
  });

  it('does not capture Alt in an input inside Design Builder', () => {
    render(<Harness />);

    const event = dispatchKeyboardEvent(screen.getByTestId('builder-input'), 'keydown', { key: 'Alt' });

    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByTestId('alt-pressed')).toHaveTextContent('released');
  });

  it('does not capture Alt when an input inside Design Builder has focus', () => {
    render(<Harness />);
    screen.getByTestId('builder-input').focus();

    const event = dispatchKeyboardEvent(window, 'keydown', { key: 'Alt' });

    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByTestId('alt-pressed')).toHaveTextContent('released');
  });

  it('does not capture Alt outside Design Builder', () => {
    render(<Harness />);

    const event = dispatchKeyboardEvent(screen.getByTestId('outside-builder'), 'keydown', { key: 'Alt' });

    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByTestId('alt-pressed')).toHaveTextContent('released');
  });

  it('resets altPressed on blur', () => {
    render(<Harness />);
    act(() => {
      dispatchKeyboardEvent(screen.getByTestId('inside-builder'), 'keydown', { key: 'Alt' });
    });
    expect(screen.getByTestId('alt-pressed')).toHaveTextContent('pressed');

    act(() => {
      fireEvent.blur(window);
    });

    expect(screen.getByTestId('alt-pressed')).toHaveTextContent('released');
  });
});
