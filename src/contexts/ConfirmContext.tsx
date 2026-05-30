import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import ConfirmModal, { type ConfirmVariant } from '../components/ui/ConfirmModal';

export interface ConfirmOptions {
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: ConfirmVariant;
  showWarningIcon?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const defaultOptions: ConfirmOptions = {
  title: 'Confirm',
  message: 'Are you sure?',
  cancelLabel: 'Cancel',
  confirmLabel: 'Confirm',
  confirmVariant: 'danger',
  showWarningIcon: false,
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>(defaultOptions);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((result: boolean) => {
    setIsOpen(false);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(result);
  }, []);

  const confirm = useCallback<ConfirmFn>((opts) => {
    if (resolveRef.current) {
      resolveRef.current(false);
    }
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions({ ...defaultOptions, ...opts });
      setIsOpen(true);
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmModal
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        cancelLabel={options.cancelLabel}
        confirmLabel={options.confirmLabel}
        confirmVariant={options.confirmVariant}
        showWarningIcon={options.showWarningIcon}
        onCancel={() => close(false)}
        onConfirm={() => close(true)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx;
}
