import { apiFetch } from "./backendApi";
import { supabase } from "./supabase";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const CHAT_ENDPOINT =
  import.meta.env.VITE_CHAT_ENDPOINT ||
  "https://n8n.srv652789.hstgr.cloud/webhook/basic";

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const USE_WEBHOOK = import.meta.env.VITE_CHAT_USE_WEBHOOK === "true";
const CHAT_TIMEOUT_MS = 130_000;
const MAX_HISTORY = 10;

function useBackendChat() {
  return Boolean(API_BASE) && !USE_WEBHOOK;
}

function isProbablyOllamaEndpoint(url: string) {
  return /(^|\.)11434(\/|$)/.test(url) || /:11434(\/|$)/.test(url);
}

function normalizeOllamaChatUrl(endpoint: string) {
  const base = endpoint.replace(/\/$/, "");
  if (base.endsWith("/api/chat")) return base;
  if (base.includes("/api/")) return base;
  return `${base}/api/chat`;
}

function buildOllamaPrompt(requestBody: {
  message: string;
  userContext: any;
  file_ids: string[];
  chatHistory: Array<{ role: string; content: string; timestamp: string }>;
}) {
  const ctx = requestBody.userContext || {};
  const pdfs = Array.isArray(requestBody.file_ids) ? requestBody.file_ids : [];
  const history = Array.isArray(requestBody.chatHistory) ? requestBody.chatHistory : [];

  return [
    "Você é um assistente do Origem.Lab. Ajude o usuário com dúvidas sobre o edital e a proposta.",
    "",
    "Contexto do usuário (pode estar incompleto):",
    `- userId: ${ctx.userId ?? "null"}`,
    `- email: ${ctx.email ?? "null"}`,
    `- userType: ${ctx.userType ?? "null"}`,
    `- cpf: ${ctx.cpf ? "informado" : "null"}`,
    `- cnpj: ${ctx.cnpj ? "informado" : "null"}`,
    `- lattesId: ${ctx.lattesId ?? "null"}`,
    "",
    `PDFs relacionados (ids): ${pdfs.length ? pdfs.join(", ") : "nenhum"}`,
    "",
    history.length
      ? [
          "Histórico recente:",
          ...history.slice(-MAX_HISTORY).map((m) => `- ${m.role}: ${m.content}`),
          "",
        ].join("\n")
      : "",
    `Pergunta do usuário: ${requestBody.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendViaBackend(
  message: string,
  editalId: string,
  chatHistory: ChatMessage[],
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    const out = await apiFetch<{ reply: string }>("/api/edital-chat", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({
        edital_id: editalId,
        message,
        chatHistory: chatHistory.slice(-MAX_HISTORY).map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      }),
    });
    const reply = String(out?.reply || "").trim();
    return reply || "Não foi possível gerar uma resposta.";
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "AbortError") {
      throw new Error("A resposta demorou demais. Tente uma pergunta mais curta.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches PDF file IDs for a specific edital (legacy webhook flow).
 */
export async function fetchEditalPdfIds(editalId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("edital_pdfs")
      .select("file_id, id")
      .eq("edital_id", editalId)
      .not("file_id", "is", null);

    if (error) {
      console.error("Erro ao buscar PDFs do edital:", error);
      throw error;
    }

    return data?.map((pdf) => pdf.file_id || pdf.id).filter((id): id is string => id !== null) || [];
  } catch (error) {
    console.error("Erro ao buscar PDFs do edital:", error);
    return [];
  }
}

export function getUserContext(user: any, profile: any) {
  return {
    userId: user?.id || null,
    email: user?.email || null,
    cpf: profile?.cpf || null,
    cnpj: profile?.cnpj || null,
    lattesId: profile?.lattesId || null,
    userType: profile?.userType || null,
  };
}

function parseWebhookResponse(responseText: string, contentType: string | null, useOllama: boolean) {
  if (!responseText || responseText.trim() === "") {
    return "Resposta recebida do assistente";
  }

  const isJson = contentType && contentType.includes("application/json");
  if (!isJson) return responseText;

  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    return responseText;
  }

  if (useOllama && data && typeof data === "object") {
    const msg = (data as any).message;
    const content = msg?.content;
    if (typeof content === "string" && content.trim()) return content;
  }

  if (typeof data === "string") return data;

  if (Array.isArray(data) && data.length > 0) {
    const firstItem = data[0];
    if (typeof firstItem === "string") return firstItem;
    if (firstItem.output !== undefined && firstItem.output !== null) {
      return String(firstItem.output);
    }
    return firstItem.result || firstItem.message || firstItem.text || firstItem.content || JSON.stringify(firstItem);
  }

  const possibleKeys = ["output", "result", "response", "message", "text", "content", "data", "answer", "reply"];
  for (const key of possibleKeys) {
    if (data && typeof data === "object" && (data as any)[key] != null) {
      const value = (data as any)[key];
      if (typeof value === "string") return value;
      if (typeof value === "object") {
        return value.text || value.message || value.content || JSON.stringify(value);
      }
    }
  }

  return JSON.stringify(data);
}

async function sendViaWebhook(
  message: string,
  editalId: string,
  user: any,
  profile: any,
  chatHistory: ChatMessage[],
): Promise<string> {
  const pdfIds = await fetchEditalPdfIds(editalId);
  const userContext = getUserContext(user, profile);

  const requestBody = {
    message,
    userContext,
    file_ids: pdfIds,
    chatHistory: chatHistory.slice(-MAX_HISTORY).map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    })),
  };

  const endpoint = String(CHAT_ENDPOINT || "").trim();
  if (!endpoint) throw new Error("Chat endpoint não configurado.");

  const useOllama = isProbablyOllamaEndpoint(endpoint);
  const url = useOllama ? normalizeOllamaChatUrl(endpoint) : endpoint;

  const body = useOllama
    ? {
        model: import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:7b",
        stream: false,
        messages: [{ role: "user", content: buildOllamaPrompt(requestBody) }],
      }
    : requestBody;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP error! status: ${response.status}${errorText ? ` - ${errorText}` : ""}`);
    }

    const responseText = await response.text();
    return parseWebhookResponse(responseText, response.headers.get("content-type"), useOllama);
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "AbortError") {
      throw new Error("A resposta demorou demais. Tente uma pergunta mais curta.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendChatMessage(
  message: string,
  editalId: string,
  user: any,
  profile: any,
  chatHistory: ChatMessage[],
): Promise<string> {
  try {
    if (useBackendChat()) {
      return await sendViaBackend(message, editalId, chatHistory);
    }
    return await sendViaWebhook(message, editalId, user, profile, chatHistory);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes("CORS") || errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError")) {
      throw new Error(
        "Erro de conexão: verifique se o backend está acessível e se VITE_API_BASE_URL está correto.",
      );
    }
    if (error instanceof Error) throw error;
    throw new Error(errorMsg || "Erro desconhecido ao enviar mensagem");
  }
}

export function saveChatHistory(editalId: string, messages: ChatMessage[]) {
  try {
    const key = `chat_history_${editalId}`;
    const serialized = JSON.stringify(
      messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      })),
    );
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.error("Erro ao salvar histórico do chat:", error);
  }
}

export function loadChatHistory(editalId: string): ChatMessage[] {
  try {
    const key = `chat_history_${editalId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return parsed.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error("Erro ao carregar histórico do chat:", error);
    return [];
  }
}
