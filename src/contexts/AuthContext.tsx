import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, userData: { username: string; birthday: string; bio?: string }) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Check admin status when user changes
        if (session?.user) {
          checkAdminStatus(session.user.id);
        } else {
          setIsAdmin(false);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data: roles } = await supabase
        .rpc('get_user_roles', { _user_id: userId });
      
      const hasAdminRole = roles?.some((role: any) => role.role === 'admin');
      setIsAdmin(hasAdminRole || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const signUp = async (email: string, password: string, userData: { username: string; birthday: string; bio?: string }) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: userData.username,
          birthday: userData.birthday,
          bio: userData.bio || null
        }
      }
    });

    if (authError) {
      return { error: authError };
    }

    // If signup succeeded but user exists (email already registered)
    if (authData?.user && !authError) {
      // Try to manually create profile if it doesn't exist
      // This handles cases where the trigger might have failed
      try {
        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authData.user.id)
          .single();

        if (!existingProfile) {
          // Create profile manually
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: authData.user.id,
              username: userData.username,
              bio: userData.bio || null,
              avatar_url: null
            });

          if (profileError && !profileError.message.includes('duplicate')) {
            console.error('Profile creation error:', profileError);
          }

          // Create sensitive data entry
          const { error: sensitiveError } = await supabase
            .from('sensitive_user_data')
            .insert({
              user_id: authData.user.id,
              birthday: userData.birthday
            });

          if (sensitiveError && !sensitiveError.message.includes('duplicate')) {
            console.error('Sensitive data creation error:', sensitiveError);
          }
        }
      } catch (err) {
        console.error('Error ensuring profile exists:', err);
      }
    }

    return { error: authError };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signOut = async () => {
    setIsAdmin(false);
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    isAdmin,
    signUp,
    signIn,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}