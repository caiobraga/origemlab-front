export type MarkdownFormat =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "heading"
  | "bullet"
  | "numbered"
  | "checklist"
  | "quote"
  | "link"
  | "table"
  | "divider";

export interface MarkdownEditResult {
  text: string;
  start: number;
  end: number;
}

const INLINE_FORMATS: Partial<Record<MarkdownFormat, { marker: string; placeholder: string }>> = {
  bold: { marker: "**", placeholder: "texto em negrito" },
  italic: { marker: "_", placeholder: "texto em itálico" },
  strike: { marker: "~~", placeholder: "texto tachado" },
  code: { marker: "`", placeholder: "código" },
};

const LINE_FORMATS: Partial<Record<MarkdownFormat, { prefix: (n: number) => string; pattern: RegExp }>> = {
  heading: { prefix: () => "## ", pattern: /^#{1,6} / },
  bullet: { prefix: () => "- ", pattern: /^- (?!\[[ xX]\] )/ },
  numbered: { prefix: (n) => `${n}. `, pattern: /^\d+\. / },
  checklist: { prefix: () => "- [ ] ", pattern: /^- \[[ xX]\] / },
  quote: { prefix: () => "> ", pattern: /^> / },
};

const ANY_LINE_PREFIX = /^(#{1,6} |- \[[ xX]\] |- |\d+\. |> )/;

const TABLE_BLOCK = "| Coluna 1 | Coluna 2 | Coluna 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |";

function wrapInline(text: string, start: number, end: number, marker: string, placeholder: string): MarkdownEditResult {
  const m = marker.length;
  const selected = text.slice(start, end);

  if (start >= m && text.slice(start - m, start) === marker && text.slice(end, end + m) === marker) {
    return {
      text: text.slice(0, start - m) + selected + text.slice(end + m),
      start: start - m,
      end: end - m,
    };
  }

  if (selected.length > 2 * m && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(m, -m);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      start,
      end: start + inner.length,
    };
  }

  const body = selected || placeholder;
  return {
    text: text.slice(0, start) + marker + body + marker + text.slice(end),
    start: start + m,
    end: start + m + body.length,
  };
}

function lineBounds(text: string, start: number, end: number) {
  const lineStart = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", end);
  const lineEnd = nl === -1 ? text.length : nl;
  return { lineStart, lineEnd };
}

function toggleLinePrefix(text: string, start: number, end: number, format: MarkdownFormat): MarkdownEditResult {
  const { prefix, pattern } = LINE_FORMATS[format]!;
  const { lineStart, lineEnd } = lineBounds(text, start, end);
  const lines = text.slice(lineStart, lineEnd).split("\n");
  const filled = lines.filter((line) => line.trim());
  const allApplied = filled.length > 0 && filled.every((line) => pattern.test(line));

  let n = 0;
  const next = lines.map((line) => {
    if (!line.trim()) return line;
    if (allApplied) return line.replace(pattern, "");
    n += 1;
    return prefix(n) + line.replace(ANY_LINE_PREFIX, "");
  });

  const block = next.join("\n");
  return {
    text: text.slice(0, lineStart) + block + text.slice(lineEnd),
    start: lineStart,
    end: lineStart + block.length,
  };
}

function insertBlock(text: string, start: number, end: number, block: string, selectFrom: number, selectTo: number): MarkdownEditResult {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const tail = after.startsWith("\n\n") || after === "" ? "" : "\n";
  const insertAt = before.length + lead.length;
  return {
    text: before + lead + block + tail + after,
    start: insertAt + selectFrom,
    end: insertAt + selectTo,
  };
}

export function formatMarkdown(text: string, start: number, end: number, format: MarkdownFormat): MarkdownEditResult {
  const inline = INLINE_FORMATS[format];
  if (inline) {
    if (format === "code" && text.slice(start, end).includes("\n")) {
      const selected = text.slice(start, end);
      const block = "```\n" + selected + "\n```";
      return insertBlock(text, start, end, block, 4, 4 + selected.length);
    }
    return wrapInline(text, start, end, inline.marker, inline.placeholder);
  }

  if (LINE_FORMATS[format]) {
    return toggleLinePrefix(text, start, end, format);
  }

  if (format === "link") {
    const body = text.slice(start, end) || "texto do link";
    const link = `[${body}](https://)`;
    const urlStart = start + body.length + 3;
    return {
      text: text.slice(0, start) + link + text.slice(end),
      start: urlStart,
      end: urlStart + "https://".length,
    };
  }

  if (format === "table") {
    return insertBlock(text, start, end, TABLE_BLOCK, 2, 10);
  }

  return insertBlock(text, start, end, "---", 0, 3);
}
