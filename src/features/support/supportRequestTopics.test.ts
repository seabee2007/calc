import { describe, expect, it } from 'vitest';
import {
  SUPPORT_REQUEST_TOPIC_OPTIONS,
  buildSupportMessageTemplate,
  buildSupportTopicDefaults,
  getDefaultSubjectForTopic,
  topicRequiresCustomSubject,
} from './supportRequestTopics';

const ctx = {
  userEmail: 'user@example.com',
  browserInfo: 'TestBrowser/1.0',
  planName: 'professional',
};

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

  it('auto-populates billing subject and body', () => {
    expect(getDefaultSubjectForTopic('billing')).toBe('Billing or subscription support');
    const body = buildSupportMessageTemplate('billing', ctx);
    expect(body).toContain('I need help with billing or my subscription.');
    expect(body).toContain('professional');
    expect(body).toContain('user@example.com');
  });

  it('auto-populates bug report template', () => {
    const body = buildSupportMessageTemplate('bug_report', ctx);
    expect(body).toContain('I found a bug.');
    expect(body).toContain('Steps to reproduce:');
  });

  it('auto-populates feature request template', () => {
    const body = buildSupportMessageTemplate('feature_request', ctx);
    expect(body).toContain('I have a feature request.');
    expect(body).toContain('Feature idea:');
  });

  it('requires custom subject for Other / Not listed', () => {
    expect(topicRequiresCustomSubject('other')).toBe(true);
    expect(getDefaultSubjectForTopic('other')).toBe('');
    expect(buildSupportTopicDefaults('other', ctx).subject).toBe('');
  });
});
