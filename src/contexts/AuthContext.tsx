import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import {
  clearStaleAuthSession,
  isStaleRefreshTokenError,
} from '../lib/authSession';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types/fieldPlanner';
import { ensureOwnerProfile, fetchProfile } from '../services/profileService';
import { isEmployeeRole, isOwnerRole } from '../types/fieldPlanner';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  isOwner: boolean;
  isEmployee: boolean;
  /** True only until the first session check completes. */
  loading: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (sessionUser: User | null) => {
    if (!sessionUser) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      let p = await fetchProfile(sessionUser.id);
      if (!p) {
        p = await ensureOwnerProfile(sessionUser.id, sessionUser.email);
      }
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(user);
  }, [loadProfile, user]);

  const handleStaleSession = useCallback(async () => {
    await clearStaleAuthSession();
    setUser(null);
    setProfile(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    const applySession = (sessionUser: User | null) => {
      if (!active) return;
      setUser(sessionUser);
      setLoading(false);
      void loadProfile(sessionUser);
    };

    supabase.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (!active) return;

        if (error && isStaleRefreshTokenError(error)) {
          await handleStaleSession();
          return;
        }

        applySession(session?.user ?? null);
      })
      .catch(async (error) => {
        if (!active) return;
        if (isStaleRefreshTokenError(error)) {
          await handleStaleSession();
          return;
        }
        if (import.meta.env.DEV) {
          console.error('[auth] Session initialization failed:', error);
        }
        applySession(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      applySession(session.user);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, handleStaleSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && !isStaleRefreshTokenError(error)) {
        throw error;
      }
    } catch (error) {
      if (!isStaleRefreshTokenError(error) && import.meta.env.DEV) {
        console.error('[auth] Sign out error:', error);
      }
    } finally {
      await clearStaleAuthSession();
      setUser(null);
      setProfile(null);
    }
  }, []);

  const isOwner = isOwnerRole(profile?.role);
  const isEmployee = isEmployeeRole(profile?.role);

  const value = useMemo(
    () => ({
      user,
      profile,
      isOwner,
      isEmployee,
      loading,
      profileLoading,
      refreshProfile,
      signIn,
      signUp,
      signOut,
    }),
    [
      user,
      profile,
      isOwner,
      isEmployee,
      loading,
      profileLoading,
      refreshProfile,
      signIn,
      signUp,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
