import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  computeDebugOverlayLayout,
  DEBUG_OVERLAY_INSET,
  type DebugOverlayPosition,
} from './debugOverlayLayout';

type OverlayRegistration = {
  id: string;
  ref: RefObject<HTMLElement | null>;
};

type DebugOverlayLayoutContextValue = {
  registerOverlay: (registration: OverlayRegistration) => () => void;
  getLayoutPosition: (id: string) => DebugOverlayPosition | undefined;
};

const DebugOverlayLayoutContext = createContext<DebugOverlayLayoutContextValue | null>(null);

export function DebugOverlayLayoutProvider(props: {
  containerRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const registrationsRef = useRef<Map<string, OverlayRegistration>>(new Map());
  const [layoutPositions, setLayoutPositions] = useState<Record<string, DebugOverlayPosition>>({});
  const [registrationVersion, setRegistrationVersion] = useState(0);

  const registerOverlay = useCallback((registration: OverlayRegistration) => {
    registrationsRef.current.set(registration.id, registration);
    setRegistrationVersion((version) => version + 1);
    return () => {
      registrationsRef.current.delete(registration.id);
      setRegistrationVersion((version) => version + 1);
    };
  }, []);

  const remeasure = useCallback(() => {
    const container = props.containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const panels = Array.from(registrationsRef.current.values())
      .map((registration) => {
        const element = registration.ref.current;
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        return {
          id: registration.id,
          width: rect.width,
          height: rect.height,
        };
      })
      .filter((panel): panel is NonNullable<typeof panel> => panel != null);

    setLayoutPositions(
      computeDebugOverlayLayout({
        panels,
        containerWidth: containerRect.width,
        containerHeight: containerRect.height,
      }),
    );
  }, [props.containerRef]);

  useLayoutEffect(() => {
    remeasure();

    const container = props.containerRef.current;
    if (!container) return;

    const observers: ResizeObserver[] = [];
    const containerObserver = new ResizeObserver(remeasure);
    containerObserver.observe(container);
    observers.push(containerObserver);

    const panelObserver = new ResizeObserver(remeasure);
    for (const registration of registrationsRef.current.values()) {
      if (registration.ref.current) {
        panelObserver.observe(registration.ref.current);
      }
    }
    observers.push(panelObserver);

    const frame = requestAnimationFrame(remeasure);
    return () => {
      cancelAnimationFrame(frame);
      for (const observer of observers) {
        observer.disconnect();
      }
    };
  }, [props.containerRef, registrationVersion, remeasure]);

  const value = useMemo<DebugOverlayLayoutContextValue>(
    () => ({
      registerOverlay,
      getLayoutPosition: (id) => layoutPositions[id],
    }),
    [layoutPositions, registerOverlay],
  );

  return (
    <DebugOverlayLayoutContext.Provider value={value}>{props.children}</DebugOverlayLayoutContext.Provider>
  );
}

export function useDebugOverlayLayout(): DebugOverlayLayoutContextValue | null {
  return useContext(DebugOverlayLayoutContext);
}

export function debugOverlayInitialStyle(): { left: number; top: number; opacity: number } {
  return { left: DEBUG_OVERLAY_INSET, top: DEBUG_OVERLAY_INSET, opacity: 0 };
}
