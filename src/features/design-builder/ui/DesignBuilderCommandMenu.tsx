import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

type CommandMenuRegistry = {
  registerClose: (id: string, close: () => void) => void;
  unregisterClose: (id: string) => void;
  closeAll: () => boolean;
  notifyOpen: (id: string) => void;
  notifyClosed: (id: string) => void;
};

const CommandMenuRegistryContext = createContext<CommandMenuRegistry | null>(null);
const CommandMenuCloseContext = createContext<(() => void) | null>(null);
const CommandMenuCloseOnSelectContext = createContext(true);

let closeAllCommandMenus: (() => boolean) | null = null;

export function closeDesignBuilderCommandMenus(): boolean {
  return closeAllCommandMenus?.() ?? false;
}

export function DesignBuilderCommandMenuProvider({ children }: { children: ReactNode }) {
  const closersRef = useRef(new Map<string, () => void>());
  const openMenusRef = useRef(new Set<string>());

  const registerClose = useCallback((id: string, close: () => void) => {
    closersRef.current.set(id, close);
  }, []);

  const unregisterClose = useCallback((id: string) => {
    closersRef.current.delete(id);
    openMenusRef.current.delete(id);
  }, []);

  const closeAll = useCallback(() => {
    if (openMenusRef.current.size === 0) return false;
    openMenusRef.current.forEach((menuId) => {
      closersRef.current.get(menuId)?.();
    });
    openMenusRef.current.clear();
    return true;
  }, []);

  const notifyOpen = useCallback((id: string) => {
    openMenusRef.current.forEach((openId) => {
      if (openId !== id) closersRef.current.get(openId)?.();
    });
    openMenusRef.current.clear();
    openMenusRef.current.add(id);
  }, []);

  const notifyClosed = useCallback((id: string) => {
    openMenusRef.current.delete(id);
  }, []);

  useEffect(() => {
    closeAllCommandMenus = closeAll;
    return () => {
      closeAllCommandMenus = null;
    };
  }, [closeAll]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('[data-design-builder-command-menu]')) {
        closeAll();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!closeAll()) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [closeAll]);

  return (
    <CommandMenuRegistryContext.Provider
      value={{ registerClose, unregisterClose, closeAll, notifyOpen, notifyClosed }}
    >
      {children}
    </CommandMenuRegistryContext.Provider>
  );
}

export function useDesignBuilderCommandMenus() {
  const context = useContext(CommandMenuRegistryContext);
  if (!context) {
    throw new Error('useDesignBuilderCommandMenus must be used within DesignBuilderCommandMenuProvider');
  }
  return context;
}

type DesignBuilderCommandMenuProps = {
  label: ReactNode;
  menuKind?: string;
  summaryClassName?: string;
  panelClassName?: string;
  isActive?: boolean;
  closeOnSelect?: boolean;
  onSummaryClick?: () => void;
  summaryAriaLabel?: string;
  summaryDisplayLabel?: ReactNode;
  children: ReactNode;
};

export function DesignBuilderCommandMenu({
  label,
  menuKind,
  summaryClassName = '',
  panelClassName = 'w-48',
  isActive = false,
  closeOnSelect = true,
  onSummaryClick,
  summaryAriaLabel,
  summaryDisplayLabel,
  children,
}: DesignBuilderCommandMenuProps) {
  const menuId = useId();
  const registry = useContext(CommandMenuRegistryContext);
  const [open, setOpen] = useState(false);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    registry?.registerClose(menuId, closeMenu);
    return () => registry?.unregisterClose(menuId);
  }, [closeMenu, menuId, registry]);

  useEffect(() => {
    if (!registry) return;
    if (open) registry.notifyOpen(menuId);
    else registry.notifyClosed(menuId);
  }, [menuId, open, registry]);

  return (
    <div
      className="relative"
      data-design-builder-command-menu
      data-menu-kind={menuKind}
      data-open={open ? 'true' : 'false'}
      data-close-on-select={closeOnSelect ? 'true' : 'false'}
    >
      <button
        type="button"
        aria-label={summaryAriaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          onSummaryClick?.();
          setOpen((current) => !current);
        }}
        className={summaryClassName}
      >
        {summaryDisplayLabel ?? label}
      </button>
      {open ? (
        <div
          role="menu"
          data-design-builder-command-menu-panel
          className={`absolute left-0 z-30 mt-2 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${panelClassName}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <CommandMenuCloseContext.Provider value={closeMenu}>
            <CommandMenuCloseOnSelectContext.Provider value={closeOnSelect}>
              {children}
            </CommandMenuCloseOnSelectContext.Provider>
          </CommandMenuCloseContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

type CommandMenuActionProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
};

export function CommandMenuAction({
  children,
  className = '',
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
}: CommandMenuActionProps) {
  const closeMenu = useContext(CommandMenuCloseContext);
  const closeOnSelect = useContext(CommandMenuCloseOnSelectContext);

  return (
    <button
      type="button"
      role="menuitem"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (closeOnSelect) closeMenu?.();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
