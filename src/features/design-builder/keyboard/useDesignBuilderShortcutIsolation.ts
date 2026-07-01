import { useEffect, useState } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
  );
}

export function useDesignBuilderShortcutIsolation(params: {
  enabled: boolean;
  rootElement: HTMLElement | null;
}) {
  const { enabled, rootElement } = params;
  const [altPressed, setAltPressed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setAltPressed(false);
      return undefined;
    }

    function eventBelongsToDesignBuilder(event: KeyboardEvent): boolean {
      const active = document.activeElement;
      if (rootElement && active && rootElement.contains(active)) {
        return true;
      }

      const target = event.target;
      return Boolean(rootElement && target instanceof Node && rootElement.contains(target));
    }

    function shouldCapture(event: KeyboardEvent): boolean {
      if (!eventBelongsToDesignBuilder(event)) return false;
      if (isEditableTarget(event.target)) return false;
      if (isEditableTarget(document.activeElement)) return false;

      if (event.key === 'Alt') return true;
      if (event.altKey) return true;

      return false;
    }

    function stopBrowserAltBehavior(event: KeyboardEvent) {
      if (!shouldCapture(event)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (event.key === 'Alt') {
        setAltPressed(event.type === 'keydown');
      }
    }

    function handleBlur() {
      setAltPressed(false);
    }

    window.addEventListener('keydown', stopBrowserAltBehavior, true);
    window.addEventListener('keyup', stopBrowserAltBehavior, true);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', stopBrowserAltBehavior, true);
      window.removeEventListener('keyup', stopBrowserAltBehavior, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, rootElement]);

  return { altPressed };
}
