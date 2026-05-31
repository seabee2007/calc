import React from 'react';
import { FIELD_TOOL_EYEBROW, FIELD_TOOL_SECTION, FIELD_TOOL_SECTION_TITLE } from './fieldToolTheme';

interface ToolSectionCardProps {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function ToolSectionCard({
  eyebrow,
  title,
  children,
  className = '',
}: ToolSectionCardProps) {
  return (
    <section className={`${FIELD_TOOL_SECTION} ${className}`}>
      {eyebrow && <p className={`${FIELD_TOOL_EYEBROW} mb-1`}>{eyebrow}</p>}
      <h2 className={`${FIELD_TOOL_SECTION_TITLE} mb-4`}>{title}</h2>
      {children}
    </section>
  );
}
