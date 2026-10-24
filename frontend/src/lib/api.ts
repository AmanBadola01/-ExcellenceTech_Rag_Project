const BASE = ((import.meta as any).env?.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

export const TOKEN_KEY = "exqa_token";
export const EMAIL_KEY = "exqa_email";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getEmail() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMAIL_KEY);
}

export function saveAuth(token: string, email: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export class ApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.";
}

async function request(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}) {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : null,
    });
  } catch {
    throw new ApiError("Could not reach the server. Check that it is running and try again.");
  }

  if (res.status === 401 && token) {
    clearAuth();
    if (typeof window !== "undefined") window.location.assign("/login");
    throw new ApiError("Your session expired. Please sign in again.", 401);
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status}).`;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") detail = data.detail;
    } catch {
      // keep the generic message
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/health"),
  signup: (email: string, password: string) => request("/auth/signup", { method: "POST", body: { email, password } }),
  login: (email: string, password: string) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/auth/me"),
  listChats: () => request("/chats"),
  createChat: () => request("/chats", { method: "POST", body: {} }),
  getChat: (chatId: string) => request(`/chats/${encodeURIComponent(chatId)}`),
  ask: (chatId: string, question: string) =>
    request(`/chats/${encodeURIComponent(chatId)}/ask`, { method: "POST", body: { question } }),
};
