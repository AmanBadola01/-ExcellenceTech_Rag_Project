import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type TurnstileRef = {
  reset: () => void;
};

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (err?: unknown) => void;
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (error?: unknown) => void;
          theme?: "auto" | "light" | "dark";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export const TurnstileWidget = forwardRef<TurnstileRef, TurnstileWidgetProps>(
  ({ siteKey, onVerify, onExpire, onError, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (typeof window !== "undefined" && window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (e) {
            console.error("Turnstile reset failed:", e);
          }
        }
      },
    }));

    useEffect(() => {
      if (typeof window === "undefined") return;

      let isMounted = true;

      const renderWidget = () => {
        if (!containerRef.current || !isMounted || !window.turnstile) return;

        // Clean up previous widget instance if present
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }

        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              if (isMounted) onVerify(token);
            },
            "expired-callback": () => {
              if (isMounted && onExpire) onExpire();
            },
            "error-callback": (err: unknown) => {
              if (isMounted && onError) onError(err);
            },
            theme: "auto",
            size: "normal",
          });
          widgetIdRef.current = id;
        } catch (err) {
          console.error("Turnstile render error:", err);
        }
      };

      const scriptId = "cf-turnstile-script";
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;

      if (window.turnstile) {
        renderWidget();
      } else if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (isMounted) renderWidget();
        };
        document.head.appendChild(script);
      } else {
        const handleLoad = () => {
          if (isMounted) renderWidget();
        };
        script.addEventListener("load", handleLoad);
        return () => {
          script?.removeEventListener("load", handleLoad);
        };
      }

      return () => {
        isMounted = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }
      };
    }, [siteKey]);

    return (
      <div className={className}>
        <div ref={containerRef} className="flex min-h-[65px] items-center justify-center" />
      </div>
    );
  },
);

TurnstileWidget.displayName = "TurnstileWidget";

