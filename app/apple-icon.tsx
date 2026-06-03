import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f1ea",
          fontSize: 118,
          fontWeight: 700,
          color: "#b08d57",
          fontFamily: "Georgia, serif",
        }}
      >
        §
      </div>
    ),
    { ...size },
  );
}
