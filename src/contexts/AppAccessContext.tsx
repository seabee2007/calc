import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { clearPersistedAppAccessState } from '../lib/appAccessPersistence';
import {
  registerAppAccessClear,
  unregisterAppAccessClear,
} from '../lib/appAccessReset';
import { logResolvedAppAccessDiagnostics } from '../lib/appRoutingDiagnostics';
import {
  resolveAppAccess,
  type AccessResolutionState,
  type ResolvedAppAccess,
} from '../services/appAccessService';

interface AppAccessContextValue {
  authSessionResolved: boolean;
  accessResolutionState: AccessResolutionState;
  access: ResolvedAppAccess | null;
  refreshAccess: () => Promise<void>;
  clearAccess: () => void;
}

const AppAccessContext = createContext<AppAccessContextValue | null>(null);

export function AppAccessProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const [accessResolutionState, setAccessResolutionState] =
    useState<AccessResolutionState>('idle');
  const [access, setAccess] = useState<ResolvedAppAccess | null>(null);

  const authSessionResolved = !authLoading;
  const profileReady = !user || !profileLoading;

  const clearAccess = useCallback(() => {
    setAccess(null);
    setAccessResolutionState('resolved');
  }, []);

  useEffect(() => {
    registerAppAccessClear(clearAccess);
    return () => unregisterAppAccessClear(clearAccess);
  }, [clearAccess]);

  const refreshAccess = useCallback(async () => {
    if (!authSessionResolved || !profileReady) return;

    if (!user) {
      setAccess(null);
      setAccessResolutionState('resolved');
      return;
    }

    setAccessResolutionState('loading');
    try {
      const resolved = await resolveAppAccess(user.id, profile);
      setAccess(resolved);
      setAccessResolutionState('resolved');
      logResolvedAppAccessDiagnostics(resolved);
    } catch {
      setAccess(null);
      setAccessResolutionState('error');
    }
  }, [authSessionResolved, profile, profileReady, user]);

  useEffect(() => {
    if (!authSessionResolved) {
      setAccessResolutionState('idle');
      return;
    }

    if (!user) {
      clearPersistedAppAccessState();
      setAccess(null);
      setAccessResolutionState('resolved');
      return;
    }

    if (!profileReady) {
      setAccessResolutionState('loading');
      return;
    }

    void refreshAccess();
  }, [authSessionResolved, profile?.id, profile?.role, profile?.employerId, profileReady, refreshAccess, user?.id]);

  useEffect(() => {
    if (!user) {
      clearAccess();
    }
  }, [clearAccess, user]);

  const value = useMemo<AppAccessContextValue>(
    () => ({
      authSessionResolved,
      accessResolutionState,
      access,
      refreshAccess,
      clearAccess,
    }),
    [access, accessResolutionState, authSessionResolved, clearAccess, refreshAccess],
  );

  return <AppAccessContext.Provider value={value}>{children}</AppAccessContext.Provider>;
}

export function useAppAccess(): AppAccessContextValue {
  const context = useContext(AppAccessContext);
  if (!context) {
    throw new Error('useAppAccess must be used within AppAccessProvider');
  }
  return context;
}

export function useAppAccessOptional(): AppAccessContextValue | null {
  return useContext(AppAccessContext);
}

export function resetAppAccessOnLogout(): void {
  clearPersistedAppAccessState();
}
