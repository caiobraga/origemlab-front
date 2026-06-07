import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, DollarSign, Target,
  GraduationCap, Building2, Users, Eye, Loader2,
  TrendingUp, Clock, Sparkles, ArrowRight, Lock
} from "lucide-react";
import { fetchEditaisFromSupabase } from "@/lib/editaisApi";
import { formatValorProjeto, formatPrazoInscricao } from "@/lib/editalFormatters";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionEntitlements } from "@/hooks/useSubscriptionEntitlements";
import { canAccessEditalCatalog, subscriptionUpgradeMessage } from "@/lib/subscriptionEntitlements";
import { toast } from "sonner";

interface EditalDisplay {
  id: string;
  numero: string | null;
  titulo: string;
  descricao: string | null;
  valor_projeto: string | null;
  prazo_inscricao: string | null;
  data_encerramento: string | null;
  orgao: string | null;
  area: string | null;
  is_researcher: boolean | null;
  is_company: boolean | null;
}

type FilterType = "todos" | "alta-aderencia" | "prazo-proximo" | "alto-valor";

export default function IntelligentPanel() {
  const [editais, setEditais] = useState<EditalDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("todos");
  const { user } = useAuth();
  const { entitlements, proFeatures } = useSubscriptionEntitlements();
  const [, setLocation] = useLocation();

  useEffect(() => {
    void loadEditais();
  }, [user?.id, entitlements.tier]);

  const loadEditais = async () => {
    if (!user) {
      setEditais([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { rows } = await fetchEditaisFromSupabase({ limit: 50, offset: 0 });
      setEditais((rows || []) as EditalDisplay[]);
    } catch (error) {
      console.error("Erro ao carregar editais:", error);
      setEditais([]);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredEditais = (): EditalDisplay[] => {
    let filtered = [...editais];

    switch (activeFilter) {
      case "alta-aderencia":
        filtered = filtered
          .filter(e => e.descricao && e.valor_projeto && e.prazo_inscricao)
          .slice(0, 5);
        break;

      case "prazo-proximo": {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const em120Dias = new Date();
        em120Dias.setDate(hoje.getDate() + 120);
        em120Dias.setHours(23, 59, 59, 999);

        const extrairDataFim = (edital: EditalDisplay): Date | null => {
          try {
            if (edital.data_encerramento) {
              const dataEncerramento = new Date(edital.data_encerramento);
              if (!isNaN(dataEncerramento.getTime())) {
                return dataEncerramento;
              }
            }

            if (edital.prazo_inscricao) {
              const prazoFormatado = formatPrazoInscricao(edital.prazo_inscricao);

              if (prazoFormatado.details && prazoFormatado.details.length > 0) {
                for (const detail of prazoFormatado.details) {
                  const match = detail.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                  if (match) {
                    const [, dia, mes, ano] = match;
                    const data = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                    if (!isNaN(data.getTime())) return data;
                  }
                }
              }

              const match = prazoFormatado.display.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              if (match) {
                const [, dia, mes, ano] = match;
                const data = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                if (!isNaN(data.getTime())) return data;
              }
            }
          } catch {
            return null;
          }
          return null;
        };

        filtered = filtered
          .map(e => ({ edital: e, dataFim: extrairDataFim(e) }))
          .filter(({ dataFim }) => {
            if (!dataFim) return false;
            return dataFim >= hoje && dataFim <= em120Dias;
          })
          .sort((a, b) => (a.dataFim?.getTime() || 0) - (b.dataFim?.getTime() || 0))
          .map(({ edital }) => edital)
          .slice(0, 5);
        break;
      }

      case "alto-valor":
        filtered = filtered
          .filter(e => e.valor_projeto)
          .slice(0, 5);
        break;

      default:
        break;
    }

    return filtered;
  };

  const filteredEditais = getFilteredEditais();

  const handleOpenEdital = (editalId: string) => {
    if (!user) {
      toast.info("Faça login para ver os detalhes completos do edital");
      setLocation(`/login?redirect=/edital/${editalId}`);
      return;
    }
    if (!canAccessEditalCatalog(entitlements, editalId)) {
      toast.error(subscriptionUpgradeMessage("editais_catalog"));
      setLocation("/planos");
      return;
    }
    setLocation(`/edital/${editalId}`);
  };

  return (
    <section className="py-24 bg-[color:var(--background)]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="institutional-kicker">Painel institucional</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Editais apresentados com critérios claros de relevância
          </h2>
          {!user && (
            <p className="text-gray-600 max-w-2xl mx-auto">
              Faça login para ver os editais do catálogo. Plano gratuito: até 3 editais por mês.
            </p>
          )}
          {user && !proFeatures && (
            <p className="text-gray-600 max-w-2xl mx-auto">
              {subscriptionUpgradeMessage("editais_catalog")}
            </p>
          )}
        </div>

        {!user ? (
          <div className="text-center py-12">
            <Button asChild size="lg">
              <Link href="/login">Entrar para ver editais</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {(
                [
                  { key: "todos" as const, label: "Todos os editais", icon: null },
                  { key: "alta-aderencia" as const, label: "Alta aderência", icon: TrendingUp },
                  { key: "prazo-proximo" as const, label: "Prazo próximo", icon: Clock },
                  { key: "alto-valor" as const, label: "Alto valor", icon: DollarSign },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`px-6 py-2.5 rounded-sm font-semibold transition-colors flex items-center gap-2 ${
                    activeFilter === key
                      ? "bg-primary text-white shadow-sm"
                      : "bg-white text-gray-800 border border-[color:var(--institutional-line)] hover:border-primary hover:bg-secondary"
                  }`}
                >
                  {Icon ? <Icon className="w-4 h-4" /> : null}
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-gray-600">Carregando editais...</span>
              </div>
            ) : filteredEditais.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Nenhum edital encontrado com este filtro.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {filteredEditais.map((edital) => {
                  const locked = !canAccessEditalCatalog(entitlements, edital.id);
                  return (
                    <Card key={edital.id} className="p-6 institutional-surface relative overflow-hidden">
                      {locked && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 px-4 text-center">
                          <Lock className="w-5 h-5 text-primary" />
                          <p className="text-sm font-medium text-gray-800">Plano Pro necessário</p>
                        </div>
                      )}
                      <div className="flex flex-col h-full">
                        <div className="mb-4">
                          <h3 className="text-lg font-bold text-gray-900 line-clamp-2 flex-1 mb-2">
                            {edital.titulo}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {edital.is_researcher && edital.is_company && (
                              <Badge variant="outline" className="bg-secondary text-primary border-border text-xs">
                                <Users className="w-3 h-3 mr-1" />
                                Pesquisadores e Empresas
                              </Badge>
                            )}
                            {edital.is_researcher && !edital.is_company && (
                              <Badge variant="outline" className="bg-secondary text-primary border-border text-xs">
                                <GraduationCap className="w-3 h-3 mr-1" />
                                Pesquisadores
                              </Badge>
                            )}
                            {edital.is_company && !edital.is_researcher && (
                              <Badge variant="outline" className="bg-secondary text-primary border-border text-xs">
                                <Building2 className="w-3 h-3 mr-1" />
                                Empresas
                              </Badge>
                            )}
                          </div>
                          {edital.orgao && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">{edital.orgao}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 mb-4 flex-1">
                          {(() => {
                            const valorFormatado = formatValorProjeto(edital.valor_projeto || null);
                            if (valorFormatado.display !== "Não informado") {
                              return (
                                <div className="flex items-start gap-2 text-sm min-w-0">
                                  <DollarSign className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                  <span className="font-semibold text-gray-900 break-words min-w-0">{valorFormatado.display}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {(() => {
                            const prazoFormatado = formatPrazoInscricao(edital.prazo_inscricao || null);
                            if (prazoFormatado.display !== "Não informado") {
                              return (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <span>{prazoFormatado.display}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {edital.area && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Target className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span>{edital.area}</span>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="outline"
                          className="w-full transition-colors hover:bg-secondary group"
                          onClick={() => handleOpenEdital(edital.id)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver detalhes
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {!proFeatures && (
              <div className="text-center mt-10">
                <Button asChild variant="attention">
                  <Link href="/planos">
                    Ver planos Pro
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
