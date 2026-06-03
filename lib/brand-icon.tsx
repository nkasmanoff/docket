/** Shared markup for metadata icons (favicon, apple-touch-icon). */
export function brandIconElement(fontSize: number) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f1ea",
        fontSize,
        fontWeight: 700,
        color: "#b08d57",
        fontFamily: "Georgia, serif",
      }}
    >
      §
    </div>
  );
}
