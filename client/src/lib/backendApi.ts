function apiUrl(path: string) {
  const base = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  const normalized = base ? String(base).replace(/\/$/, "") : "";
  return normalized ? `${normalized}${path}` : path;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (json && typeof json.error === "string" && json.error) ? json.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

