import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMAIL_KEY, TOKEN_KEY, api, clearAuth, saveAuth } from "@/lib/api";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("api module auth behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        if (!headers["Authorization"]) return jsonResponse(401, { detail: "Not authenticated" });
        return jsonResponse(200, [{ id: "c1", title: "Hello" }]);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAuth();
  });

  it("attaches the Authorization header from the stored token", async () => {
    saveAuth("tok-123", "user@example.com");
    await api.listChats();
    const init = (fetch as any).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-123");
  });

  it("logs out on a 401 response by clearing the stored token and email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(401, { detail: "Token expired" })),
    );
    saveAuth("expired-token", "user@example.com");
    await expect(api.listChats()).rejects.toThrow();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(EMAIL_KEY)).toBeNull();
  });

  it("surfaces the API detail message on a 400 error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(400, { detail: "Email already registered" })),
    );
    await expect(api.signup("user@example.com", "pw")).rejects.toThrow("Email already registered");
  });
});
