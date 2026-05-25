import { useState } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Menu, LogIn, LogOut, FileText, User, LayoutDashboard, ChevronDown, Sparkles, Share2 } from "lucide-react";
import { APP_TITLE } from "@/const";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import SkipLink from "@/components/SkipLink";

export default function Header() {
  const { user, signOut, loading } = useAuth();
  const { profile } = useUserProfile();
  const [location, setLocation] = useLocation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await signOut();
    setProfileMenuOpen(false);
  };

  const handleNavigate = (path: string) => {
    setLocation(path);
    setProfileMenuOpen(false);
  };

  const isActive = (path: string) => location === path || location.startsWith(path + "/");

  const isInDashboardArea =
    user &&
    (location === "/dashboard" ||
      location === "/minhas-propostas" ||
      location === "/planos" ||
      location === "/perfil" ||
      location.startsWith("/perfil/") ||
      location.startsWith("/edital/") ||
      location.startsWith("/propostas/"));

  const paidActive =
    profile?.subscriptionStatus === "active" || profile?.subscriptionStatus === "trialing";
  const planBadgeLabel =
    profile?.subscriptionPlanKey === "empresas"
      ? "Empresas"
      : profile?.subscriptionPlanKey === "pro"
        ? "Plano Pro"
        : paidActive
          ? "Assinante"
          : null;

  // Fechar menu quando clicar fora
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [profileMenuOpen]);

  return (
    <>
      <SkipLink />
      <header 
        className="sticky top-0 z-50 w-full border-b border-[color:var(--institutional-line)] bg-white/95 backdrop-blur"
        role="banner"
        id="navigation"
      >
      <div className="container">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/inicio" aria-label={`${APP_TITLE} - Página inicial`}>
            <div className="flex items-center gap-3 cursor-pointer flex-shrink-0 min-w-0 group">
              <div 
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm border border-primary/25 bg-white text-primary shadow-[inset_3px_0_0_var(--primary)]"
                aria-hidden="true"
              >
                <span className="text-sm font-bold tracking-tight">OL</span>
              </div>
              <div className="min-w-0">
                <span className="block text-base md:text-lg font-semibold text-gray-950 truncate tracking-tight">
                  {APP_TITLE}
                </span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 sm:block">
                  Portal de fomento
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation - Apenas quando não logado */}
          {!user && (
            <nav 
              className="hidden md:flex items-center gap-7"
              role="navigation"
              aria-label="Navegação principal"
            >
              <a 
                href="#como-funciona" 
                className="border-b border-transparent py-5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded-sm"
              >
                Como funciona
              </a>
              <a 
                href="#planos" 
                className="border-b border-transparent py-5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded-sm"
              >
                Planos
              </a>
              <a 
                href="#depoimentos" 
                className="border-b border-transparent py-5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded-sm"
              >
                Depoimentos
              </a>
              <a 
                href="#faq" 
                className="border-b border-transparent py-5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded-sm"
              >
                FAQ
              </a>
            </nav>
          )}

          {/* Desktop Navigation - Quando logado */}
          {user && !loading && (
            <nav 
              className="hidden md:flex items-stretch gap-6 self-stretch"
              role="navigation"
              aria-label="Navegação do usuário"
            >
              <Link
                href="/dashboard"
                className={cn(
                  "flex items-center border-b-2 px-0 text-sm font-medium transition-colors",
                  isActive("/dashboard")
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-700 hover:border-primary/50 hover:text-primary"
                )}
                aria-current={isActive("/dashboard") ? "page" : undefined}
              >
                Painel
              </Link>
              <Link
                href="/minhas-propostas"
                className={cn(
                  "flex items-center border-b-2 px-0 text-sm font-medium transition-colors",
                  isActive("/minhas-propostas")
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-700 hover:border-primary/50 hover:text-primary"
                )}
                aria-current={isActive("/minhas-propostas") ? "page" : undefined}
              >
                Propostas
              </Link>
              <Link
                href="/referencia"
                className={cn(
                  "flex items-center border-b-2 px-0 text-sm font-medium transition-colors",
                  isActive("/referencia")
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-700 hover:border-primary/50 hover:text-primary"
                )}
                aria-current={isActive("/referencia") ? "page" : undefined}
              >
                Rede de acesso
              </Link>
              <Link
                href="/planos"
                className={cn(
                  "flex items-center border-b-2 px-0 text-sm font-medium transition-colors",
                  isActive("/planos")
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-700 hover:border-primary/50 hover:text-primary"
                )}
                aria-current={isActive("/planos") ? "page" : undefined}
              >
                Planos
              </Link>
            </nav>
          )}

          {/* CTA Buttons */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {user && !loading ? (
              <>
                {planBadgeLabel ? (
                  <Badge
                    variant="default"
                    className="hidden md:inline-flex rounded-sm border border-border bg-secondary px-3 py-1.5 font-medium text-primary shadow-none"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    {planBadgeLabel}
                  </Badge>
                ) : null}

                {/* Menu do Usuário */}
                <div className="relative hidden md:block" ref={profileMenuRef}>
                  <Button 
                    variant="ghost" 
                    className="h-10 gap-2 rounded-sm border border-border bg-white px-2.5 hover:bg-secondary"
                    type="button"
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    aria-expanded={profileMenuOpen}
                    aria-haspopup="true"
                    aria-label={`Menu do usuário: ${user.email}`}
                  >
                    <div 
                    className="w-7 h-7 md:w-8 md:h-8 rounded-sm bg-primary flex items-center justify-center text-white font-semibold text-xs md:text-sm flex-shrink-0"
                      aria-hidden="true"
                    >
                      {user.email?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-gray-500 transition-all duration-200 flex-shrink-0", profileMenuOpen && "rotate-180")} aria-hidden="true" />
                  </Button>
                  
                  {profileMenuOpen && (
                    <div 
                      className="absolute right-0 top-full z-[9999] mt-2 w-60 overflow-hidden rounded-sm border border-border bg-white shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
                      role="menu"
                      aria-label="Menu do usuário"
                    >
                      <div className="border-b border-border bg-secondary/60 p-3">
                        <div className="flex flex-col space-y-1 min-w-0">
                          <p className="text-sm font-semibold leading-none text-gray-900">Conta institucional</p>
                          <p className="text-xs leading-none text-gray-600 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => handleNavigate("/perfil")}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-secondary transition-colors cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
                          role="menuitem"
                        >
                          <User className="w-4 h-4" aria-hidden="true" />
                          Perfil
                        </button>
                        <button
                          onClick={() => handleNavigate("/referencia")}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-secondary transition-colors cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
                          role="menuitem"
                        >
                          <Share2 className="w-4 h-4" aria-hidden="true" />
                          Rede de acesso
                        </button>
                        <div className="h-px bg-gray-200 my-1" aria-hidden="true" />
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition-colors cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-inset"
                          role="menuitem"
                        >
                          <LogOut className="w-4 h-4" aria-hidden="true" />
                          Sair
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href="/login">
                <Button 
                  variant="outline" 
                  className="hidden md:inline-flex"
                  size="sm"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </Button>
              </Link>
            )}
            
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden"
                  aria-label="Abrir menu de navegação"
                  aria-expanded="false"
                >
                  <Menu className="w-5 h-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[400px] overflow-y-auto">
                <div className="flex flex-col gap-4 mt-8">
                  {/* Mobile Navigation - esconder Como funciona, Planos, Depoimentos quando dentro do dashboard */}
                  {!isInDashboardArea && (
                    <nav className="flex flex-col gap-4" role="navigation" aria-label="Navegação mobile">
                      <a 
                        href="#como-funciona" 
                        className="text-sm font-medium text-gray-700 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded"
                      >
                        Como Funciona
                      </a>
                      <a 
                        href="#planos" 
                        className="text-sm font-medium text-gray-700 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded"
                      >
                        Planos
                      </a>
                      <a 
                        href="#depoimentos" 
                        className="text-sm font-medium text-gray-700 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded"
                      >
                        Depoimentos
                      </a>
                      <a 
                        href="#faq" 
                        className="text-sm font-medium text-gray-700 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded"
                      >
                        FAQ
                      </a>
                    </nav>
                  )}

                  <div className={cn("border-t border-gray-200 pt-4", !isInDashboardArea && "mt-4")}>
                    {user && !loading ? (
                      <div className="flex flex-col gap-3">
                        {planBadgeLabel ? (
                          <Badge
                            variant="default"
                            className="w-full justify-center bg-primary text-primary-foreground border-0 py-2 font-medium"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                            {planBadgeLabel}
                          </Badge>
                        ) : null}
                        <Link href="/dashboard">
                          <Button 
                            variant={isActive("/dashboard") ? "secondary" : "ghost"}
                            className="w-full justify-start"
                          >
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            Meu Painel
                          </Button>
                        </Link>
                        <Link href="/minhas-propostas">
                          <Button 
                            variant={isActive("/minhas-propostas") ? "secondary" : "ghost"}
                            className="w-full justify-start"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Minhas Propostas
                          </Button>
                        </Link>
                        <Link href="/perfil">
                          <Button 
                            variant={isActive("/perfil") ? "secondary" : "ghost"}
                            className="w-full justify-start"
                          >
                            <User className="w-4 h-4 mr-2" />
                            Meu Perfil
                          </Button>
                        </Link>
                        <Link href="/referencia">
                          <Button 
                            variant={isActive("/referencia") ? "secondary" : "ghost"}
                            className="w-full justify-start"
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Indique e Ganhe
                          </Button>
                        </Link>
                        <Link href="/planos">
                          <Button
                            variant={isActive("/planos") ? "secondary" : "ghost"}
                            className="w-full justify-start"
                          >
                            Planos
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost"
                          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={handleLogout}
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Sair
                        </Button>
                      </div>
                    ) : (
                      <Link href="/login">
                        <Button 
                          variant="outline" 
                          className="w-full"
                        >
                          <LogIn className="w-4 h-4 mr-2" />
                          Entrar
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
