import { describe, expect, it } from 'vitest';
import {
  SUPPORT_REQUEST_TOPIC_OPTIONS,
  buildSupportMessageTemplate,
  buildSupportTopicDefaults,
  getDefaultSubjectForTopic,
  topicRequiresCustomSubject,
} from './supportRequestTopics';

describe('supportRequestTopics', () => {
  it('exposes all support topic options', () => {
    expect(SUPPORT_REQUEST_TOPIC_OPTIONS.map((option) => option.label)).toEqual([
      'Billing or subscription',
      'Login or account access',
      'Project setup',
      'Estimate or proposal issue',
      'Scheduling or Planner Hub',
      'File import or export',
      'Client portal',
      'Bug report',
      'Feature request',
      'Data issue',
      'Other / Not listed',
    ]);
  });

  it('auto-populates billing subject and body without account metadata', () => {
    expect(getDefaultSubjectForTopic('billing')).toBe('Billing or subscription support');
    const body = buildSupportMessageTemplate('billing');
    expect(body).toContain('I need help with billing or my subscription.');
    expect(body).not.toContain('Account email:');
    expect(body).not.toContain('Current plan:');
  });

  it('auto-populates bug report template without account metadata', () => {
    const body = buildSupportMessageTemplate('bug_report');
    expect(body).toContain('I found a bug.');
    expect(body).toContain('Steps to reproduce:');
    expect(body).not.toContain('Account email:');
  });

  it('auto-populates feature request template without account metadata', () => {
    const body = buildSupportMessageTemplate('feature_request');
    expect(body).toContain('I have a feature request.');
    expect(body).toContain('Feature idea:');
    expect(body).not.toContain('Account email:');
  });

  it('requires custom subject for Other / Not listed', () => {
    expect(topicRequiresCustomSubject('other')).toBe(true);
    expect(getDefaultSubjectForTopic('other')).toBe('');
    expect(buildSupportTopicDefaults('other').subject).toBe('');
  });
});
