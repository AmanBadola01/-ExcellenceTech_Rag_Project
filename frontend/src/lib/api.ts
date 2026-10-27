const BASE = ((import.meta as any).env?.VITE_API_URL ?? "http://127.0.0.1:8000").replace(
  /\/+$/,
  "",
);

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
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Please try again.";
}

async function request(
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
) {
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

// Company profile shape (mirrors backend CompanyPayload)
export type CompanyData = {
  name: string;
  website: string;
  industry: string;
  tagline: string;
  description: string;
  products_services: string;
  target_market: string;
  value_props: string;
  boilerplate: string;
  contact_info: string;
  default_language: string;
};

// Project shape
export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  piece_count: number;
  created_at?: string;
  updated_at?: string;
};

// Content piece shape
export type ContentPiece = {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  content_type: string;
  status: string;
  content: string;
  metadata: string;
  created_at?: string;
  updated_at?: string;
};

export type GenerateContentPayload = {
  title: string;
  prompt: string;
  content_type: string;
  tone: string;
  voice_id?: string | null;
  project_id?: string | null;
  include_company_context?: boolean;
};

// Brand voice persona
export type BrandVoice = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  tone_tags: string;
  rules: string;
  sample_quote: string;
  created_at?: string;
  updated_at?: string;
};

export const api = {
  // ── Health ────────────────────────────────────────────────────────────────
  health: () => request("/health"),

  // ── Auth (/api/auth/*) ────────────────────────────────────────────────────
  signup: (email: string, password: string) =>
    request("/api/auth/signup", { method: "POST", body: { email, password } }),

  login: (email: string, password: string, turnstile_token?: string | null) =>
    request("/api/auth/login", {
      method: "POST",
      body: { email, password, ...(turnstile_token ? { turnstile_token } : {}) },
    }),

  me: () => request("/api/auth/me"),

  // ── RAG Q&A (/api/rag/*) ─────────────────────────────────────────────────
  listChats: () => request("/api/rag/chats"),
  createChat: () => request("/api/rag/chats", { method: "POST", body: {} }),
  getChat: (chatId: string) => request(`/api/rag/chats/${encodeURIComponent(chatId)}`),
  ask: (chatId: string, question: string) =>
    request(`/api/rag/chats/${encodeURIComponent(chatId)}/ask`, {
      method: "POST",
      body: { question },
    }),

  // ── Content Studio (/api/content/*) ──────────────────────────────────────
  getCompany: (): Promise<CompanyData> => request("/api/content/company"),
  saveCompany: (data: CompanyData): Promise<CompanyData> =>
    request("/api/content/company", { method: "PUT", body: data }),

  listProjects: (): Promise<Project[]> => request("/api/content/projects"),
  createProject: (data: { name: string; description?: string }): Promise<Project> =>
    request("/api/content/projects", { method: "POST", body: data }),
  getProject: (id: string): Promise<Project> =>
    request(`/api/content/projects/${encodeURIComponent(id)}`),
  deleteProject: (id: string): Promise<void> =>
    request(`/api/content/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getProjectPieces: (projectId: string): Promise<ContentPiece[]> =>
    request(`/api/content/projects/${encodeURIComponent(projectId)}/pieces`),
  listAllPieces: (limit = 20): Promise<ContentPiece[]> =>
    request(`/api/content/pieces?limit=${limit}`),
  getPiece: (id: string): Promise<ContentPiece> =>
    request(`/api/content/pieces/${encodeURIComponent(id)}`),
  updatePiece: (
    id: string,
    data: { title?: string; content?: string; status?: string }
  ): Promise<ContentPiece> =>
    request(`/api/content/pieces/${encodeURIComponent(id)}`, { method: "PUT", body: data }),
  deletePiece: (id: string): Promise<void> =>
    request(`/api/content/pieces/${encodeURIComponent(id)}`, { method: "DELETE" }),
  generateContent: (data: GenerateContentPayload): Promise<ContentPiece> =>
    request("/api/content/generate", { method: "POST", body: data }),
  repurposePiece: (
    id: string,
    data: { target_format: string; instructions?: string; save_as_new_piece?: boolean }
  ): Promise<ContentPiece | { original_id: string; target_format: string; repurposed_content: string }> =>
    request(`/api/content/pieces/${encodeURIComponent(id)}/repurpose`, { method: "POST", body: data }),

  // ── Brand Voices ─────────────────────────────────────────────────────────
  listBrandVoices: (): Promise<BrandVoice[]> => request("/api/content/brand-voices"),
  createBrandVoice: (data: {
    name: string;
    description?: string;
    tone_tags?: string;
    rules?: string;
    sample_quote?: string;
  }): Promise<BrandVoice> => request("/api/content/brand-voices", { method: "POST", body: data }),
  updateBrandVoice: (
    id: string,
    data: {
      name?: string;
      description?: string;
      tone_tags?: string;
      rules?: string;
      sample_quote?: string;
    }
  ): Promise<BrandVoice> =>
    request(`/api/content/brand-voices/${encodeURIComponent(id)}`, { method: "PUT", body: data }),
  deleteBrandVoice: (id: string): Promise<void> =>
    request(`/api/content/brand-voices/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
