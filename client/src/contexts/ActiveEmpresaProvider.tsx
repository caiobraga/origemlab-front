import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getActiveEmpresaId, setActiveEmpresaId } from "@/lib/activeEmpresa";
import { fetchEmpresas, type Empresa } from "@/lib/empresasApi";

type ActiveEmpresaContextValue = {
  empresas: Empresa[];
  activeEmpresaId: string | null;
  activeEmpresa: Empresa | null;
  loading: boolean;
  setActiveEmpresa: (id: string | null) => void;
  refreshEmpresas: () => Promise<Empresa[]>;
  isConsultor: boolean;
};

const ActiveEmpresaContext = createContext<ActiveEmpresaContextValue | null>(null);

export function ActiveEmpresaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const [knownConsultor, setKnownConsultor] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [activeEmpresaId, setActiveId] = useState<string | null>(() => getActiveEmpresaId());
  const [loading, setLoading] = useState(false);
  const empresasRef = useRef(empresas);
  empresasRef.current = empresas;

  useEffect(() => {
    if (profile?.userType === "consultor") setKnownConsultor(true);
    else if (profile && profile.userType !== "consultor") setKnownConsultor(false);
  }, [profile]);

  // Mantém true entre navigations mesmo se o Header remonta com profile local ainda null.
  const isConsultor =
    profile?.userType === "consultor" || (knownConsultor && (profileLoading || !profile));

  const refreshEmpresas = useCallback(async () => {
    const consultor = profile?.userType === "consultor" || knownConsultor;
    if (!user || !consultor) {
      if (!user || (profile && profile.userType !== "consultor")) {
        setEmpresas([]);
        return [];
      }
      return empresasRef.current;
    }
    setLoading(true);
    try {
      const rows = await fetchEmpresas();
      setEmpresas(rows);
      const current = getActiveEmpresaId();
      if (current && rows.some((e) => e.id === current)) {
        setActiveId(current);
      } else if (rows.length === 1) {
        setActiveEmpresaId(rows[0].id);
        setActiveId(rows[0].id);
      } else if (current && !rows.some((e) => e.id === current)) {
        setActiveEmpresaId(null);
        setActiveId(null);
      } else {
        setActiveId(current);
      }
      return rows;
    } catch {
      return empresasRef.current;
    } finally {
      setLoading(false);
    }
  }, [user, profile, knownConsultor]);

  useEffect(() => {
    void refreshEmpresas();
  }, [refreshEmpresas]);

  useEffect(() => {
    const onChange = (ev: Event) => {
      const id = (ev as CustomEvent<string | null>).detail ?? getActiveEmpresaId();
      setActiveId(id);
    };
    window.addEventListener("origemlab:active-empresa", onChange as EventListener);
    return () => window.removeEventListener("origemlab:active-empresa", onChange as EventListener);
  }, []);

  const setActiveEmpresa = useCallback((id: string | null) => {
    setActiveEmpresaId(id);
    setActiveId(id);
  }, []);

  const activeEmpresa = useMemo(
    () => empresas.find((e) => e.id === activeEmpresaId) || null,
    [empresas, activeEmpresaId],
  );

  const value = useMemo(
    () => ({
      empresas,
      activeEmpresaId: isConsultor ? activeEmpresaId : null,
      activeEmpresa: isConsultor ? activeEmpresa : null,
      loading,
      setActiveEmpresa,
      refreshEmpresas,
      isConsultor: !!isConsultor,
    }),
    [
      empresas,
      activeEmpresaId,
      activeEmpresa,
      loading,
      setActiveEmpresa,
      refreshEmpresas,
      isConsultor,
    ],
  );

  return <ActiveEmpresaContext.Provider value={value}>{children}</ActiveEmpresaContext.Provider>;
}

export function useActiveEmpresa(): ActiveEmpresaContextValue {
  const ctx = useContext(ActiveEmpresaContext);
  if (!ctx) {
    return {
      empresas: [],
      activeEmpresaId: getActiveEmpresaId(),
      activeEmpresa: null,
      loading: false,
      setActiveEmpresa: setActiveEmpresaId,
      refreshEmpresas: async () => [],
      isConsultor: false,
    };
  }
  return ctx;
}
