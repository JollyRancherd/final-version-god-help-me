import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

// ─── Auth State ───────────────────────────────────────────────────────────────

export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isLoading = session === undefined;
  const user = session?.user ?? null;

  return {
    data: user ? { id: user.id, username: user.email ?? user.id } : null,
    isLoading,
  };
}

// ─── Register ─────────────────────────────────────────────────────────────────

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      // username is used as email — if it doesn't look like an email, append a fake domain
      const email = username.includes("@") ? username : `${username}@budgetapp.local`;

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Sign up failed");

      // If email confirmation is on, session will be null — sign in immediately
      let session = data.session;
      if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error("Account created! Please log in.");
        session = signInData.session;
      }

      // Seed default data via Express API
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!res.ok && res.status !== 409) {
        console.warn("Seed endpoint failed:", res.status);
      }

      return {
        id: data.user.id,
        username: username,
        isNew: true,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

// ─── Login ────────────────────────────────────────────────────────────────────

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const email = username.includes("@") ? username : `${username}@budgetapp.local`;

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Login failed");

      return { id: data.user.id, username };
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
