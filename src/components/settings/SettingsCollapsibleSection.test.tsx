import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SettingsCollapsibleSection,
  type SettingsSectionId,
} from './SettingsCollapsibleSection';

function ToggleHarness() {
  const [expanded, setExpanded] = useState<Set<SettingsSectionId>>(new Set());

  const onToggle = (id: SettingsSectionId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SettingsCollapsibleSection
      id="notifications"
      icon={<span aria-hidden>icon</span>}
      title="Notifications"
      description="Stay informed."
      expanded={expanded.has('notifications')}
      onToggle={onToggle}
      testId="settings-section-notifications"
    >
      <p>Notification toggles</p>
    </SettingsCollapsibleSection>
  );
}

describe('SettingsCollapsibleSection', () => {
  it('calls onToggle with the section id when clicked', () => {
    const onToggle = vi.fn();

    render(
      <SettingsCollapsibleSection
        id="notifications"
        icon={<span aria-hidden>icon</span>}
        title="Notifications"
        description="Stay informed."
        expanded={false}
        onToggle={onToggle}
        testId="settings-section-notifications"
      >
        <p>Notification toggles</p>
      </SettingsCollapsibleSection>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    expect(onToggle).toHaveBeenCalledWith('notifications');
  });

  it('expands and collapses when wired to Set state', () => {
    render(<ToggleHarness />);

    const trigger = screen.getByRole('button', { name: /Notifications/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
