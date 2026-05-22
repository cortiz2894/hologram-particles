"use client";

import { useRef } from "react";
import { COLORS } from "@/components/shared/theme";
import styles from "./OverlayButtons.module.css";
import type { PresetId } from "@/components/hologramParticles/utils/presets";

interface OverlayButtonsProps {
  showGrid: boolean;
  onToggleGrid: () => void;
  hideLeva: boolean;
  onToggleLeva: () => void;
  hasGlb: boolean;
  onLoadGlb: (file: File) => void;
  onClearGlb: () => void;
  activePreset: PresetId;
  onTogglePreset: () => void;
}

export default function OverlayButtons({
  showGrid,
  onToggleGrid,
  hideLeva,
  onToggleLeva,
  hasGlb,
  onLoadGlb,
  onClearGlb,
  activePreset,
  onTogglePreset,
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
      {/* Preset toggle */}
      <button
        onClick={onTogglePreset}
        className={`${styles.btn} ${styles.presetBtn}`}
        title={`Switch to ${activePreset === "light" ? "dark" : "light"} preset`}
      >
        {activePreset === "light" ? (
          // Moon icon → switch to dark
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          // Sun icon → switch to light
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
        <span className={styles.presetLabel}>
          {activePreset === "light" ? "LIGHT" : "DARK"}
        </span>
      </button>

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
