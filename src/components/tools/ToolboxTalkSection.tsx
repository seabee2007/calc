import React from 'react';
import type { ToolboxTalk } from '../../types/fieldTools';
import {
  TOOLBOX_TALK_TOPIC_OPTIONS,
  getToolboxTalk,
  type ToolboxTalkTopicKey,
} from '../../data/toolboxTalkTopics';
import Select from '../ui/Select';
import { FIELD_TOOL_MUTED } from './fieldToolTheme';

interface ToolboxTalkSectionProps {
  topicKey: string;
  content: ToolboxTalk | null;
  onTopicChange: (topicKey: string, content: ToolboxTalk | null) => void;
}

export default function ToolboxTalkSection({
  topicKey,
  content,
  onTopicChange,
}: ToolboxTalkSectionProps) {
  return (
    <div className="space-y-4">
      <Select
        label="Toolbox talk topic"
        value={topicKey}
        onChange={(v) => {
          if (!v) {
            onTopicChange('', null);
            return;
          }
          const talk = getToolboxTalk(v as ToolboxTalkTopicKey);
          onTopicChange(v, talk);
        }}
        options={[
          { value: '', label: 'Select a topic…' },
          ...TOOLBOX_TALK_TOPIC_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
        ]}
        fullWidth
      />

      {content ? (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-50/50 p-4 dark:border-cyan-500/25 dark:bg-cyan-950/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{content.title}</h3>
          <p className={`mt-2 ${FIELD_TOOL_MUTED}`}>{content.explanation}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                Key hazards
              </p>
              <ul className="mt-1 list-disc pl-4 text-sm text-gray-700 dark:text-slate-300">
                {content.keyHazards.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                Safe work practices
              </p>
              <ul className="mt-1 list-disc pl-4 text-sm text-gray-700 dark:text-slate-300">
                {content.safePractices.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-4 text-sm font-medium text-amber-800 dark:text-amber-200">
            Crew reminder: {content.crewReminder}
          </p>
          <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">
            <span className="font-semibold">Supervisor question:</span> {content.supervisorQuestion}
          </p>
        </div>
      ) : (
        <p className={FIELD_TOOL_MUTED}>Select a topic to generate the toolbox talk for today&apos;s meeting.</p>
      )}
    </div>
  );
}
