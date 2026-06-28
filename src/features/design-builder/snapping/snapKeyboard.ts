import type { ObjectSnapSettings, SnapTolerancePreset } from './snapTypes';

export type SnapKeyboardAction =
  | { kind: 'toggle-object-snap' }
  | { kind: 'toggle-grid-snap' }
  | { kind: 'toggle-ortho' }
  | { kind: 'toggle-polar' }
  | { kind: 'cycle-candidate' }
  | { kind: 'toggle-object-type'; key: keyof Omit<ObjectSnapSettings, 'enabled' | 'extension'> }
  | { kind: 'horizontal-lock' }
  | { kind: 'vertical-lock' }
  | { kind: 'cancel-command' }
  | { kind: 'finish-command' }
  | { kind: 'undo-command-point' };

export function shouldIgnoreSnapShortcut(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (typeof element.closest !== 'function') return false;
  const tagName = element.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'SELECT' ||
    tagName === 'TEXTAREA' ||
    element.isContentEditable ||
    Boolean(element.closest('[contenteditable="true"]'))
  );
}

export function snapKeyboardActionForEvent(event: KeyboardEvent): SnapKeyboardAction | null {
  if (shouldIgnoreSnapShortcut(event.target)) return null;
  switch (event.key) {
    case 'F3':
      return { kind: 'toggle-object-snap' };
    case 'F7':
      return { kind: 'toggle-grid-snap' };
    case 'F8':
      return { kind: 'toggle-ortho' };
    case 'F10':
      return { kind: 'toggle-polar' };
    case 'Tab':
      return { kind: 'cycle-candidate' };
    case 'Escape':
      return { kind: 'cancel-command' };
    case 'Enter':
      return { kind: 'finish-command' };
    case 'Backspace':
      return { kind: 'undo-command-point' };
    default:
      break;
  }

  const key = event.key.toLowerCase();
  if (key === 'e') return { kind: 'toggle-object-type', key: 'endpoint' };
  if (key === 'm') return { kind: 'toggle-object-type', key: 'midpoint' };
  if (key === 'i') return { kind: 'toggle-object-type', key: 'intersection' };
  if (key === 'n') return { kind: 'toggle-object-type', key: 'nearest' };
  if (key === 'p') return { kind: 'toggle-object-type', key: 'perpendicular' };
  if (key === 'x') return { kind: 'horizontal-lock' };
  if (key === 'y') return { kind: 'vertical-lock' };
  return null;
}

export function tolerancePxForPreset(preset: SnapTolerancePreset): number {
  if (preset === 'low') return 8;
  if (preset === 'high') return 16;
  return 12;
}
