import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_TITLE } from "@/const";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { useLandingSectionHref } from "@/lib/landingSections";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [, setLocation] = useLocation();
  const sectionHref = useLandingSectionHref();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      // Salvar lead no Supabase (tabela leads)
      const { error: leadError } = await supabase
        .from("leads")
        .insert({
          email: email.toLowerCase().trim(),
          source: "landing_page_footer",
        });

      // Se der erro porque a tabela não existe ou por permissão, não é crítico
      // O importante é redirecionar para cadastro
      if (leadError) {
        const errorMsg = leadError.message || "";
        const isTableNotFound = 
          errorMsg.includes("relation") || 
          errorMsg.includes("does not exist") ||
          errorMsg.includes("permission") ||
          errorMsg.includes("policy");
        
        if (!isTableNotFound) {
          console.warn("Erro ao salvar lead (não crítico):", leadError);
        }
        // Mesmo com erro, continuar com o fluxo
      }

      setSuccess(true);
      toast.success("Redirecionando para o cadastro…");
      
      // Redirecionar para cadastro após 1 segundo
      setTimeout(() => {
        setLocation(`/cadastro?email=${encodeURIComponent(email)}`);
      }, 1000);
    } catch (error) {
      console.error("Erro ao processar email:", error);
      // Mesmo com erro, redirecionar para cadastro
      toast.success("Redirecionando para o cadastro…");
      setTimeout(() => {
        setLocation(`/cadastro?email=${encodeURIComponent(email)}`);
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-ink text-white [&_*:focus-visible]:outline-white" role="contentinfo">
      <div className="bg-primary py-14">
        <div className="container grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="font-display text-3xl font-semibold text-white md:text-4xl">
              Veja quais editais abertos combinam com você.
            </h2>
            <p className="mt-3 text-lg text-white/85">
              Crie sua conta para receber indicações, acompanhar prazos e organizar a proposta.
            </p>
          </div>

          <div className="w-full lg:max-w-md lg:justify-self-end">
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row" aria-label="Cadastro por e-mail" aria-describedby="footer-email-note">
            <label htmlFor="footer-email" className="sr-only">E-mail</label>
            <Input
              id="footer-email"
              type="email"
              placeholder="Seu e-mail"
              autoComplete="email"
              className="h-12 rounded-sm border-0 bg-white text-gray-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || success}
              required
              aria-required="true"
            />
            <Button
              type="submit"
              size="lg"
              className="h-12 whitespace-nowrap rounded-sm bg-white px-7 text-primary hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Enviando…
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Redirecionando…
                </>
              ) : (
                "Criar conta gratuita"
              )}
            </Button>
          </form>
          <p id="footer-email-note" className="mt-3 text-sm text-white/75">
            Usamos o e-mail só para criar sua conta.
          </p>
          </div>
        </div>
      </div>

      <div className="container py-12">
        <div className="mb-10 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3 flex items-center gap-2.5">
              <img src="/favicon.svg" alt="" className="h-8 w-8" />
              <span className="text-lg font-semibold">{APP_TITLE}</span>
            </div>
            <p className="max-w-xs text-sm text-white/65">
              Editais de fomento para pesquisa e inovação.
            </p>
          </div>

          <nav aria-labelledby="footer-produto">
            <h3 id="footer-produto" className="mb-4 text-sm font-semibold text-white">Produto</h3>
            <ul className="space-y-2 text-sm text-white/65">
              <li><a href={sectionHref("como-funciona")} className="hover:text-white">Como funciona</a></li>
              <li><a href={sectionHref("planos")} className="hover:text-white">Planos</a></li>
              <li><a href={sectionHref("faq")} className="hover:text-white">Dúvidas frequentes</a></li>
              <li><Link href="/demo" className="hover:text-white">Demonstração</Link></li>
              <li><Link href="/referencia" className="hover:text-white">Rede de acesso</Link></li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-empresa">
            <h3 id="footer-empresa" className="mb-4 text-sm font-semibold text-white">Empresa</h3>
            <ul className="space-y-2 text-sm text-white/65">
              <li><Link href="/sobre" className="hover:text-white">Sobre</Link></li>
              <li><Link href="/contato" className="hover:text-white">Contato</Link></li>
              <li><a href="mailto:contato@origemlabsolutions.com" className="break-all hover:text-white">contato@origemlabsolutions.com</a></li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal">
            <h3 id="footer-legal" className="mb-4 text-sm font-semibold text-white">Informações legais</h3>
            <ul className="space-y-2 text-sm text-white/65">
              <li><Link href="/politica-privacidade" className="hover:text-white">Privacidade</Link></li>
              <li><Link href="/termos-de-uso" className="hover:text-white">Termos de uso</Link></li>
              <li><Link href="/cookies" className="hover:text-white">Cookies</Link></li>
            </ul>
          </nav>
        </div>

        <p className="border-t border-white/15 pt-8 text-sm text-white/65">
          © {new Date().getFullYear()} {APP_TITLE}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
