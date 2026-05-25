import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, DollarSign, Target, CheckCircle2, 
  GraduationCap, Building2, Users, Eye, Loader2,
  TrendingUp, Clock, Sparkles, ArrowRight, Lock
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatValorProjeto, formatPrazoInscricao } from "@/lib/editalFormatters";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
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
  const [, setLocation] = useLocation();

  useEffect(() => {
    loadEditais();
  }, []);

  const loadEditais = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("editais_corretos")
        .select("id, numero, titulo, descricao, valor_projeto, prazo_inscricao, data_encerramento, orgao, area, is_researcher, is_company")
        .order("criado_em", { ascending: false })
        .limit(50); // Buscar mais para ter opções de filtro

      if (error) {
        console.error("Erro ao buscar editais:", error);
        return;
      }

      setEditais(data || []);
    } catch (error) {
      console.error("Erro ao carregar editais:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredEditais = (): EditalDisplay[] => {
    let filtered = [...editais];

    switch (activeFilter) {
      case "alta-aderencia":
        // Alta aderência (heurística simples): editais com mais informações preenchidas
        filtered = filtered
          .filter(e => e.descricao && e.valor_projeto && e.prazo_inscricao)
          .slice(0, 5);
        break;
      
      case "prazo-proximo":
        // Filtrar por prazo próximo (próximos 120 dias ou editais ainda não encerrados)
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Normalizar para início do dia
        const em120Dias = new Date();
        em120Dias.setDate(hoje.getDate() + 120);
        em120Dias.setHours(23, 59, 59, 999); // Fim do dia
        
        // Função auxiliar para extrair data de um edital
        const extrairDataFim = (edital: EditalDisplay): Date | null => {
          try {
            // Priorizar data_encerramento (tipo DATE no banco)
            if (edital.data_encerramento) {
              const dataEncerramento = new Date(edital.data_encerramento);
              if (!isNaN(dataEncerramento.getTime())) {
                return dataEncerramento;
              }
            }
            
            // Se não tiver data_encerramento, tentar extrair de prazo_inscricao
            if (edital.prazo_inscricao) {
              const prazoFormatado = formatPrazoInscricao(edital.prazo_inscricao);
              
              // Tentar extrair data dos detalhes
              if (prazoFormatado.details && prazoFormatado.details.length > 0) {
                for (const prazo of prazoFormatado.details) {
                  let dataStr: string | null = null;
                  
                  if (typeof prazo === 'string') {
                    // Tentar extrair data da string (formato DD/MM/YYYY ou YYYY-MM-DD)
                    const dateMatch = prazo.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) {
                      dataStr = dateMatch[1];
                    }
                  } else if (prazo.fim) {
                    dataStr = prazo.fim;
                  } else if (prazo.prazo && typeof prazo.prazo === 'string') {
                    const dateMatch = prazo.prazo.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) {
                      dataStr = dateMatch[1];
                    }
                  }
                  
                  if (dataStr) {
                    // Converter DD/MM/YYYY para YYYY-MM-DD se necessário
                    let dataFormatada = dataStr;
                    if (dataStr.includes('/')) {
                      const [dia, mes, ano] = dataStr.split('/');
                      dataFormatada = `${ano}-${mes}-${dia}`;
                    }
                    
                    const dataParsed = new Date(dataFormatada);
                    if (!isNaN(dataParsed.getTime())) {
                      return dataParsed;
                    }
                  }
                }
              }
            }
            
            return null;
          } catch (error) {
            console.error('Erro ao extrair data do edital:', edital.id, error);
            return null;
          }
        };
        
        filtered = filtered
          .map(e => ({ edital: e, dataFim: extrairDataFim(e) }))
          .filter(({ dataFim }) => {
            if (!dataFim || isNaN(dataFim.getTime())) return false;
            
            // Normalizar data para comparação
            const dataNormalizada = new Date(dataFim);
            dataNormalizada.setHours(0, 0, 0, 0);
            
            // Aceitar editais que ainda não encerraram (data >= hoje) e estão dentro de 120 dias
            return dataNormalizada >= hoje && dataNormalizada <= em120Dias;
          })
          .sort((a, b) => {
            // Ordenar por data de encerramento (mais próximo primeiro)
            if (!a.dataFim && !b.dataFim) return 0;
            if (!a.dataFim) return 1;
            if (!b.dataFim) return -1;
            
            return a.dataFim.getTime() - b.dataFim.getTime();
          })
          .map(({ edital }) => edital)
          .slice(0, 5);
        break;
      
      case "alto-valor":
        // Filtrar por alto valor (acima de R$ 100k)
        filtered = filtered
          .filter(e => {
            if (!e.valor_projeto) return false;
            const valorFormatado = formatValorProjeto(e.valor_projeto);
            if (valorFormatado.display === 'Não informado') return false;
            
            // Extrair número do valor
            const match = valorFormatado.display.match(/[\d.]+/);
            if (!match) return false;
            
            const valor = parseFloat(match[0].replace(/\./g, ''));
            return valor >= 100000;
          })
          .slice(0, 5);
        break;
      
      default:
        filtered = filtered.slice(0, 5);
    }

    return filtered;
  };

  const filteredEditais = getFilteredEditais();

  return (
    <section className="py-20 institutional-section">
      <div className="container">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-white text-gray-900 px-4 py-2 rounded-sm text-sm font-semibold mb-4 border border-[color:var(--institutional-line)] shadow-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="institutional-kicker">Painel institucional</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Editais apresentados com critérios claros de relevância
          </h2>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <button
            onClick={() => setActiveFilter("todos")}
            className={`px-6 py-2.5 rounded-sm font-semibold transition-colors ${
              activeFilter === "todos"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-800 border border-[color:var(--institutional-line)] hover:border-primary hover:bg-secondary"
            }`}
          >
            Todos os editais
          </button>
          <button
            onClick={() => setActiveFilter("alta-aderencia")}
            className={`px-6 py-2.5 rounded-sm font-semibold transition-colors flex items-center gap-2 ${
              activeFilter === "alta-aderencia"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-800 border border-[color:var(--institutional-line)] hover:border-primary hover:bg-secondary"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Alta aderência
          </button>
          <button
            onClick={() => setActiveFilter("prazo-proximo")}
            className={`px-6 py-2.5 rounded-sm font-semibold transition-colors flex items-center gap-2 ${
              activeFilter === "prazo-proximo"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-800 border border-[color:var(--institutional-line)] hover:border-primary hover:bg-secondary"
            }`}
          >
            <Clock className="w-4 h-4" />
            Prazo próximo
          </button>
          <button
            onClick={() => setActiveFilter("alto-valor")}
            className={`px-6 py-2.5 rounded-sm font-semibold transition-colors flex items-center gap-2 ${
              activeFilter === "alto-valor"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-800 border border-[color:var(--institutional-line)] hover:border-primary hover:bg-secondary"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Alto valor
          </button>
        </div>

        {/* Lista de Editais */}
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
            {filteredEditais.map((edital) => (
              <Card
                key={edital.id}
                className="p-6 institutional-surface"
              >
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900 line-clamp-2 flex-1">
                        {edital.titulo}
                      </h3>
                    </div>
                    
                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {(() => {
                        const isResearcher = edital.is_researcher === true;
                        const isCompany = edital.is_company === true;
                        
                        if (isResearcher && isCompany) {
                          return (
                            <Badge variant="outline" className="bg-secondary text-primary border-border text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              Pesquisadores e Empresas
                            </Badge>
                          );
                        } else if (isResearcher) {
                          return (
                            <Badge variant="outline" className="bg-secondary text-primary border-border text-xs">
                              <GraduationCap className="w-3 h-3 mr-1" />
                              Pesquisadores
                            </Badge>
                          );
                        } else if (isCompany) {
                          return (
                            <Badge variant="outline" className="bg-secondary text-primary border-border text-xs">
                              <Building2 className="w-3 h-3 mr-1" />
                              Empresas
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Órgão */}
                    {edital.orgao && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{edital.orgao}</span>
                      </div>
                    )}
                  </div>

                  {/* Informações */}
                  <div className="space-y-2 mb-4 flex-1">
                    {(() => {
                      const valorFormatado = formatValorProjeto(edital.valor_projeto || null);
                      if (valorFormatado.display !== 'Não informado') {
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
                      if (prazoFormatado.display !== 'Não informado') {
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

                  <div className="mb-4 p-3 bg-secondary rounded-sm border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Indicações</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-600">
                          {user ? "Personalizadas no dashboard" : "Disponível após login"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botão */}
                  <Button 
                    variant="outline" 
                    className="w-full transition-colors hover:bg-secondary group"
                    onClick={() => {
                      if (!user) {
                        toast.info("Faça login para ver os detalhes completos do edital");
                        setLocation(`/login?redirect=/edital/${edital.id}`);
                      } else {
                        setLocation(`/edital/${edital.id}`);
                      }
                    }}
                  >
                    {user ? (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Ver detalhes
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Fazer login para ver detalhes
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          <Link href="/dashboard">
            <Button 
              size="lg"
              variant="attention"
              className="px-8 py-6 text-lg rounded-sm"
            >
              Ver todos os editais
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
