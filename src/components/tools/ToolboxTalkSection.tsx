import React from 'react';
import type { ToolboxTalk } from '../../types/fieldTools';
import {
  TOOLBOX_TALK_TOPIC_OPTIONS,
  getToolboxTalk,
  type ToolboxTalkTopicKey,
} from '../../data/toolboxTalkTopics';
import { normalizeToolboxTalkContent } from '../../utils/normalizeToolboxTalk';
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
  const talk = content ? normalizeToolboxTalkContent(content) : null;

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
          const selected = normalizeToolboxTalkContent(getToolboxTalk(v as ToolboxTalkTopicKey));
          onTopicChange(v, selected);
        }}
        options={[
          { value: '', label: 'Select a topic…' },
          ...TOOLBOX_TALK_TOPIC_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
        ]}
        fullWidth
      />

      {talk?.title ? (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-50/50 p-4 dark:border-cyan-500/25 dark:bg-cyan-950/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{talk.title}</h3>
          <p className={`mt-2 ${FIELD_TOOL_MUTED}`}>{talk.explanation}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                Key hazards
              </p>
              {talk.keyHazards.length > 0 ? (
                <ul className="mt-1 list-disc pl-4 text-sm text-gray-700 dark:text-slate-300">
                  {talk.keyHazards.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              ) : (
                <p className={`mt-1 text-sm ${FIELD_TOOL_MUTED}`}>None listed.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                Safe work practices
              </p>
              {talk.safePractices.length > 0 ? (
                <ul className="mt-1 list-disc pl-4 text-sm text-gray-700 dark:text-slate-300">
                  {talk.safePractices.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className={`mt-1 text-sm ${FIELD_TOOL_MUTED}`}>None listed.</p>
              )}
            </div>
          </div>

          {talk.crewReminder ? (
            <p className="mt-4 text-sm font-medium text-amber-800 dark:text-amber-200">
              Crew reminder: {talk.crewReminder}
            </p>
          ) : null}
          {talk.supervisorQuestion ? (
            <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">
              <span className="font-semibold">Supervisor question:</span> {talk.supervisorQuestion}
            </p>
          ) : null}
        </div>
      ) : (
        <p className={FIELD_TOOL_MUTED}>Select a topic to generate the toolbox talk for today&apos;s meeting.</p>
      )}
    </div>
  );
}
