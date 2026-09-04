"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { identifyUser, resetUser } from "@/lib/analytics";
import type { AuthUser } from "@/types";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: false,
  signOut: async () => {},
});

function toAuthUser(u: User | null | undefined): AuthUser | null {
  if (!u) return null;
  return { id: u.id, email: u.email ?? null, createdAt: u.created_at ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setUser(toAuthUser(data.session?.user));
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAuthUser(session?.user));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── PostHog identity ────────────────────────────────────────────────────────
  // Mirror auth state into PostHog. The ref tracks the previous id so identify()
  // fires once per user rather than on every render, and reset() fires only on a
  // real sign-out — never on the initial anonymous load, which would churn the
  // anonymous id and break PostHog's anonymous → identified stitching at signup.
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    const id = user?.id ?? null;
    if (id === prevUserId.current) return;
    if (id)                      identifyUser(id);   // Supabase user id only
    else if (prevUserId.current) resetUser();        // genuine sign-out
    prevUserId.current = id;
  }, [user?.id]);

  const signOut = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
