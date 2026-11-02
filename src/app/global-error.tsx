"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Replaces the root layout when it fails, so it can't rely on app styles.
export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#0b0b0b", color: "#f5f7fa", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>FastTrack hit a problem.</h1>
          <p style={{ lineHeight: 1.5, opacity: 0.75 }}>Your saved progress is safe. Please try again.</p>
          <button
            onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 12, background: "#8b5cf6", color: "#fff", fontSize: 14 }}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
