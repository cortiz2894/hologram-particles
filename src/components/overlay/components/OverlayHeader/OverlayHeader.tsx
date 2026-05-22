"use client";

interface OverlayHeaderProps {
  visible?: boolean;
}

export default function OverlayHeader({ visible = true }: OverlayHeaderProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: 28,
        maxWidth: 360,
        pointerEvents: "none",
        zIndex: 999999999,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      {/* Classification label */}
      <div
        style={{
          fontFamily: "var(--font-ibm-mono), monospace",
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(220, 240, 255, 0.9)",
          marginBottom: 6,
        }}
      >
        OPEN SOURCE · THREE.JS / TSL · WebGPU
      </div>

      {/* Horizontal rule */}
      <div
        style={{
          height: 1,
          background: "rgba(220, 240, 255, 0.9)",
          marginBottom: 10,
        }}
      />

      {/* Title */}
      <h1
        style={{
          fontFamily: "var(--font-bebas), sans-serif",
          fontSize: 42,
          lineHeight: 1,
          letterSpacing: "0.05em",
          color: "rgba(220, 240, 255, 0.9)",
          margin: 0,
        }}
      >
        HOLOGRAM PARTICLES VFX
      </h1>

      {/* Subtitle */}
      <div
        style={{
          fontFamily: "var(--font-barlow), sans-serif",
          fontSize: 12,
          fontWeight: 300,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(220, 240, 255, 0.9)",
          marginTop: 4,
        }}
      >
        TSL Node-Based Particle System
      </div>

      {/* Attribution */}
      <div
        style={{
          fontFamily: "var(--font-ibm-mono), monospace",
          fontSize: 9,
          letterSpacing: "0.12em",
          color: "rgba(220, 240, 255, 0.9)",
          marginTop: 12,
          lineHeight: 1.7,
        }}
      >
        ORIGINAL DESIGN &amp; CONCEPT &mdash;{" "}
        <a
          href="https://www.igloo.inc/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "rgba(220, 240, 255, 0.9)",
            textDecoration: "none",
            pointerEvents: "auto",
          }}
        >
          IGLOO.INC
        </a>
        <br />
        REPLICA DEVELOPED BY CORTIZ
      </div>
    </div>
  );
}
