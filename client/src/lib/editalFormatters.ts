/**
 * Funções utilitárias para formatar e normalizar dados de editais
 */

import {
  extractBRLAmountsFromText,
  formatValorPlainTextForDisplay,
  parseBrazilianMoneyToken,
} from "./editalValorExtract";
import { normalizePrazoInscricaoPlainText } from "./editalPrazoNormalize";

export interface FormattedValor {
  display: string;
  details?: string[];
  raw?: any;
  /** true quando o texto foi cortado para caber na UI */
  truncated?: boolean;
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
 * Formata uma data para exibição
 */
export function formatDate(dateStr: string): string {
  try {
    // Tentar parsear diferentes formatos de data
    const date = new Date(dateStr);
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

