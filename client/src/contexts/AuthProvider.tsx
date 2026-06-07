import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  authPublicFetch,
  fetchBackendMe,
  persistSignInResponse,
  setStoredAccessToken,
  syncBackendSessionFromAccessToken,
  syncBackendSessionFromSupabase,
} from "@/lib/backendApi";
import { supabase } from "@/lib/supabase";
import { AuthContext, type AuthContextType, type AuthUser } from "./auth-context";

type SignInResponse = {
  ok?: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAtMs?: number;
  user?: AuthUser;
};

async function resolveSessionUser(): Promise<AuthUser | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const supabaseSession = sessionData.session;

  if (supabaseSession?.access_token) {
    setStoredAccessToken(
      supabaseSession.access_token,
      supabaseSession.expires_at ? supabaseSession.expires_at * 1000 : undefined,
    );
    await syncBackendSessionFromSupabase();
  }

  const me = await fetchBackendMe();
  if (me?.user?.id) return me.user;

  if (supabaseSession?.user?.id) {
    return { id: supabaseSession.user.id, email: supabaseSession.user.email ?? null };
  }
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

    // Não usar async/await aqui: Supabase trava signInWithPassword se o callback bloquear.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.access_token) {
        setStoredAccessToken(
          session.access_token,
          session.expires_at ? session.expires_at * 1000 : undefined,
        );
        void syncBackendSessionFromSupabase();
        if (session.user?.id) {
          setUser({ id: session.user.id, email: session.user.email ?? null });
        }
      } else if (_event === "SIGNED_OUT") {
        setStoredAccessToken(null);
        setUser(null);
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthContextType["signIn"] = async (email, password) => {
    try {
      const trimmedEmail = email.trim();
      setStoredAccessToken(null);

      const signInBody = await authPublicFetch<SignInResponse>("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      persistSignInResponse(signInBody);

      if (signInBody.accessToken) {
        await syncBackendSessionFromAccessToken({
          accessToken: signInBody.accessToken,
          refreshToken: signInBody.refreshToken,
          expiresAtMs: signInBody.expiresAtMs,
        });
      }

      // Sessão Supabase em background — o backend já autenticou; evita deadlock no onAuthStateChange.
      void supabase.auth
        .signInWithPassword({ email: trimmedEmail, password })
        .then(({ error }) => {
          if (error) {
            console.warn("Sessão Supabase no browser:", error.message);
          }
        })
        .catch(() => {});

      let resolvedUser: AuthUser | null = signInBody.user?.id ? signInBody.user : null;
      if (!resolvedUser) {
        const me = await fetchBackendMe();
        resolvedUser = me?.user?.id ? me.user : null;
      }
      if (!resolvedUser) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user?.id) {
          resolvedUser = {
            id: data.session.user.id,
            email: data.session.user.email ?? null,
          };
        }
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
      setStoredAccessToken(null);
      const signUpBody = await authPublicFetch<SignInResponse>("/api/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      persistSignInResponse(signUpBody);
      if (signUpBody.accessToken) {
        await syncBackendSessionFromAccessToken({
          accessToken: signUpBody.accessToken,
          refreshToken: signUpBody.refreshToken,
          expiresAtMs: signUpBody.expiresAtMs,
        });
      }

      let resolvedUser = signUpBody.user?.id ? signUpBody.user : null;
      if (!resolvedUser) {
        const me = await fetchBackendMe();
        resolvedUser = me?.user?.id ? me.user : null;
      }
      if (!resolvedUser) {
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
      await authPublicFetch("/api/auth/sign-out", { method: "POST" });
    } catch {
      // limpa sessão local mesmo se o cookie já expirou
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setStoredAccessToken(null);
    setUser(null);
    toast.info("Logout realizado");
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
