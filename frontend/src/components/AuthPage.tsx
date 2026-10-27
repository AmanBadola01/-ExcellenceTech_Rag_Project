import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { TurnstileWidget, type TurnstileRef } from "@/components/TurnstileWidget";
import { cn } from "@/lib/utils";

const inputClasses =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-150 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/40";

export function AuthPage() {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cloudflare Turnstile token & ref (login only)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileRef>(null);
  const siteKey = ((import.meta as any).env?.VITE_TURNSTILE_SITE_KEY as string | undefined) || "";

  // Password validation rules for sign up
  const passwordRequirements = [
    { id: "length", label: "At least 8 characters", valid: password.length >= 8 },
    { id: "upper", label: "One uppercase letter (A-Z)", valid: /[A-Z]/.test(password) },
    { id: "lower", label: "One lowercase letter (a-z)", valid: /[a-z]/.test(password) },
    { id: "number", label: "One number (0-9)", valid: /\d/.test(password) },
    {
      id: "special",
      label: "One special character (!@#$%...)",
      valid: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const passedCount = passwordRequirements.filter((r) => r.valid).length;
  const isPasswordValid = passedCount === passwordRequirements.length;

  const strength =
    passedCount <= 2 ? { label: "Weak", color: "bg-destructive text-destructive" }
      : passedCount <= 4
        ? { label: "Fair", color: "bg-amber-500 text-amber-500" }
    : { label: "Strong", color: "bg-emerald-500 text-emerald-500" };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (mode === "signup") {
      if (!isPasswordValid) {
        setError("Please fulfill all password requirements.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") await login(email.trim(), password, turnstileToken);
      else await signup(email.trim(), password);
      navigate({ to: "/", replace: true });
    } catch (err) {
      setError(errorMessage(err));
      if (mode === "login") {
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 font-serif text-2xl text-foreground">Excellence Q&A RAG</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to ask questions about your document.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            role="tablist"
            aria-label="Authentication mode"
          >
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setTurnstileToken(null);
                  turnstileRef.current?.reset();
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  mode === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "login" ? "Login" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-email" className="text-xs font-medium text-foreground">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={inputClasses}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-password" className="text-xs font-medium text-foreground">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClasses}
              />
            </div>

            {/* Password Validation & Strength Meter for Sign up */}
            {mode === "signup" && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                {/* Strength Meter Bar */}
                {password.length > 0 && (
                  <div className="mb-2.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-muted-foreground">Strength:</span>
                      <span className={cn("font-medium", strength.color.split(" ")[1])}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-muted">
                      {[1, 2, 3, 4, 5].map((step) => (
                        <div
                          key={step}
                          className={cn(
                            "flex-1 transition-all duration-300",
                            passedCount >= step ? strength.color.split(" ")[0] : "bg-muted-foreground/20",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Requirements Checklist */}
                <p className="mb-1.5 font-medium text-foreground">Password must contain:</p>
                <ul className="flex flex-col gap-1">
                  {passwordRequirements.map((req) => (
                    <li
                      key={req.id}
                      className={cn(
                        "flex items-center gap-2 transition-colors duration-200",
                        req.valid ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground",
                      )}
                    >
                      {req.valid ? (
                        <svg
                          className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/40" />
                      )}
                      <span>{req.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mode === "signup" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-confirm" className="text-xs font-medium text-foreground">
                  Confirm password
                </label>
                <input
                  id="auth-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={inputClasses}
                />
              </div>
            )}


            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {loading ? (mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
