import React from 'react';
import type { FieldRecordAttachment } from '../../types/fieldPlanner';

export default function FieldRecordAttachmentsList({
  attachments,
}: {
  attachments: FieldRecordAttachment[];
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">
        Attachments
      </h4>
      <ul className="space-y-2">
        {attachments.map((a) => (
          <li key={a.id}>
            {a.fileType?.startsWith('image/') || a.attachmentType === 'photo' ? (
              <a href={a.fileUrl} target="_blank" rel="noreferrer">
                <img
                  src={a.fileUrl}
                  alt={a.fileName}
                  className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-700"
                />
              </a>
            ) : (
              <a
                href={a.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-cyan-700 hover:underline dark:text-cyan-400"
              >
                {a.fileName}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
