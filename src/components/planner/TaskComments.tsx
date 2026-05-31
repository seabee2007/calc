import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import type { TaskComment } from '../../types/fieldPlanner';
import { addTaskComment } from '../../services/taskActivityService';
import Button from '../ui/Button';
import UserAvatar from './UserAvatar';
import {
  PLANNER_COMMENT_BOX,
  PLANNER_COMMENT_TEXT,
  PLANNER_ICON_ACCENT,
  PLANNER_INPUT,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  PLANNER_TASK_META,
} from './plannerTheme';

const QUICK_CHIPS = [
  'On site',
  'Pour complete',
  'Weather delay',
  'Need materials',
  'Ready for inspection',
] as const;

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
  userId: string;
  comments: TaskComment[];
  canComment: boolean;
  isOwner?: boolean;
  onChange: () => void;
  onCreateRfi?: () => void;
  onCreateAdjustment?: () => void;
}

export default function TaskComments({
  taskId,
  projectId,
  userId,
  comments,
  canComment,
  isOwner = false,
  onChange,
  onCreateRfi,
  onCreateAdjustment,
}: TaskCommentsProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const handlePost = async (body?: string) => {
    const message = (body ?? text).trim();
    if (!message || !canComment) return;
    setBusy(true);
    try {
      await addTaskComment(taskId, projectId, userId, message);
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
        Comments
      </h4>

      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {comments.length === 0 && <li className={PLANNER_MUTED}>No comments yet.</li>}
        {comments.map((c) => (
          <li key={c.id} className={PLANNER_COMMENT_BOX}>
            <div className="flex gap-2">
              <UserAvatar name={c.authorName ?? 'User'} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">
                  {c.authorName ?? 'User'}
                </p>
                <p className={PLANNER_COMMENT_TEXT}>{c.comment}</p>
                <p className={`mt-1 ${PLANNER_TASK_META}`}>
                  {new Date(c.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {canComment && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void handlePost(chip)}
                disabled={busy}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:border-cyan-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment…"
              className={`min-h-[44px] flex-1 ${PLANNER_INPUT}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handlePost();
              }}
            />
            <Button
              variant="accent"
              className="min-h-[44px]"
              onClick={() => void handlePost()}
              disabled={busy || !text.trim()}
            >
              Post
            </Button>
          </div>
        </div>
      )}

      {(onCreateRfi || onCreateAdjustment) && (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          {onCreateRfi && (
            <Button size="sm" variant="outline" onClick={onCreateRfi}>
              Create RFI
            </Button>
          )}
          {onCreateAdjustment && (
            <Button size="sm" variant="outline" onClick={onCreateAdjustment}>
              Create FAR
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
