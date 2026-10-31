import React from "react";

interface VantageToastProps {
  message: string | null;
}

export function VantageToast({ message }: VantageToastProps) {
  if (!message) return null;

  return (
    <div className="vantage-toast" role="status" aria-live="polite">
      <div className="vantage-toast-dot" />
      <div className="vantage-toast-text">{message}</div>
    </div>
  );
}

