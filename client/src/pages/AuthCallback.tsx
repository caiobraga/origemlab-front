import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import {
  establishAuthSessionFromUrl,
  humanizeAuthLinkError,
  isRecoveryAuthUrl,
  markPendingAuthFlow,
  stripAuthParamsFromPath,
} from "@/lib/authCallbackUrl";

/**
 * Landing page dos links de email do Supabase (confirmação de cadastro, etc.).
 * Recuperação de senha vai para /redefinir-senha (bootstrap em main.tsx).
 */
export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("Confirmando seu email…");
  const [softError, setSoftError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const recovery = isRecoveryAuthUrl(url);
        const errorDescription =
          url.searchParams.get("error_description") || url.searchParams.get("error");

        if (errorDescription) {
          const friendly = humanizeAuthLinkError(errorDescription, { recovery });
          if (!cancelled) {
            setSoftError(friendly);
            setMessage("");
          }
          return;
        }

        const result = await establishAuthSessionFromUrl(url);
        if (!result.ok) {
          if (!cancelled) {
            setSoftError(result.error);
            setMessage("");
          }
          return;
        }

        stripAuthParamsFromPath("/auth/callback");

        if (result.flow === "recovery") {
          // establishAuthSessionFromUrl consumiu a flag; sem ela /redefinir-senha (já sem token na URL)
          // trataria a sessão como login comum e mandaria para o dashboard sem pedir a nova senha.
          markPendingAuthFlow("recovery");
          if (!cancelled) setLocation("/redefinir-senha");
          return;
        }

        if (!cancelled) {
          setLocation("/login?emailConfirmado=1");
        }
      } catch (e) {
        console.warn("Auth callback failed:", e);
        if (!cancelled) {
          setSoftError(humanizeAuthLinkError(e, { recovery: isRecoveryAuthUrl() }));
          setMessage("");
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
        <div className="max-w-md text-center space-y-4">
          {softError ? (
            <>
              <p className="text-gray-800">{softError}</p>
              <div className="flex flex-col gap-2">
                <Link href="/cadastro">
                  <span className="block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 cursor-pointer">
                    Criar nova conta
                  </span>
                </Link>
                <Link href="/esqueci-a-senha">
                  <span className="block text-sm text-primary hover:text-primary/80 font-medium cursor-pointer">
                    Recuperar senha
                  </span>
                </Link>
                <Link href="/login">
                  <span className="block text-sm text-gray-600 hover:text-gray-800 cursor-pointer">
                    Voltar ao login
                  </span>
                </Link>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
              <p className="text-gray-700">{message}</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
