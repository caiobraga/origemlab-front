import { formatPrazoInscricao, type FormattedPrazo } from "@/lib/editalFormatters";
import { isEditalAtivoByDatePatterns } from "@/lib/editalActiveByDatePatterns";
import {
  extractAllPrazoDatesFromText,
  extractDeadlineDateFromPrazoText,
  normalizePrazoInscricaoPlainText,
  parseDateFromAtéDisplay,
  parsePrazoDateToken,
  sameCalendarDay,
} from "@/lib/editalPrazoNormalize";

export const normalizeText = (value: unknown): string => {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

export const formatDatePtBR = (date: Date): string => {
  try {
    return date.toLocaleDateString("pt-BR");
  } catch {
    return String(date);
  }
};

/** Extrai a data mais recente (prazo fim) de prazo_inscricao para comparar com hoje */
export const extrairDataMaisRecentePrazo = (prazo: string | null | undefined): Date | null => {
  if (!prazo || prazo === "Não informado") return null;
  const normalizeMonth = (m: string): string => {
    return String(m || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  const monthMap: Record<string, number> = {
    janeiro: 1,
    jan: 1,
    fevereiro: 2,
    fev: 2,
    marco: 3,
    mar: 3,
    abril: 4,
    abr: 4,
    maio: 5,
    mai: 5,
    junho: 6,
    jun: 6,
    julho: 7,
    jul: 7,
    agosto: 8,
    ago: 8,
    setembro: 9,
    set: 9,
    outubro: 10,
    out: 10,
    novembro: 11,
    nov: 11,
    dezembro: 12,
    dez: 12,
  };

  const parsePtMonthDateParts = (dayStr: string, monthStr: string, yearStr: string): Date | null => {
    const day = Number(dayStr);
    const year = Number(yearStr);
    const monthKey = normalizeMonth(monthStr);
    const month = monthMap[monthKey];
    if (!month || !day || !year) return null;
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  };

  // Parse somente quando a string é *apenas* uma data (evita pegar datas erradas dentro de textos/JSON)
  const parseDateOnly = (str: string): Date | null => {
    const s = String(str).trim();

    const isoOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoOnly) {
      const year = Number(isoOnly[1]);
      const month = Number(isoOnly[2]);
      const day = Number(isoOnly[3]);
      const d = new Date(year, month - 1, day);
      return isNaN(d.getTime()) ? null : d;
    }

    const brOnly = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (brOnly) {
      const day = Number(brOnly[1]);
      const month = Number(brOnly[2]);
      const year = Number(brOnly[3]);
      const d = new Date(year, month - 1, day);
      return isNaN(d.getTime()) ? null : d;
    }

    const brShort = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
    if (brShort) {
      return parsePrazoDateToken(`${brShort[1]}/${brShort[2]}/${brShort[3]}`);
    }

    // Ex.: "08 de outubro de 2025" ou "8 outubro 2025"
    const ptMonthOnly1 = s.match(/^(\d{1,2})\s+de\s+([a-zA-ZÀ-ÿçÇ]+)\s+de\s+(\d{4})$/i);
    if (ptMonthOnly1) {
      return parsePtMonthDateParts(ptMonthOnly1[1], ptMonthOnly1[2], ptMonthOnly1[3]);
    }
    const ptMonthOnly2 = s.match(/^(\d{1,2})\s+([a-zA-ZÀ-ÿçÇ]+)\s+(\d{4})$/i);
    if (ptMonthOnly2) {
      return parsePtMonthDateParts(ptMonthOnly2[1], ptMonthOnly2[2], ptMonthOnly2[3]);
    }

    // Tentar datas com hora (ISO completo), mas só quando parece um formato de data/hora.
    if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/i.test(s)) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  };

  /** Procura datas dentro de um texto (último recurso) */
  const extrairDatasDoTexto = (texto: string): Date[] => {
    const datas: Date[] = [];
    if (!texto) return datas;

    const t = String(texto);
    const matches: string[] = [];
    // ISO e BR numérico
    const basic = t.match(/\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2}\b/g);
    if (basic) matches.push(...basic);
    // Datas com mês por extenso (pt-BR)
    const ptMonthRegex =
      /\b(\d{1,2})\s+de\s+([a-zA-ZÀ-ÿçÇ]+)\s+de\s+(\d{4})\b|\b(\d{1,2})\s+([a-zA-ZÀ-ÿçÇ]+)\s+(\d{4})\b/gi;
    let m: RegExpExecArray | null;
    while ((m = ptMonthRegex.exec(t)) !== null) {
      // preferir a forma com "de"
      if (m[1] && m[2] && m[3]) {
        matches.push(`${m[1]} de ${m[2]} de ${m[3]}`);
      } else if (m[4] && m[5] && m[6]) {
        matches.push(`${m[4]} ${m[5]} ${m[6]}`);
      }
    }

    if (matches.length === 0) return datas;

    for (const m of matches) {
      const d = parseDateOnly(m);
      if (d) datas.push(d);
    }
    return datas;
  };

  try {
    let parsed: any;
    if (typeof prazo === "string" && prazo.trim().startsWith("{")) {
      parsed = JSON.parse(prazo);
    } else if (typeof prazo === "object") {
      parsed = prazo;
    } else {
      const preferred = extractDeadlineDateFromPrazoText(String(prazo));
      if (preferred) return preferred;
      const quaisquer = extrairDatasDoTexto(String(prazo));
      const max = quaisquer.length ? Math.max(...quaisquer.map((x) => x.getTime()).filter((t) => !isNaN(t))) : NaN;
      return Number.isFinite(max) ? new Date(max) : null;
    }
    const datas: Date[] = [];
    if (parsed.prazos && Array.isArray(parsed.prazos)) {
      for (const p of parsed.prazos) {
        const str = typeof p === "string" ? p : p.fim || p.prazo;
        if (str) {
          const found = extrairDatasDoTexto(String(str));
          datas.push(...found);
        }
      }
    } else if (parsed.fim) {
      datas.push(...extrairDatasDoTexto(String(parsed.fim)));
    } else if (parsed.prazo) {
      datas.push(...extrairDatasDoTexto(String(parsed.prazo)));
    }
    if (datas.length === 0) {
      const texto = JSON.stringify(parsed);
      const quaisquer = extrairDatasDoTexto(texto);
      const max = quaisquer.length ? Math.max(...quaisquer.map((x) => x.getTime()).filter((t) => !isNaN(t))) : NaN;
      return Number.isFinite(max) ? new Date(max) : null;
    }
    return new Date(Math.max(...datas.map((d: Date) => d.getTime())));
  } catch {
    const str = String(prazo);
    const quaisquer = extrairDatasDoTexto(str);
    const max = quaisquer.length ? Math.max(...quaisquer.map((x) => x.getTime()).filter((t) => !isNaN(t))) : NaN;
    return Number.isFinite(max) ? new Date(max) : null;
  }
};

export const getPrazoInscricaoSummary = (prazoInscricao: any): { date: Date | null; extraCount: number } => {
  if (!prazoInscricao || prazoInscricao === "Não informado") return { date: null, extraCount: 0 };

  // Tentar obter contagem de prazos quando vier como JSON
  let extraCount = 0;
  try {
    let parsed: any = prazoInscricao;
    if (typeof prazoInscricao === "string" && prazoInscricao.trim().startsWith("{")) {
      parsed = JSON.parse(prazoInscricao);
    }
    if (parsed?.prazos && Array.isArray(parsed.prazos) && parsed.prazos.length > 1) {
      extraCount = parsed.prazos.length - 1;
    }
  } catch {
    // ignore
  }

  const date = extrairDataMaisRecentePrazo(typeof prazoInscricao === "string" ? prazoInscricao : JSON.stringify(prazoInscricao));
  return { date: date && !isNaN(date.getTime()) ? date : null, extraCount };
};

/** Prioriza sempre a data de submissão (timeline_estimada). */
export const extrairDeadlineSubmissao = (timeline: any): Date | null => {
  if (!timeline) return null;

  let obj: any = timeline;
  if (typeof timeline === "string") {
    try {
      obj = JSON.parse(timeline);
    } catch {
      return null;
    }
  }

  const fases = obj?.fases;
  if (!Array.isArray(fases) || fases.length === 0) return null;

  const isDateLikeFieldUsable = (value: unknown): boolean => {
    if (value == null) return false;
    const s = String(value).trim();
    if (!s) return false;
    if (/invalid date/i.test(s)) return false;
    const d = new Date(s);
    return !isNaN(d.getTime());
  };

  const timelinePareceParseavel = (): boolean => {
    // Se a timeline não tem datas parseáveis, não usar ela como “fonte de verdade”
    // (evita “Invalid Date” e fases sem datas reais).
    for (const fase of fases) {
      const di = fase?.data_inicio;
      const df = fase?.data_fim;
      const diStr = di == null ? "" : String(di).trim();
      const dfStr = df == null ? "" : String(df).trim();

      const prazoTxt = String(fase?.prazo || fase?.fim || "").trim();
      const prazoTemData =
        prazoTxt &&
        /\d/.test(prazoTxt) &&
        (() => {
          const d = extrairDataMaisRecentePrazo(prazoTxt);
          return !!(d && !isNaN(d.getTime()));
        })();

      const datasCamposOk =
        (diStr ? isDateLikeFieldUsable(di) : true) && (dfStr ? isDateLikeFieldUsable(df) : true);

      // Se existir campo de data “preenchido” mas inválido, a timeline só é confiável se ainda houver texto parseável.
      const temCampoDataPreenchidoInválido =
        (diStr && !isDateLikeFieldUsable(di)) || (dfStr && !isDateLikeFieldUsable(df));
      if (temCampoDataPreenchidoInválido && !prazoTemData) return false;

      if (!datasCamposOk) {
        if (prazoTemData) return true;
        continue;
      }

      if (isDateLikeFieldUsable(di) || isDateLikeFieldUsable(df)) return true;

      if (prazoTemData) return true;
    }
    return false;
  };

  if (!timelinePareceParseavel()) return null;

  const isFaseSubmissaoStrict = (fase: any): boolean => {
    const nome = normalizeText(fase?.nome);
    // “submiss*” cobre submissão/submissao/submissões
    if (nome.includes("submiss")) return true;
    // Alguns editais nomeiam a fase como “Envio …” (proposta/documentos)
    if (nome.includes("envio")) return true;
    return false;
  };

  const isFaseInscricao = (fase: any): boolean => {
    const nome = normalizeText(fase?.nome);
    // “inscri*” cobre inscrição/inscricao
    return nome.includes("inscri");
  };

  const candidatos =
    fases.filter(isFaseSubmissaoStrict).length > 0
      ? fases.filter(isFaseSubmissaoStrict)
      : fases.filter(isFaseInscricao);

  const candidatosFases = candidatos.length > 0 ? candidatos : fases;

  const deadlines: Date[] = [];

  const extractDeadlineFromText = (text: string): Date | null => {
    const t = String(text || "");
    const norm = normalizeText(t);

    // 1) Se existir "fim:" ou "fim" com uma data logo após, essa é a fonte de verdade
    const fimMatch = norm.match(
      /\bfim\b\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{4}|\d{1,2}\s+de\s+[a-zA-ZÀ-ÿçÇ]+\s+de\s+\d{4}|\d{1,2}\s+[a-zA-ZÀ-ÿçÇ]+\s+\d{4})/i,
    );
    if (fimMatch?.[1]) {
      const d = extrairDataMaisRecentePrazo(fimMatch[1]);
      if (d && !isNaN(d.getTime())) return d;
    }

    // 2) "até <data>" geralmente representa o deadline
    const ateMatch = norm.match(
      /\bate\b\s+([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{4}|\d{1,2}\s+de\s+[a-zA-ZÀ-ÿçÇ]+\s+de\s+\d{4}|\d{1,2}\s+[a-zA-ZÀ-ÿçÇ]+\s+\d{4})/i,
    );
    if (ateMatch?.[1]) {
      const d = extrairDataMaisRecentePrazo(ateMatch[1]);
      if (d && !isNaN(d.getTime())) return d;
    }

    // 3) Intervalos: pegar a *segunda* data como deadline (ex.: "06/04/2026 a 17/04/2026" ou "05/04/2026 - 16/04/2026")
    // Aceitar hífen normal "-", en-dash "–" e em-dash "—"
    const rangeBasic = t.match(
      /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})\s*(?:-|–|—|\ba\b|\bat[eé]\b|\bto\b)\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i,
    );
    if (rangeBasic?.[2]) {
      const d = extrairDataMaisRecentePrazo(rangeBasic[2]);
      if (d && !isNaN(d.getTime())) return d;
    }

    // 4) Último recurso: se houver apenas uma data, usar ela
    const d = extrairDataMaisRecentePrazo(t);
    if (d && !isNaN(d.getTime())) return d;
    return null;
  };

  for (const fase of candidatosFases) {
    // Preferir data_fim quando existir (deadline real)
    if (fase?.data_fim) {
      const parsedFim = extrairDataMaisRecentePrazo(String(fase.data_fim));
      if (parsedFim && !isNaN(parsedFim.getTime())) {
        deadlines.push(parsedFim);
        continue;
      }
    }

    // Fallback: extrair deadline de textos (prioriza "Fim:" / "Até" / 2ª data do intervalo)
    const rawText = [fase?.prazo, fase?.fim, fase?.nome, fase?.data_inicio, fase?.data_fim]
      .filter(Boolean)
      .map(String)
      .join(" | ");
    const extractedDeadline = extractDeadlineFromText(rawText);
    if (extractedDeadline && !isNaN(extractedDeadline.getTime())) deadlines.push(extractedDeadline);
  }

  if (deadlines.length === 0) return null;
  return new Date(Math.max(...deadlines.map((d) => d.getTime())));
};

function unwrapTimelineEstimada(timeline: unknown): { fases: any[] } | null {
  if (timeline == null) return null;
  let cur: any = timeline;
  for (let i = 0; i < 3 && cur && typeof cur === "object" && "json" in cur; i++) {
    cur = cur.json;
  }
  if (typeof cur === "string") {
    try {
      cur = JSON.parse(cur);
    } catch {
      return null;
    }
  }
  if (!cur || typeof cur !== "object" || !Array.isArray((cur as any).fases)) return null;
  return { fases: (cur as any).fases };
}

const isFaseSubmissaoNome = (fase: any): boolean => {
  const nome = normalizeText(fase?.nome);
  return (
    nome.includes("submiss") ||
    nome.includes("envio") ||
    nome.includes("propost") ||
    nome.includes("cadastr") ||
    nome.includes("candidat") ||
    nome.includes("recebimento")
  );
};

const isFaseInscricaoNome = (fase: any): boolean => {
  const nome = normalizeText(fase?.nome);
  return nome.includes("inscri") || nome.includes("habilit") || nome.includes("registr");
};

/** Extração menos restritiva: usa todas as fases quando nomes não batem com inscri/submiss. */
export const extrairDeadlineTimelineAmplo = (timeline: unknown): Date | null => {
  const tl = unwrapTimelineEstimada(timeline);
  if (!tl?.fases?.length) return null;

  let candidatos = tl.fases.filter(isFaseSubmissaoNome);
  if (!candidatos.length) candidatos = tl.fases.filter(isFaseInscricaoNome);
  if (!candidatos.length) candidatos = tl.fases;

  const deadlines: Date[] = [];

  for (const fase of candidatos) {
    for (const part of [fase?.data_fim, fase?.fim, fase?.prazo, fase?.data_inicio, fase?.nome]) {
      if (part == null) continue;
      const s = String(part).trim();
      if (!s || /invalid date/i.test(s)) continue;
      const fromToken = parsePrazoDateToken(s);
      if (fromToken) {
        deadlines.push(fromToken);
        continue;
      }
      const fromText = extractDeadlineDateFromPrazoText(s) || extrairDataMaisRecentePrazo(s);
      if (fromText) deadlines.push(fromText);
    }
  }

  if (deadlines.length === 0) return null;
  return new Date(Math.max(...deadlines.map((d) => d.getTime())));
};

export type EditalDeadlineFields = {
  timeline_estimada?: any;
  prazo_inscricao?: any;
  data_encerramento?: string | null;
  criado_em?: string | null;
  status?: string | null;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseEncerramentoDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const fromToken = parsePrazoDateToken(String(raw).trim());
  if (fromToken) return fromToken;
  const d = new Date(String(raw).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Descarta datas claramente legadas/OCR (ex.: 2008 em edital indexado em 2024). */
export function isPlausibleCatalogDeadline(date: Date, criadoEm?: string | null): boolean {
  if (date.getFullYear() < 2010) return false;
  if (criadoEm) {
    const c = new Date(criadoEm);
    if (!Number.isNaN(c.getTime()) && date.getFullYear() < c.getFullYear() - 2) return false;
  }
  return true;
}

export function collectEditalDeadlineDates(input: EditalDeadlineFields): Date[] {
  const dates: Date[] = [];

  const timeline =
    extrairDeadlineSubmissao(input.timeline_estimada) ??
    extrairDeadlineTimelineAmplo(input.timeline_estimada);
  if (timeline && isPlausibleCatalogDeadline(timeline, input.criado_em)) dates.push(timeline);

  const prazoRaw =
    typeof input.prazo_inscricao === "string"
      ? input.prazo_inscricao
      : input.prazo_inscricao != null
        ? JSON.stringify(input.prazo_inscricao)
        : null;
  if (prazoRaw && prazoRaw !== "Não informado") {
    const prazo =
      extrairDataMaisRecentePrazo(prazoRaw) ||
      extractDeadlineDateFromPrazoText(prazoRaw) ||
      (() => {
        const all = extractAllPrazoDatesFromText(prazoRaw);
        return all.length ? new Date(Math.max(...all.map((d) => d.getTime()))) : null;
      })();
    if (prazo && isPlausibleCatalogDeadline(prazo, input.criado_em)) dates.push(prazo);
  }

  const enc = parseEncerramentoDate(input.data_encerramento);
  if (enc && isPlausibleCatalogDeadline(enc, input.criado_em)) dates.push(enc);

  return dates;
}

/** Prazo efetivo para exibição: prioriza deadlines futuros entre timeline, prazo e encerramento. */
export function getEditalDisplayDeadline(input: EditalDeadlineFields): Date | null {
  const hoje = startOfDay(new Date());
  const dates = collectEditalDeadlineDates(input);
  if (dates.length === 0) return null;

  const future = dates.filter((d) => startOfDay(d).getTime() >= hoje.getTime());
  const pool = future.length > 0 ? future : dates;
  return new Date(Math.max(...pool.map((d) => d.getTime())));
}

/** Edital ativo: janela MM/AAAA (mês atual → dez) + anos +1…+4 (mesma lógica da busca manual). */
export function isEditalAtivoByDeadlines(input: EditalDeadlineFields & {
  titulo?: string | null;
  descricao?: string | null;
  sobre_programa?: string | null;
  numero?: string | null;
}): boolean {
  return isEditalAtivoByDatePatterns(input);
}

export type PrazoInscricaoDisplay = {
  /** Texto principal (compatível com `formatPrazoInscricao`, mas pode priorizar timeline) */
  display: string;
  /** Detalhes (quando `prazo_inscricao` vier com múltiplas chamadas) */
  details?: FormattedPrazo["details"];
  /** Quando a timeline tiver deadline de submissão parseável */
  deadlineSubmissao: Date | null;
  /** Nome da fase usada (quando identificável) */
  faseNome?: string;
  /** Texto bruto da fase (quando existir) */
  fasePrazoTexto?: string;
};

export function getPrazoInscricaoDisplayPreferindoTimeline(
  prazoInscricao: any,
  timeline: any,
  opts?: Pick<EditalDeadlineFields, "data_encerramento" | "criado_em">,
): PrazoInscricaoDisplay {
  const base = formatPrazoInscricao(prazoInscricao);
  const displayDeadline = getEditalDisplayDeadline({
    timeline_estimada: timeline,
    prazo_inscricao: prazoInscricao,
    data_encerramento: opts?.data_encerramento,
    criado_em: opts?.criado_em,
  });

  let faseNome: string | undefined;
  let fasePrazoTexto: string | undefined;
  try {
    let obj: any = timeline;
    if (typeof timeline === "string") {
      try {
        obj = JSON.parse(timeline);
      } catch {
        obj = null;
      }
    }
    const fases = obj?.fases;
    const deadlineSubmissaoTimeline = extrairDeadlineSubmissao(timeline);
    if (deadlineSubmissaoTimeline && Array.isArray(fases)) {
      const isFaseSubmissaoStrict = (fase: any): boolean => {
        const nome = normalizeText(fase?.nome);
        if (nome.includes("submiss")) return true;
        if (nome.includes("envio")) return true;
        return false;
      };
      const isFaseInscricao = (fase: any): boolean => {
        const nome = normalizeText(fase?.nome);
        return nome.includes("inscri");
      };

      const candidatos =
        fases.filter(isFaseSubmissaoStrict).length > 0
          ? fases.filter(isFaseSubmissaoStrict)
          : fases.filter(isFaseInscricao);

      const scoreFase = (fase: any): number => {
        const parts = [fase?.data_fim, fase?.prazo, fase?.fim, fase?.nome, fase?.data_inicio].filter(Boolean).map(String);
        let best = -Infinity;
        for (const p of parts) {
          const d = extrairDataMaisRecentePrazo(p);
          if (d && !isNaN(d.getTime())) {
            best = Math.max(best, d.getTime());
          }
        }
        return best;
      };

      let bestFase: any | null = null;
      let bestScore = -Infinity;
      for (const fase of candidatos) {
        const s = scoreFase(fase);
        if (s > bestScore) {
          bestScore = s;
          bestFase = fase;
        }
      }

      if (bestFase && bestScore === deadlineSubmissaoTimeline.getTime()) {
        faseNome = String(bestFase?.nome || "").trim() || undefined;
        fasePrazoTexto = String(bestFase?.prazo || bestFase?.fim || "").trim() || undefined;
      }
    }
  } catch {
    // ignore
  }

  if (displayDeadline && !Number.isNaN(displayDeadline.getTime())) {
    const hoje = startOfDay(new Date());
    const encerrado = startOfDay(displayDeadline).getTime() < hoje.getTime();
    return {
      display: encerrado
        ? `Encerrado (${formatDatePtBR(displayDeadline)})`
        : `Até ${formatDatePtBR(displayDeadline)}`,
      details: base.details,
      deadlineSubmissao: encerrado ? null : displayDeadline,
      faseNome,
      fasePrazoTexto,
    };
  }

  const fallbackDate =
    parseDateFromAtéDisplay(base.display) ||
    (prazoInscricao != null && String(prazoInscricao).trim() && String(prazoInscricao) !== "Não informado"
      ? extractDeadlineDateFromPrazoText(String(prazoInscricao))
      : null);
  if (fallbackDate && isPlausibleCatalogDeadline(fallbackDate, opts?.criado_em)) {
    const hoje = startOfDay(new Date());
    const encerrado = startOfDay(fallbackDate).getTime() < hoje.getTime();
    return {
      display: encerrado
        ? `Encerrado (${formatDatePtBR(fallbackDate)})`
        : `Até ${formatDatePtBR(fallbackDate)}`,
      details: base.details,
      deadlineSubmissao: encerrado ? null : fallbackDate,
      faseNome,
      fasePrazoTexto,
    };
  }

  return {
    display: base.display,
    details: base.details,
    deadlineSubmissao: null,
  };
}

/** Só exibe linha de referência quando `prazo_inscricao` tem valor útil e difere do prazo principal. */
export function shouldShowPrazoInscricaoReferencia(
  prazoInscricao: unknown,
  prazoResumoDisplay: string,
): boolean {
  const normalized = normalizePrazoInscricaoPlainText(String(prazoInscricao ?? ""));
  if (normalized.display === "Não informado") return false;

  const refDate = extractDeadlineDateFromPrazoText(String(prazoInscricao ?? ""));
  const mainDate = parseDateFromAtéDisplay(prazoResumoDisplay);
  if (refDate && mainDate && sameCalendarDay(refDate, mainDate)) return false;

  return normalized.display !== prazoResumoDisplay;
}
