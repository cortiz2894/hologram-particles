"use client";

import { useEffect, useCallback } from "react";
import styles from "./ModelSelector.module.css";

export interface ModelOption {
  id: string;
  label: string;
  url: string;
}

interface ModelSelectorProps {
  models: ModelOption[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export default function ModelSelector({
  models,
  activeIndex,
  onChange,
}: ModelSelectorProps) {
  const prev = useCallback(
    () => onChange((activeIndex - 1 + models.length) % models.length),
    [activeIndex, models.length, onChange],
  );
  const next = useCallback(
    () => onChange((activeIndex + 1) % models.length),
    [activeIndex, models.length, onChange],
  );

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  return (
    <nav className={styles.root}>
      {/* Arrow prev */}
      <button
        className={styles.arrow}
        onClick={prev}
        aria-label="Previous model"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <polyline points="7,1 3,5 7,9" />
        </svg>
      </button>

      {/* Items track */}
      <div className={styles.track}>
        {models.map((model, i) => {
          const offset = i - activeIndex;
          const isActive = offset === 0;
          return (
            <button
              key={model.id}
              className={`${styles.item} ${isActive ? styles.active : ""}`}
              style={{ "--offset": offset } as React.CSSProperties}
              onClick={() => onChange(i)}
              aria-current={isActive ? "true" : undefined}
            >
              {/* Corner brackets — only rendered for active */}
              {isActive && (
                <>
                  <span className={`${styles.corner} ${styles.tl}`} />
                  <span className={`${styles.corner} ${styles.tr}`} />
                  <span className={`${styles.corner} ${styles.bl}`} />
                  <span className={`${styles.corner} ${styles.br}`} />
                </>
              )}
              <span className={styles.label}>{model.label}</span>
            </button>
          );
        })}
      </div>

      {/* Arrow next */}
      <button className={styles.arrow} onClick={next} aria-label="Next model">
        <svg
          width="15"
          height="15"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <polyline points="3,1 7,5 3,9" />
        </svg>
      </button>
    </nav>
  );
}
