import { createContext, useContext, useState, type ReactNode } from "react";

import { api, clearAuth, getEmail, getToken, saveAuth } from "@/lib/api";

type AuthContextValue = {
  token: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function authenticate(
  kind: "login" | "signup",
  email: string,
  password: string,
  onDone: (token: string, email: string) => void,
) {
  const result: any = kind === "login" ? await api.login(email, password) : await api.signup(email, password);
  const token = result.access_token;
  if (!token) throw new Error("The server did not return an access token.");
  const resolvedEmail = result.email ?? email;
  saveAuth(token, resolvedEmail);
  onDone(token, resolvedEmail);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [email, setEmail] = useState<string | null>(() => getEmail());

  const value: AuthContextValue = {
    token,
    email,
    login: (emailValue, password) => authenticate("login", emailValue, password, (t, e) => { setToken(t); setEmail(e); }),
    signup: (emailValue, password) => authenticate("signup", emailValue, password, (t, e) => { setToken(t); setEmail(e); }),
    logout: () => {
      clearAuth();
      setToken(null);
      setEmail(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
