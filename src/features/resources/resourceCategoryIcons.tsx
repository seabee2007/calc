import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  ArrowLeftRight,
  Calculator,
  CalendarRange,
  ClipboardCheck,
  FileStack,
  FileText,
  Layers,
  ShieldCheck,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  layers: Layers,
  calculator: Calculator,
  'file-text': FileText,
  'arrow-left-right': ArrowLeftRight,
  'calendar-range': CalendarRange,
  'file-stack': FileStack,
  'clipboard-check': ClipboardCheck,
  'shield-check': ShieldCheck,
  archive: Archive,
};

export function getResourceCategoryIcon(iconKey?: string): LucideIcon {
  if (!iconKey) return FileText;
  return ICON_MAP[iconKey] ?? FileText;
}
