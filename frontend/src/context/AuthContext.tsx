import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { api, setAuthToken } from '../services/api';
import type { User } from '../types';

interface AuthActionResult {
  error: string | null;
  requiresEmailVerification?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthActionResult>;
  reauthenticate: (password: string) => Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapSupabaseUser(sbUser: SupabaseUser | null): User | null {
  if (!sbUser) return null;
  const meta = sbUser.user_metadata as Record<string, unknown> | undefined;
  const displayName =
    typeof meta?.display_name === 'string'
      ? meta.display_name
      : typeof meta?.full_name === 'string'
      ? meta.full_name
      : undefined;

  return {
    id: sbUser.id,
    email: sbUser.email || '',
    display_name: displayName,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        const currentSession = data.session ?? null;
        setSession(currentSession);
        setUser(mapSupabaseUser(currentSession?.user ?? null));
        setAuthToken(currentSession?.access_token ?? null);
        if (currentSession?.access_token) {
          void api.wakeUp();
        }
      } catch {
        if (!isMounted) return;
        setSession(null);
        setUser(null);
        setAuthToken(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) return;
        setSession(nextSession);
        setUser(mapSupabaseUser(nextSession?.user ?? null));
        setAuthToken(nextSession?.access_token ?? null);
        if (nextSession?.access_token) {
          void api.wakeUp();
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        setUser(mapSupabaseUser(data.session.user));
        setAuthToken(data.session.access_token);
      }

      return { error: null };
    },
    []
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      displayName: string
    ): Promise<AuthActionResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        setUser(mapSupabaseUser(data.session.user));
        setAuthToken(data.session.access_token);
        return { error: null, requiresEmailVerification: false };
      }

      return { error: null, requiresEmailVerification: true };
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setUser(null);
      setAuthToken(null);
    }
  }, []);

  const resetPassword = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    },
    []
  );

  const reauthenticate = useCallback(
    async (password: string): Promise<AuthActionResult> => {
      if (!user?.email) {
        return { error: 'No authenticated user email found.' };
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (error) {
        return { error: 'Incorrect password. Please verify your password and try again.' };
      }
      return { error: null };
    },
    [user?.email]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        reauthenticate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
