"use client";

import { useRef } from "react";
import { COLORS } from "@/components/shared/theme";
import styles from "./OverlayButtons.module.css";

interface OverlayButtonsProps {
  showGrid: boolean;
  onToggleGrid: () => void;
  hideLeva: boolean;
  onToggleLeva: () => void;
  hasGlb: boolean;
  onLoadGlb: (file: File) => void;
  onClearGlb: () => void;
}

export default function OverlayButtons({
  showGrid,
  onToggleGrid,
  hideLeva,
  onToggleLeva,
  hasGlb,
  onLoadGlb,
  onClearGlb,
}: OverlayButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onLoadGlb(file);
    e.target.value = "";
  };

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
