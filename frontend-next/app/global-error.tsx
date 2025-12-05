"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "system-ui, sans-serif",
            backgroundColor: "#f9fafb",
          }}
        >
          <div
            style={{
              maxWidth: "400px",
              textAlign: "center",
              padding: "2rem",
              backgroundColor: "white",
              borderRadius: "0.5rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                margin: "0 auto 1rem",
                backgroundColor: "#fee2e2",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.5rem" }}>
              Critical Error
            </h1>
            <p style={{ color: "#6b7280", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
              A critical error occurred. Please refresh the page or contact support if the problem
              persists.
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: "#4f46e5",
                color: "white",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "500",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
