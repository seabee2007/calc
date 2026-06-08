import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENABLE_AI_SEQUENCE_ACTIVITIES } from '../schedulingFeatureFlags';

const logicNetworkWorkspaceSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LogicNetworkWorkspace.tsx',
  ),
  'utf8',
);

describe('schedulingFeatureFlags', () => {
  it('AI Sequence Activities is disabled by default', () => {
    expect(ENABLE_AI_SEQUENCE_ACTIVITIES).toBe(false);
  });

  it('Logic Network toolbar gates AI Sequence Activities behind the feature flag', () => {
    expect(logicNetworkWorkspaceSource).toContain('ENABLE_AI_SEQUENCE_ACTIVITIES');
    expect(logicNetworkWorkspaceSource).toContain('{ENABLE_AI_SEQUENCE_ACTIVITIES ? (');
    expect(logicNetworkWorkspaceSource).toContain('AI Sequence Activities');
  });
});
