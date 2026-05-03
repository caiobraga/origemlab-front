import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { getUserProfile } from "@/lib/userProfile";
import { apiFetch } from "@/lib/backendApi";

interface AuthContextType {
  user: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const enforceBlockedUser = async (u: { id: string } | null) => {
      if (!u) return;
      try {
        const profile = await getUserProfile(u as any);
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

    apiFetch<{ user: { id: string; email?: string | null } | null }>("/api/auth/me", { method: "GET" })
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setLoading(false);
        void enforceBlockedUser(data.user as any);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await apiFetch("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const me = await apiFetch<{ user: { id: string; email?: string | null } | null }>("/api/auth/me", { method: "GET" });
      setUser(me.user);
      toast.success("Login realizado com sucesso!");
    } catch (error) {
      toast.error((error as Error)?.message || "Erro ao fazer login");
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      await apiFetch("/api/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const me = await apiFetch<{ user: { id: string; email?: string | null } | null }>("/api/auth/me", { method: "GET" });
      setUser(me.user);
      toast.success("Conta criada com sucesso!");
    } catch (error) {
      toast.error((error as Error)?.message || "Erro ao criar conta");
      throw error;
    }
  };

  const signOut = async () => {
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

