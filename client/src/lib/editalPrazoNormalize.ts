/**
 * Normaliza textos livres de `prazo_inscricao` em datas legíveis (incl. DD/MM/YY).
 */

const MONTH_MAP: Record<string, number> = {
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

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function expandTwoDigitYear(yy: number, referenceYear = new Date().getFullYear()): number {
  if (!Number.isFinite(yy) || yy >= 100) return yy;
  let year = yy <= 69 ? 2000 + yy : 1900 + yy;
  // Evita interpretar "15/05/08" como 2008 em edital indexado anos depois (texto legado/OCR).
  if (year < referenceYear - 5 && yy <= 30) {
    const alt = 2000 + yy;
    if (alt >= referenceYear - 1) year = alt;
  }
  return year;
}

function parsePtMonthDate(dayStr: string, monthStr: string, yearStr: string): Date | null {
  const day = Number(dayStr);
  let year = Number(yearStr);
  if (yearStr.length === 2) year = expandTwoDigitYear(year);
  const month = MONTH_MAP[normalizeText(monthStr)];
  if (!month || !day || !year) return null;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parsePrazoDateToken(raw: unknown): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\.$/, "");
  if (!s || /invalid date/i.test(s)) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const br4 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (br4) {
    const d = new Date(Number(br4[3]), Number(br4[2]) - 1, Number(br4[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const br2 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (br2) {
    const year = expandTwoDigitYear(Number(br2[3]));
    const d = new Date(year, Number(br2[2]) - 1, Number(br2[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const ptLong = s.match(/^(\d{1,2})\s+de\s+([A-Za-zÀ-ÿçÇ]+)\s+de\s+(\d{2,4})$/i);
  if (ptLong) return parsePtMonthDate(ptLong[1], ptLong[2], ptLong[3]);

  const ptShort = s.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿçÇ]+)\s+(\d{2,4})$/i);
  if (ptShort) return parsePtMonthDate(ptShort[1], ptShort[2], ptShort[3]);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DATE_TOKEN =
  /\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2}\b/g;

/** Prioriza datas após "até (o dia)" / "fim" em frases longas. */
export function extractDeadlineDateFromPrazoText(text: string): Date | null {
  const s = String(text || "").trim();
  if (!s) return null;

  const norm = normalizeText(s);
  const atePatterns = [
    /\bate\b(?:\s+o\s+dia)?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /\bate\b(?:\s+o\s+dia)?\s*(\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{2,4})/i,
    /\bfim\b\s*:?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
  ];

  for (const re of atePatterns) {
    const m = norm.match(re) || s.match(re);
    if (m?.[1]) {
      const d = parsePrazoDateToken(m[1]);
      if (d) return d;
    }
  }

  const dates: Date[] = [];
  for (const token of s.match(DATE_TOKEN) || []) {
    const d = parsePrazoDateToken(token);
    if (d) dates.push(d);
  }

  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

export function formatPrazoDateLabel(date: Date, preferShortYear = false): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  if (preferShortYear) {
    return `${dd}/${mm}/${String(date.getFullYear()).slice(-2)}`;
  }
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export function normalizePrazoInscricaoPlainText(text: string): {
  display: string;
  original?: string;
} {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw || raw.toLowerCase() === "não informado") {
    return { display: "Não informado" };
  }

  const ateOnly = raw.match(/^at[eé]\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})$/i);
  if (ateOnly?.[1]) {
    const d = parsePrazoDateToken(ateOnly[1]);
    if (d) {
      const short = /\d{2}$/.test(ateOnly[1]) && !/\d{4}$/.test(ateOnly[1]);
      return { display: `Até ${formatPrazoDateLabel(d, short)}` };
    }
  }

  const deadline = extractDeadlineDateFromPrazoText(raw);
  if (deadline) {
    const short = /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2}\b/.test(raw);
    return {
      display: `Até ${formatPrazoDateLabel(deadline, short)}`,
      original: raw.length > 40 ? raw : undefined,
    };
  }

  return { display: raw };
}

export function extractAllPrazoDatesFromText(text: string): Date[] {
  const s = String(text || "");
  const dates: Date[] = [];
  for (const token of s.match(DATE_TOKEN) || []) {
    const d = parsePrazoDateToken(token);
    if (d) dates.push(d);
  }
  return dates;
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function parseDateFromAtéDisplay(display: string): Date | null {
  const m = String(display || "").match(/at[eé]\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (!m?.[1]) return null;
  return parsePrazoDateToken(m[1]);
}
