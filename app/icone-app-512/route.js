import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #221f8a 0%, #6b2bc4 100%)",
        }}
      >
        <span style={{ fontSize: 270, fontWeight: 800, color: "#fff", fontFamily: "sans-serif" }}>G</span>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
