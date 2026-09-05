import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          background: "#070A10",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          border: "1.5px solid #6366F1",
          color: "#10B981",
          fontWeight: 800,
          fontFamily: "monospace",
        }}
      >
        <span style={{ color: "#6366F1" }}>&gt;</span>
        <span style={{ color: "#10B981" }}>_</span>
      </div>
    ),
    {
      ...size,
    }
  );
}
