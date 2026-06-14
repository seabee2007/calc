import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ToolboxTalkSection from '../../components/tools/ToolboxTalkSection';
import { emptySafetyMeeting } from '../../pages/tools/safetyMeetingDefaults';
import {
  normalizeSafetyMeeting,
  normalizeToolboxTalkContent,
} from '../normalizeToolboxTalk';
import { safetyMeetingToolHref } from '../plannerRoutes';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('normalizeToolboxTalkContent', () => {
  it('returns null for null or undefined content', () => {
    expect(normalizeToolboxTalkContent(null)).toBeNull();
    expect(normalizeToolboxTalkContent(undefined)).toBeNull();
  });

  it('returns null for empty partial objects saved without arrays', () => {
    expect(normalizeToolboxTalkContent({})).toBeNull();
  });

  it('fills missing arrays when title exists', () => {
    const normalized = normalizeToolboxTalkContent({
      title: 'Fall protection',
      explanation: 'Use harnesses correctly.',
    });

    expect(normalized).toEqual({
      topicKey: '',
      title: 'Fall protection',
      explanation: 'Use harnesses correctly.',
      keyHazards: [],
      safePractices: [],
      crewReminder: '',
      supervisorQuestion: '',
    });
  });

  it('preserves existing array fields', () => {
    const normalized = normalizeToolboxTalkContent({
      title: 'Excavation',
      keyHazards: ['Cave-in'],
      safePractices: ['Slope or shore'],
    });

    expect(normalized?.keyHazards).toEqual(['Cave-in']);
    expect(normalized?.safePractices).toEqual(['Slope or shore']);
  });
});

describe('normalizeSafetyMeeting', () => {
  it('normalizes new meetings with empty arrays', () => {
    const meeting = normalizeSafetyMeeting(emptySafetyMeeting());

    expect(meeting.jhaRows).toEqual([]);
    expect(meeting.attendees).toEqual([]);
    expect(meeting.toolboxContent).toBeNull();
  });

  it('normalizes older partial toolbox content on load', () => {
    const meeting = normalizeSafetyMeeting({
      ...emptySafetyMeeting(),
      toolboxTopic: 'falls',
      toolboxContent: {
        topicKey: 'falls',
        title: 'Fall protection',
        explanation: 'Stay tied off.',
      } as never,
    });

    expect(meeting.toolboxContent?.keyHazards).toEqual([]);
    expect(meeting.toolboxContent?.safePractices).toEqual([]);
  });
});

describe('ToolboxTalkSection', () => {
  it('renders when keyHazards is undefined on partial content', () => {
    render(
      <ToolboxTalkSection
        topicKey="falls"
        content={{
          topicKey: 'falls',
          title: 'Fall protection',
          explanation: 'Use harnesses correctly.',
        } as never}
        onTopicChange={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Fall protection' })).toBeInTheDocument();
    expect(screen.getByText('Key hazards')).toBeInTheDocument();
    expect(screen.getAllByText('None listed.')).toHaveLength(2);
  });

  it('renders when all optional arrays are missing', () => {
    render(
      <ToolboxTalkSection
        topicKey=""
        content={null}
        onTopicChange={() => {}}
      />,
    );

    expect(
      screen.getByText("Select a topic to generate the toolbox talk for today's meeting."),
    ).toBeInTheDocument();
  });
});

describe('safety meeting tool routes', () => {
  it('uses string slugs without anonymous code', () => {
    const href = safetyMeetingToolHref('project-1', 'meeting-2');
    expect(href).toBe('/tools/safety-meeting?project=project-1&id=meeting-2');
    expect(href).not.toContain('<anonymous');
    expect(href).not.toContain('%3C');
  });
});

describe('safetyMeetingService save payload', () => {
  it('persists normalized toolbox content instead of empty objects', () => {
    const source = readFileSync(path.join(repoRoot, 'services/safetyMeetingService.ts'), 'utf8');
    expect(source).toContain('toolbox_content: normalized.toolboxContent');
    expect(source).not.toContain('toolbox_content: meeting.toolboxContent ?? {}');
  });
});
