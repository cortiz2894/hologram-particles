"use client";

import { useRef } from "react";
import { COLORS } from "@/components/shared/theme";
import styles from "./OverlayButtons.module.css";

export type DebugMode = "none" | "wireframe" | "flat" | "normals" | "noise" | "lit" | "light1" | "light2";

interface OverlayButtonsProps {
  showGrid: boolean;
  onToggleGrid: () => void;
  hideLeva: boolean;
  onToggleLeva: () => void;
  hasGlb: boolean;
  onLoadGlb: (file: File) => void;
  onClearGlb: () => void;
  debugMode: DebugMode;
  onDebugMode: (mode: DebugMode) => void;
}

export default function OverlayButtons({
  showGrid,
  onToggleGrid,
  hideLeva,
  onToggleLeva,
  hasGlb,
  onLoadGlb,
  onClearGlb,
  debugMode,
  onDebugMode,
}: OverlayButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onLoadGlb(file);
    e.target.value = "";
  };

  const toggleDebug = (mode: DebugMode) =>
    onDebugMode(debugMode === mode ? "none" : mode);

  return (
    <div
      className={styles.container}
      style={
        {
          "--overlay-bg": COLORS.bg,
          "--overlay-surface": COLORS.surface,
          "--overlay-border": COLORS.border,
          "--overlay-text": COLORS.text,
          "--overlay-accent": COLORS.accent,
        } as React.CSSProperties
      }
    >
      {/* Geometry debug group */}
      <div className={styles.debugGroup}>
        <span className={styles.debugLabel}>GEO</span>
        <button
          className={`${styles.btn} ${styles.debugBtn} ${debugMode === "wireframe" ? styles.debugActive : ""}`}
          onClick={() => toggleDebug("wireframe")}
          title="Wireframe overlay"
        >
          WF
        </button>
        <button
          className={`${styles.btn} ${styles.debugBtn} ${debugMode === "flat" ? styles.debugActive : ""}`}
          onClick={() => toggleDebug("flat")}
          title="Flat shading — shows particle density"
        >
          FLAT
        </button>
        <button
          className={`${styles.btn} ${styles.debugBtn} ${debugMode === "normals" ? styles.debugActive : ""}`}
          onClick={() => toggleDebug("normals")}
          title="Normals as RGB color"
        >
          NRM
        </button>
        <button
          className={`${styles.btn} ${styles.debugBtn} ${debugMode === "noise" ? styles.debugActive : ""}`}
          onClick={() => toggleDebug("noise")}
          title="Raw fractal noise field as grayscale"
        >
          NOI
        </button>
      </div>

      {/* Separator */}
      <div className={styles.separator} />

      {/* Lighting debug group */}
      <div className={styles.debugGroup}>
        <span className={styles.debugLabel}>LIGHT</span>
        <button
          className={`${styles.btn} ${styles.debugBtn} ${debugMode === "lit" ? styles.debugActive : ""}`}
          onClick={() => toggleDebug("lit")}
          title="Combined lighting — grayscale diffuse + ambient"
        >
          LIT
        </button>
        <button
          className={`${styles.btn} ${styles.debugBtn} ${debugMode === "light1" ? styles.debugActive : ""}`}
          onClick={() => toggleDebug("light1")}
          title="Light 1 contribution only — grayscale"
        >
          L1
        </button>
        <button
          className={`${styles.btn} ${styles.debugBtn} ${debugMode === "light2" ? styles.debugActive : ""}`}
          onClick={() => toggleDebug("light2")}
          title="Light 2 contribution only — grayscale"
        >
          L2
        </button>
      </div>

      {/* Separator */}
      <div className={styles.separator} />

      {/* Toggle Leva Controls */}
      <button
        onClick={onToggleLeva}
        className={`${styles.btn} ${!hideLeva ? styles.active : styles.inactive}`}
        title={hideLeva ? "Show Controls" : "Hide Controls"}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <line x1="2" y1="4" x2="14" y2="4" />
          <circle cx="10" cy="4" r="1.5" fill="currentColor" />
          <line x1="2" y1="8" x2="14" y2="8" />
          <circle cx="5" cy="8" r="1.5" fill="currentColor" />
          <line x1="2" y1="12" x2="14" y2="12" />
          <circle cx="9" cy="12" r="1.5" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
