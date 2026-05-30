import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import type { TaskComment } from '../../types/fieldPlanner';
import { addTaskComment } from '../../services/taskActivityService';
import Button from '../ui/Button';
import {
  PLANNER_BTN_PRIMARY,
  PLANNER_COMMENT_BOX,
  PLANNER_COMMENT_TEXT,
  PLANNER_ICON_ACCENT,
  PLANNER_INPUT,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  PLANNER_TASK_META,
} from './plannerTheme';

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
  userId: string;
  comments: TaskComment[];
  canComment: boolean;
  onChange: () => void;
}

export default function TaskComments({
  taskId,
  projectId,
  userId,
  comments,
  canComment,
  onChange,
}: TaskCommentsProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const handlePost = async () => {
    if (!text.trim() || !canComment) return;
    setBusy(true);
    try {
      await addTaskComment(taskId, projectId, userId, text.trim());
      setText('');
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className={`flex items-center gap-2 ${PLANNER_SECTION_TITLE}`}>
        <MessageSquare className={`h-4 w-4 ${PLANNER_ICON_ACCENT}`} />
        Field updates
      </h4>

      <ul className="max-h-48 space-y-2 overflow-y-auto">
        {comments.length === 0 && <li className={PLANNER_MUTED}>No updates yet.</li>}
        {comments.map((c) => (
          <li key={c.id} className={PLANNER_COMMENT_BOX}>
            <p className={PLANNER_COMMENT_TEXT}>{c.comment}</p>
            <p className={`mt-1 ${PLANNER_TASK_META}`}>
              {c.authorName ?? 'User'} · {new Date(c.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>

      {canComment && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Post a field update…"
            className={`min-h-[44px] flex-1 ${PLANNER_INPUT}`}
          />
          <Button
            className={`min-h-[44px] ${PLANNER_BTN_PRIMARY}`}
            onClick={() => void handlePost()}
            disabled={busy || !text.trim()}
          >
            Post update
          </Button>
        </div>
      )}
    </div>
  );
}
