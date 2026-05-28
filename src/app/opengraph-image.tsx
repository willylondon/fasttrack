import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FastTrack";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(circle at top left, rgba(45,212,191,0.18), transparent 25%), linear-gradient(180deg, #111111 0%, #090909 100%)",
          color: "white",
          padding: "48px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            borderRadius: "40px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(20,20,20,0.85)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
            padding: "40px",
          }}
        >
          <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                style={{
                  width: "96px",
                  height: "96px",
                  borderRadius: "28px",
                  background: "linear-gradient(135deg, #14b8a6 0%, #8B5CF6 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "42px",
                  fontWeight: 700,
                }}
              >
                F
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "32px", opacity: 0.72, letterSpacing: "0.28em", textTransform: "uppercase" }}>
                  FastTrack
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "68px", fontWeight: 700, lineHeight: 1.02 }}>
                  <div style={{ display: "flex" }}>Build your streak.</div>
                  <div style={{ display: "flex" }}>Track your window.</div>
                  <div style={{ display: "flex" }}>Stay accountable.</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "18px", fontSize: "28px", color: "rgba(255,255,255,0.72)" }}>
              <div>Fasting windows</div>
              <div>Streaks</div>
              <div>Friends</div>
              <div>History</div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
