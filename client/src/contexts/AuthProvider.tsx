import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiFetch, syncBackendSessionFromSupabase } from "@/lib/backendApi";
import { supabase } from "@/lib/supabase";
import { AuthContext, type AuthContextType, type AuthUser } from "./auth-context";

async function resolveSessionUser(): Promise<AuthUser | null> {
  try {
    const me = await apiFetch<{ user: AuthUser | null }>("/api/auth/me", { method: "GET" });
    if (me.user?.id) return me.user;
  } catch {
    // tenta sincronizar abaixo
  }

  const synced = await syncBackendSessionFromSupabase();
  if (synced) {
    try {
      const me = await apiFetch<{ user: AuthUser | null }>("/api/auth/me", { method: "GET" });
      if (me.user?.id) return me.user;
    } catch {
      // segue para fallback Supabase
    }
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const su = sessionData.session?.user;
  if (su?.id) return { id: su.id, email: su.email ?? null };
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const enforceBlockedUser = async (u: AuthUser | null) => {
      if (!u) return;
      try {
        const { getUserProfile } = await import("@/lib/userProfile");
        const profile = await getUserProfile(u);
        if (profile?.isBlocked) {
          if (!cancelled) {
            setUser(null);
          }
          toast.error("Sua conta está bloqueada. Entre em contato com o suporte.");
        }
      } catch {
        // Se não conseguir checar o perfil (RLS/rede), não bloquear login aqui.
      }
    };

    resolveSessionUser()
      .then((resolvedUser) => {
        if (cancelled) return;
        setUser(resolvedUser);
        setLoading(false);
        void enforceBlockedUser(resolvedUser);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn: AuthContextType["signIn"] = async (email, password) => {
    try {
      await apiFetch("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      try {
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
      } catch {
        // cookie do backend segue válido; Supabase será usado só para re-sync após restart
      }
      let resolvedUser = await resolveSessionUser();
      if (!resolvedUser) {
        await new Promise((r) => setTimeout(r, 150));
        resolvedUser = await resolveSessionUser();
      }
      if (!resolvedUser) {
        throw new Error("Sessão não iniciada. Recarregue a página e tente novamente.");
      }
      setUser(resolvedUser);
      toast.success("Login realizado com sucesso!");
      return resolvedUser;
    } catch (error) {
      toast.error((error as Error)?.message || "Erro ao fazer login");
      throw error;
    }
  };

  const signUp: AuthContextType["signUp"] = async (email, password) => {
    try {
      await apiFetch("/api/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      let resolvedUser = await resolveSessionUser();
      if (!resolvedUser) {
        await new Promise((r) => setTimeout(r, 150));
        resolvedUser = await resolveSessionUser();
      }
      if (!resolvedUser) {
        throw new Error("Conta criada, mas a sessão não iniciou. Faça login.");
      }
      setUser(resolvedUser);
      toast.success("Conta criada com sucesso!");
      return resolvedUser;
    } catch (error) {
      toast.error((error as Error)?.message || "Erro ao criar conta");
      throw error;
    }
  };

  const signOut: AuthContextType["signOut"] = async () => {
    try {
      await apiFetch("/api/auth/sign-out", { method: "POST" });
      setUser(null);
      toast.info("Logout realizado");
    } catch (error) {
      toast.error((error as Error)?.message || "Erro ao fazer logout");
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
