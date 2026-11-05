import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile, type UserProfile } from "@/lib/userProfile";

type UserProfileContextValue = {
  profile: UserProfile | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

/**
 * Provider único do perfil — Header, menu e páginas compartilham o mesmo estado.
 * Após editar o perfil, chame `refetch()` ou `notifyProfileUpdated()`.
 */
export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const userProfile = await getUserProfile(user);
      setProfile(userProfile);
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const onInvalidate = () => {
      if (user) void fetchProfile();
    };
    window.addEventListener("origemlab:profile-updated", onInvalidate);
    return () => window.removeEventListener("origemlab:profile-updated", onInvalidate);
  }, [user, fetchProfile]);

  const refetch = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const value = useMemo(
    () => ({ profile, loading, refetch }),
    [profile, loading, refetch],
  );

  return (
    <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>
  );
}

/**
 * Hook para acessar o perfil do usuário atual (tabela profiles).
 * refetch: força nova leitura do banco (ex.: após editar perfil).
 */
export function useUserProfile(): UserProfileContextValue {
  const ctx = useContext(UserProfileContext);
  if (!ctx) {
    return {
      profile: null,
      loading: false,
      refetch: async () => {},
    };
  }
  return ctx;
}

/** Dispara atualização global do perfil (Header / menu Empresas etc.). */
export function notifyProfileUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("origemlab:profile-updated"));
  }
}
