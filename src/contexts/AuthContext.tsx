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

  const fetchUserProfile = async (supabaseUser: SupabaseUser): Promise<UserProfile | null> => {
    // Check if user is blocked
    const { data: blocked } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('user_id', supabaseUser.id)
      .maybeSingle();

    if (blocked) {
      await supabase.auth.signOut();
      return null;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', supabaseUser.id)
      .single();

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
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Use setTimeout to avoid potential deadlocks with Supabase auth
        setTimeout(async () => {
          const profile = await fetchUserProfile(session.user);
          setUser(profile);
          setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setUser(profile);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
