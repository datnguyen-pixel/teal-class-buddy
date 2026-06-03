import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: 'teacher' | 'student';
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  blockedMessage: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isTeacher: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const fetchUserProfile = async (supabaseUser: SupabaseUser): Promise<UserProfile | null> => {
    try {
      // Check if user is blocked
      const { data: blocked } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

      if (blocked) {
        // Defer signOut to avoid recursive auth-event deadlock inside listener
        setTimeout(() => { supabase.auth.signOut(); }, 0);
        setBlockedMessage('You have been removed from this application. Please contact the administrator for support.');
        return null;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id);

      const role = roles?.some(r => r.role === 'teacher') ? 'teacher' : 'student';

      return {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        fullName: profile?.full_name || supabaseUser.email || '',
        avatarUrl: profile?.avatar_url || null,
        role,
      };
    } catch (err) {
      console.error('fetchUserProfile failed:', err);
      // Fallback minimal profile so the app does not hang on a query error
      return {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        fullName: supabaseUser.email || '',
        avatarUrl: null,
        role: 'student',
      };
    }
  };

  useEffect(() => {
    let mounted = true;

    const purgeStaleAuthStorage = () => {
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));
      } catch (e) {
        console.warn('Failed to purge stale auth storage', e);
      }
    };

    // onAuthStateChange fires INITIAL_SESSION on subscribe, so it also handles the initial load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Detect a failed refresh: token refresh event with no session => stale/corrupt token
      if (event === 'TOKEN_REFRESHED' && !session) {
        purgeStaleAuthStorage();
        if (!mounted) return;
        setUser(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        // Defer async work to avoid deadlocks inside the auth listener
        setTimeout(async () => {
          const profile = await fetchUserProfile(session.user);
          if (!mounted) return;
          setUser(profile);
          setLoading(false);
        }, 0);
      } else {
        if (!mounted) return;
        setUser(null);
        setLoading(false);
      }
    });

    // On first load, if getSession fails with a retryable fetch error (stale token),
    // proactively purge so the Supabase client stops retrying every 20s.
    supabase.auth.getSession().catch((err: any) => {
      if (err?.name === 'AuthRetryableFetchError' || /Failed to fetch/i.test(err?.message || '')) {
        purgeStaleAuthStorage();
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    // Safety net: if no auth event resolves within 8s, stop showing the loading screen
    const safety = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    return () => {
      mounted = false;
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      blockedMessage,
      signInWithGoogle,
      signInWithEmail,
      signOut,
      isTeacher: user?.role === 'teacher',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
