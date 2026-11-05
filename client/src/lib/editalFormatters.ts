/**
 * Funções utilitárias para formatar e normalizar dados de editais
 */

import {
  extractBRLAmountsFromText,
  formatValorPlainTextForDisplay,
  parseBrazilianMoneyToken,
  parseValorProjetoEstruturado,
  type ValorProjetoEstruturado,
} from "./editalValorExtract";
import { normalizePrazoInscricaoPlainText } from "./editalPrazoNormalize";

export interface FormattedValor {
  display: string;
  details?: string[];
  raw?: any;
  /** true quando o texto foi cortado para caber na UI */
  truncated?: boolean;
  /** A que se refere `display` (só no formato estruturado; ausente em valores antigos). */
  escopo?: 'por_projeto' | 'por_bolsa' | 'total_chamada';
}

const VALOR_DISPLAY_MAX_CHARS = 160;

function truncateValorLine(text: string, max = VALOR_DISPLAY_MAX_CHARS): { text: string; truncated: boolean } {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return { text: "", truncated: false };
  if (t.length <= max) return { text: t, truncated: false };
  return { text: `${t.slice(0, max - 1)}…`, truncated: true };
}

export interface PrazoDetailItem {
  chamada?: string;
  inicio?: string;
  fim?: string;
  horario?: string;
  prazo?: string;
}

export interface FormattedPrazo {
  display: string;
  /** Pode misturar strings (prazo livre) e objetos (chamadas) conforme o JSON de origem */
  details?: Array<string | PrazoDetailItem>;
  raw?: any;
}

const formatBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(n);

/** Valor por projeto em destaque; o total da chamada só aparece rotulado como tal. */
function formatValorProjetoEstruturado(e: ValorProjetoEstruturado): FormattedValor {
  const qtd = e.qtd_projetos;
  const total = e.total_programa_texto
    ? `Total da chamada: ${e.total_programa != null ? formatBRL(e.total_programa) : e.total_programa_texto}${
        qtd ? ` (${qtd} ${qtd === 1 ? 'projeto previsto' : 'projetos previstos'})` : ''
      }`
    : null;
  const lines = (xs: Array<string | null>) =>
    xs.filter((x): x is string => !!x).map((x) => truncateValorLine(x).text);

  if (e.valor.length > 0) {
    let display: string;
    if (e.por_projeto_min != null && e.por_projeto_max != null) {
      display = `De ${formatBRL(e.por_projeto_min)} a ${formatBRL(e.por_projeto_max)} por projeto`;
    } else if (e.valor.length === 1 || e.por_projeto_max == null) {
      display = e.valor[0];
    } else {
      display = `Até ${formatBRL(e.por_projeto_max)} por projeto`;
    }
    const main = truncateValorLine(display);
    return {
      display: main.text,
      truncated: main.truncated,
      details: lines([...e.valor, ...e.bolsas, total]),
      raw: e,
      escopo: 'por_projeto',
    };
  }

  if (e.bolsas.length > 0) {
    const main = truncateValorLine(e.bolsas[0]);
    return { display: main.text, truncated: main.truncated, details: lines([...e.bolsas, total]), raw: e, escopo: 'por_bolsa' };
  }

  if (total) {
    const media =
      e.total_programa != null && qtd && qtd > 1
        ? `Média estimada: ~${formatBRL(e.total_programa / qtd)} por projeto (total ÷ ${qtd})`
        : null;
    const main = truncateValorLine(total);
    return {
      display: main.text,
      truncated: main.truncated,
      details: lines(['Valor por projeto não informado no edital', media]),
      raw: e,
      escopo: 'total_chamada',
    };
  }

  return { display: 'Não informado' };
}

/**
 * Normaliza e formata o valor do projeto
 * Aceita JSON string, objeto ou string simples
 */
export function formatValorProjeto(
  valor_projeto: string | Record<string, unknown> | null | undefined,
): FormattedValor {
  if (!valor_projeto || valor_projeto === 'Não informado') {
    return { display: 'Não informado' };
  }

  const estruturado = parseValorProjetoEstruturado(valor_projeto);
  if (estruturado) return formatValorProjetoEstruturado(estruturado);

  try {
    // Tentar parsear como JSON
    let parsed: any;
    
    if (typeof valor_projeto === 'string' && valor_projeto.trim().startsWith('{')) {
      parsed = JSON.parse(valor_projeto);
    } else if (typeof valor_projeto === 'object') {
      parsed = valor_projeto;
    } else {
      const formatted = formatValorPlainTextForDisplay(String(valor_projeto));
      const { text, truncated } = truncateValorLine(formatted.display);
      return {
        display: text || valor_projeto,
        truncated,
        details: formatted.details?.map((d) => truncateValorLine(d).text),
      };
    }

    // Filtrar valores null - se for {"valor": null} ou {"valor": null} em qualquer formato
    if (parsed === null || parsed === undefined) {
      return { display: 'Não informado' };
    }
    
    // Verificar se o objeto tem apenas "valor": null
    if (parsed.valor === null || parsed.valor === undefined) {
      // Se o objeto só tem a chave "valor" com null, retornar "Não informado"
      const keys = Object.keys(parsed);
      if (keys.length === 1 && keys[0] === 'valor' && parsed.valor === null) {
        return { display: 'Não informado' };
      }
      // Se não houver valor mas houver outras chaves, continuar processamento
      if (keys.length === 1 && keys[0] === 'valor') {
        return { display: 'Não informado' };
      }
    }
    
    // Se for objeto com chave "valor" que é array
    if (parsed.valor && Array.isArray(parsed.valor)) {
      // Filtrar valores null do array
      const valores = parsed.valor.filter((v: any) => v !== null && v !== undefined);
      
      // Se após filtrar não houver valores, retornar "Não informado"
      if (valores.length === 0) {
        return { display: 'Não informado' };
      }
      
      // Se for array de strings simples
      if (valores.every((v: any) => typeof v === 'string')) {
        const valoresFormatados: string[] = valores.map((v: string) => {
          // Extrair número do valor (ex: "R$ 1.000.000,00" -> "R$ 1.000.000,00")
          return v.trim();
        }).filter((v: string) => v.length > 0); // Filtrar strings vazias
        
        if (valoresFormatados.length === 0) {
          return { display: 'Não informado' };
        }
        
        if (valoresFormatados.length === 1) {
          const one = truncateValorLine(valoresFormatados[0]);
          return {
            display: one.text,
            truncated: one.truncated,
            details: valoresFormatados.map((v) => truncateValorLine(v).text),
            raw: parsed,
          };
        }
        
        // Se houver múltiplos valores, mostrar o maior e listar os outros
        const valoresNumericos = valoresFormatados.map((v: string) => {
          const numeric = extractBRLAmountsFromText(v)[0] ?? parseBrazilianMoneyToken(v.replace(/r\s*\$\s*/i, "")) ?? 0;
          return { original: v, numeric };
        }).sort((a: { original: string; numeric: number }, b: { original: string; numeric: number }) => b.numeric - a.numeric);
        
        const main = truncateValorLine(valoresNumericos[0].original);
        return {
          display: main.text,
          truncated: main.truncated,
          details: valoresFormatados.map((v) => truncateValorLine(v).text),
          raw: parsed,
        };
      }
      
      // Se for array de objetos complexos
      if (valores.some((v: any) => typeof v === 'object' && v !== null)) {
        // Verificar se todos os valores são objetos com "tipo" e "montante" (formato não relevante)
        const todosSaoTipoMontante = valores.every((v: any) => 
          typeof v === 'object' && v !== null && v.tipo && v.montante
        );
        
        if (todosSaoTipoMontante) {
          // Se todos são objetos com tipo e montante, não exibir (formato complexo não relevante)
          return { display: 'Não informado' };
        }
        
        const valoresFormatados: string[] = [];
        
        valores.forEach((v: any) => {
          if (v === null || v === undefined) {
            return; // Ignorar valores null
          }
          if (typeof v === 'object') {
            // Filtrar objetos com "tipo" e "montante" - não são valores simples para exibição
            if (v.tipo && v.montante) {
              // Ignorar objetos com tipo e montante (formato complexo não relevante)
              return;
            }
            
            if (v.tipo && v.valores_individuais) {
              // Filtrar valores null dos valores individuais
              const valoresIndividuais = Array.isArray(v.valores_individuais) 
                ? v.valores_individuais.filter((vi: any) => vi !== null && vi !== undefined)
                : [];
              if (valoresIndividuais.length > 0) {
                valoresFormatados.push(`${v.tipo}: ${valoresIndividuais.join(', ')}`);
              }
            } else if (v.valor && v.valor !== null && v.valor !== undefined) {
              valoresFormatados.push(String(v.valor));
            }
          } else if (typeof v === 'string' && v.trim().length > 0) {
            valoresFormatados.push(v.trim());
          }
        });
        
        if (valoresFormatados.length === 0) {
          return { display: 'Não informado' };
        }
        
        const main = truncateValorLine(valoresFormatados[0]);
        return {
          display: main.text,
          truncated: main.truncated,
          details: valoresFormatados.map((v) => truncateValorLine(v).text),
          raw: parsed,
        };
      }
    }
    
    // Se for objeto com chave "valor" que é string (não array)
    if (parsed.valor && typeof parsed.valor === 'string' && parsed.valor.trim().length > 0) {
      const { text, truncated } = truncateValorLine(parsed.valor);
      return { display: text, truncated, raw: parsed };
    }
    
    // Se for objeto com outras estruturas
    if (typeof parsed === 'object' && parsed !== null) {
      // Tentar encontrar qualquer valor monetário
      const valores: string[] = [];
      
      const extractValues = (obj: any): void => {
        // Regex para detectar valores monetários com várias moedas
        const currencyRegex = /(r\$|us\$|\$|€|£|¥|chf|cad|aud|nzd|brl|eur|gbp|jpy)\s*[\d.,]+/i;
        
        for (const key in obj) {
          if (typeof obj[key] === 'string' && currencyRegex.test(obj[key])) {
            valores.push(obj[key]);
          } else if (Array.isArray(obj[key])) {
            obj[key].forEach((item: any) => {
              if (typeof item === 'string' && currencyRegex.test(item)) {
                valores.push(item);
              }
            });
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            extractValues(obj[key]);
          }
        }
      };
      
      extractValues(parsed);
      
      if (valores.length > 0) {
        const main = truncateValorLine(valores[0]);
        return {
          display: main.text,
          truncated: main.truncated,
          details: valores.map((v) => truncateValorLine(v).text),
          raw: parsed,
        };
      }
    }
    
    const { text, truncated } = truncateValorLine(
      typeof parsed === "object" && parsed !== null ? JSON.stringify(parsed) : String(parsed),
    );
    return { display: text || "Valor não formatado", truncated, raw: parsed };
  } catch (e) {
    const { text, truncated } = truncateValorLine(String(valor_projeto ?? ""));
    return { display: text || "Não informado", truncated };
  }
}

/**
 * Normaliza e formata os prazos de inscrição
 * Aceita JSON string, objeto ou string simples
 */
export function formatPrazoInscricao(prazo_inscricao: string | null | undefined): FormattedPrazo {
  if (!prazo_inscricao || prazo_inscricao === 'Não informado') {
    return { display: 'Não informado' };
  }

  try {
    // Tentar parsear como JSON
    let parsed: any;
    
    if (typeof prazo_inscricao === 'string' && prazo_inscricao.trim().startsWith('{')) {
      parsed = JSON.parse(prazo_inscricao);
    } else if (typeof prazo_inscricao === 'object') {
      parsed = prazo_inscricao;
    } else {
      const normalized = normalizePrazoInscricaoPlainText(String(prazo_inscricao));
      return {
        display: normalized.display,
        details: normalized.original ? [normalized.original] : undefined,
      };
    }

    // Se for objeto com chave "prazos" que é array
    if (parsed.prazos && Array.isArray(parsed.prazos)) {
      const prazos = parsed.prazos;
      
      if (prazos.length === 0) {
        return { display: 'Não informado' };
      }
      
      if (prazos.length === 1) {
        const prazo = prazos[0];
        let display = '';
        
        if (typeof prazo === 'string') {
          display = prazo;
        } else if (prazo.fim) {
          display = `Até ${prazo.fim}`;
          if (prazo.horario) {
            display += ` às ${prazo.horario}`;
          }
          if (prazo.chamada) {
            display = `${prazo.chamada}: ${display}`;
          }
        } else if (prazo.prazo) {
          display = prazo.prazo;
        } else if (prazo.inicio && prazo.fim) {
          display = `De ${prazo.inicio} até ${prazo.fim}`;
          if (prazo.horario) {
            display += ` às ${prazo.horario}`;
          }
        } else {
          display = JSON.stringify(prazo);
        }
        
        return {
          display,
          details: prazos,
          raw: parsed
        };
      }
      
      // Múltiplos prazos
      const prazosFormatados = prazos.map((prazo: any) => {
        if (typeof prazo === 'string') {
          return { prazo };
        }
        return prazo;
      });
      
      // Criar display resumido
      const primeiroPrazo = prazosFormatados[0];
      let display = '';
      
      if (typeof primeiroPrazo === 'string') {
        display = primeiroPrazo;
      } else if (primeiroPrazo.fim) {
        display = `Até ${primeiroPrazo.fim}`;
      } else if (primeiroPrazo.prazo) {
        display = primeiroPrazo.prazo;
      } else {
        display = 'Múltiplos prazos';
      }
      
      if (prazosFormatados.length > 1) {
        display += ` (+${prazosFormatados.length - 1} mais)`;
      }
      
      return {
        display,
        details: prazosFormatados,
        raw: parsed
      };
    }
    
    // Se for objeto com chave "prazo" (singular)
    if (parsed.prazo) {
      return {
        display: String(parsed.prazo),
        details: [parsed],
        raw: parsed
      };
    }
    
    // Se não conseguiu extrair, retornar string do JSON
    return { display: JSON.stringify(parsed) };
  } catch (e) {
    const normalized = normalizePrazoInscricaoPlainText(String(prazo_inscricao ?? ""));
    return {
      display: normalized.display,
      details: normalized.original ? [normalized.original] : undefined,
    };
  }
}

/**
 * Formata um valor monetário para exibição
 */
export function formatCurrency(value: string | number): string {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }
  
  // Se já estiver formatado com qualquer moeda, retornar como está
  const currencyRegex = /(r\$|us\$|\$|€|£|¥|chf|cad|aud|nzd|brl|eur|gbp|jpy)\s*[\d.,]+/i;
  if (typeof value === 'string' && currencyRegex.test(value)) {
    return value;
  }
  
  return value;
}

/**
 * Converte uma string de data em Date. Datas sem horário ("YYYY-MM-DD") são lidas no fuso local:
 * `new Date("YYYY-MM-DD")` interpreta como UTC e, no Brasil, mostra o dia anterior.
 * Valores com horário (ISO completo, ex.: "2026-10-22T18:00:00Z") seguem `new Date(value)` sem ajuste.
 */
export function parseDateLocal(value: string): Date {
  const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

/**
 * Dias de calendário (fuso local) de hoje até a data: 0 = hoje, 1 = amanhã, negativo = já passou; NaN se inválida.
 * Prazos valem até o fim do dia (mesma regra do backend: `data_encerramento::date >= current_date`).
 */
export function calendarDaysUntil(value: string, now: Date = new Date()): number {
  const d = parseDateLocal(value);
  if (isNaN(d.getTime())) return NaN;
  const target = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/**
 * Formata uma data para exibição
 */
export function formatDate(dateStr: string): string {
  try {
    // Tentar parsear diferentes formatos de data
    const date = parseDateLocal(dateStr);
    if (isNaN(date.getTime())) {
      // Se não conseguir parsear, retornar como está
      return dateStr;
    }
    
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  } catch (e) {
    return dateStr;
  }
}

