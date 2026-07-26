"use client";

/**
 * Last-resort boundary: catches failures in the root layout itself, so it has
 * to render its own <html>/<body> and cannot rely on the app's CSS having
 * loaded. Styles are inline for that reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 32,
          background: "#0b0b0c",
          color: "#f4f4f5",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Pump couldn&apos;t start
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
            color: "#a1a1aa",
            maxWidth: "34ch",
          }}
        >
          Something failed before the app could load. Reloading usually fixes
          it.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            minHeight: 44,
            padding: "0 20px",
            border: 0,
            borderRadius: 12,
            background: "#d7ff3e",
            color: "#000",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Try again
        </button>
        {error.digest && (
          <p style={{ margin: 0, fontSize: 11, color: "#6b6b73" }}>
            Ref {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
