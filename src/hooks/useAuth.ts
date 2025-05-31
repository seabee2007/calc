import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      // First check if there's an active session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // If no session exists, just clear the local state
        setUser(null);
        return;
      }

      // Sign out from Supabase first
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Only clear local state after successful sign out
      setUser(null);
    } catch (error) {
      // If sign out fails, check session again and restore state if needed
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      throw error;
    }
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };
}