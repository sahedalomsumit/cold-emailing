import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signup = async (email, password, fullName) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: "https://sahedalomsumit.github.io/outreach-os/",
      },
    });
  };

  const login = (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const logout = () => {
    return supabase.auth.signOut();
  };

  const updateProfile = async (updates) => {
    const { data, error } = await supabase.auth.updateUser({
      data: updates
    });
    if (data?.user) setUser(data.user);
    return { data, error };
  };

  const updateEmail = async (email) => {
    return await supabase.auth.updateUser(
      { email },
      {
        emailRedirectTo: "https://sahedalomsumit.github.io/outreach-os/",
      }
    );
  };

  const updatePassword = async (password) => {
    return supabase.auth.updateUser({ password });
  };

  const isAdmin = user?.email === 'sahedalomsumit@gmail.com';

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, isAdmin, updateProfile, updateEmail, updatePassword }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
