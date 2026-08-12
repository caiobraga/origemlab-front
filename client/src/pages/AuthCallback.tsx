import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  setStoredAccessToken,
  syncBackendSessionFromSupabase,
} from "@/lib/backendApi";
import Header from "@/components/Header";

/**
 * Landing page dos links de email do Supabase (confirmação, recovery, etc.).
 * Troca ?code= (PKCE) ou token_hash / hash legado por sessão antes de limpar a URL.
 */
export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("Confirmando seu email…");

  useEffect(() => {
    let cancelled = false;

    const finishOk = async (nextPath: string) => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        setStoredAccessToken(
          data.session.access_token,
          data.session.expires_at ? data.session.expires_at * 1000 : undefined,
        );
        try {
          await syncBackendSessionFromSupabase();
        } catch {
          // Login ainda funciona via Supabase mesmo se o cookie do backend falhar.
        }
      }
      if (!cancelled) setLocation(nextPath);
    };

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const errorDescription =
          url.searchParams.get("error_description") ||
          url.searchParams.get("error");

        if (errorDescription) {
          setMessage("Link inválido ou expirado.");
          setTimeout(() => {
            if (!cancelled) {
              setLocation(
                `/login?precisaConfirmar=1&erro=${encodeURIComponent(errorDescription)}`,
              );
            }
          }, 1200);
          return;
        }

        if (code) {
          // detectSessionInUrl pode já ter trocado o code na inicialização do client.
          const existing = await supabase.auth.getSession();
          if (existing.data.session) {
            await finishOk("/login?emailConfirmado=1");
            return;
          }
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            const again = await supabase.auth.getSession();
            if (again.data.session) {
              await finishOk("/login?emailConfirmado=1");
              return;
            }
            throw error;
          }
          await finishOk("/login?emailConfirmado=1");
          return;
        }

        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change",
          });
          if (error) throw error;
          await finishOk(
            type === "recovery" ? "/login?emailConfirmado=1" : "/login?emailConfirmado=1",
          );
          return;
        }

        // Hash implícito legado (#access_token=...) — detectSessionInUrl já pode ter tratado.
        const hash = window.location.hash?.replace(/^#/, "") || "";
        if (hash.includes("access_token") || hash.includes("error")) {
          // Aguarda o client processar o hash
          await new Promise((r) => setTimeout(r, 150));
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (data.session) {
            await finishOk("/login?emailConfirmado=1");
            return;
          }
        }

        // Sem parâmetros úteis: tenta sessão já existente
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await finishOk("/login?emailConfirmado=1");
          return;
        }

        setMessage("Não encontramos um link de confirmação válido.");
        setTimeout(() => {
          if (!cancelled) setLocation("/login?precisaConfirmar=1");
        }, 1500);
      } catch (e) {
        console.error("Auth callback failed:", e);
        if (!cancelled) {
          setMessage("Não foi possível confirmar o email. Tente reenviar o link.");
          setTimeout(() => {
            if (!cancelled) setLocation("/login?precisaConfirmar=1");
          }, 1800);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-gray-700">{message}</p>
        </div>
      </main>
    </div>
  );
}
