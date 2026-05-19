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

function isProbablyOllamaEndpoint(url: string) {
  return /(^|\.)11434(\/|$)/.test(url) || /:11434(\/|$)/.test(url);
}

function normalizeOllamaChatUrl(endpoint: string) {
  const base = endpoint.replace(/\/$/, "");
  if (base.endsWith("/api/chat")) return base;
  if (base.includes("/api/")) return base; // assume caller passed full endpoint
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

  // Keep it simple: backend RAG/context is not available from the browser.
  // We still pass useful metadata so the model can respond with proper assumptions.
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
          ...history.slice(-12).map((m) => `- ${m.role}: ${m.content}`),
          "",
        ].join("\n")
      : "",
    `Pergunta do usuário: ${requestBody.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Fetches PDF file IDs for a specific edital
 */
export async function fetchEditalPdfIds(editalId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("edital_pdfs")
      .select("file_id, id")
      .eq("edital_id", editalId)
      .not("file_id", "is", null); // Apenas PDFs que têm file_id

    if (error) {
      console.error("Erro ao buscar PDFs do edital:", error);
      throw error;
    }

    // Retornar file_id se disponível, caso contrário usar id como fallback
    return data?.map((pdf) => pdf.file_id || pdf.id).filter((id): id is string => id !== null) || [];
  } catch (error) {
    console.error("Erro ao buscar PDFs do edital:", error);
    return [];
  }
}

/**
 * Gets user context data for the chat
 */
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

/**
 * Sends a message to the webhook with user context and PDF IDs
 */
export async function sendChatMessage(
  message: string,
  editalId: string,
  user: any,
  profile: any,
  chatHistory: ChatMessage[]
): Promise<string> {
  try {
    // Fetch PDF IDs
    const pdfIds = await fetchEditalPdfIds(editalId);

    // Get user context
    const userContext = getUserContext(user, profile);

    // Prepare request body
    const requestBody = {
      message,
      userContext,
      file_ids: pdfIds,
      chatHistory: chatHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      })),
    };

    const endpoint = String(CHAT_ENDPOINT || "").trim();
    if (!endpoint) throw new Error("Chat endpoint não configurado.");

    const useOllama = isProbablyOllamaEndpoint(endpoint);
    const url = useOllama ? normalizeOllamaChatUrl(endpoint) : endpoint;

    // Log for debugging
    console.log("Enviando POST para:", url);
    console.log("Request body:", requestBody);

    const body = useOllama
      ? {
          model: import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:7b",
          stream: false,
          messages: [
            {
              role: "user",
              content: buildOllamaPrompt(requestBody),
            },
          ],
        }
      : requestBody;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP error! status: ${response.status}${errorText ? ` - ${errorText}` : ""}`);
    }

    // Get response text
    const responseText = await response.text();
    console.log("Resposta do webhook (raw):", responseText);
    console.log("Content-Type:", response.headers.get("content-type"));

    // If response is empty, return default message
    if (!responseText || responseText.trim() === "") {
      console.warn("Resposta vazia do webhook");
      return "Resposta recebida do assistente";
    }

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");

    // If not JSON, return as text
    if (!isJson) {
      console.log("Resposta não é JSON, retornando como texto");
      return responseText;
    }

    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log("Resposta parseada (JSON):", data);
    } catch (parseError) {
      console.error("Erro ao fazer parse da resposta JSON:", parseError);
      // If JSON parse fails but we have text, return the text
      return responseText;
    }

    // Ollama format: { message: { role, content }, ... }
    if (useOllama && data && typeof data === "object") {
      const msg = (data as any).message;
      const content = msg?.content;
      if (typeof content === "string" && content.trim()) return content;
    }
    
    // Try multiple possible response formats
    // n8n webhook might return: { output: "..." }, { result: "..." }, { data: "..." }, etc.
    if (typeof data === "string") {
      return data;
    }
    
    if (Array.isArray(data) && data.length > 0) {
      // If response is an array, get the first item
      const firstItem = data[0];
      if (typeof firstItem === "string") {
        return firstItem;
      }
      // Try to extract from first item - prioritize "output" for n8n webhooks
      if (firstItem.output !== undefined && firstItem.output !== null) {
        return String(firstItem.output);
      }
      return firstItem.result || firstItem.message || firstItem.text || firstItem.content || JSON.stringify(firstItem);
    }
    
    // Try common response property names
    const possibleKeys = [
      "output",
      "result", 
      "response",
      "message",
      "text",
      "content",
      "data",
      "answer",
      "reply"
    ];
    
    for (const key of possibleKeys) {
      if (data[key] !== undefined && data[key] !== null) {
        const value = data[key];
        if (typeof value === "string") {
          return value;
        }
        // If it's an object, try to stringify or get nested value
        if (typeof value === "object") {
          return value.text || value.message || value.content || JSON.stringify(value);
        }
      }
    }
    
    // If we have data but couldn't find a string value, return stringified version
    console.warn("Não foi possível encontrar output na resposta:", data);
    return JSON.stringify(data);
  } catch (error: any) {
    console.error("Erro completo na função sendChatMessage:", error);
    console.error("Tipo do erro:", error?.constructor?.name);
    console.error("Mensagem do erro:", error?.message);
    console.error("Stack do erro:", error?.stack);
    
    // Check if it's a CORS error
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes("CORS") || errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError")) {
      throw new Error("Erro de conexão: O servidor não está permitindo requisições do navegador. Verifique as configurações de CORS no servidor.");
    }
    
    // Re-throw with more context if needed
    if (error instanceof Error) {
      throw error;
    }
    
    // If it's not an Error object, wrap it
    throw new Error(errorMsg || "Erro desconhecido ao enviar mensagem");
  }
}

/**
 * Saves chat history to localStorage
 */
export function saveChatHistory(editalId: string, messages: ChatMessage[]) {
  try {
    const key = `chat_history_${editalId}`;
    const serialized = JSON.stringify(
      messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      }))
    );
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.error("Erro ao salvar histórico do chat:", error);
  }
}

/**
 * Loads chat history from localStorage
 */
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

