"use client";

import { useState, useCallback, useRef } from "react";
import { Leva } from "leva";
import { LEVA_THEME } from "@/components/shared/theme";
import HologramScene from "./HologramScene";
import OverlayButtons from "@/components/overlay/OverlayButtons";
import ModelSelector, { ModelOption } from "@/components/overlay/ModelSelector";
import OverlayHeader from "@/components/overlay/OverlayHeader";
import { useHologramControls } from "./utils/useHologramControls";
import { PRESETS, type PresetId } from "./utils/presets";

const MODELS: ModelOption[] = [
  { id: "bd1", label: "BD-1", url: "/glb/bd1.glb" },
  { id: "bb8", label: "BB-8", url: "/glb/bb8.glb" },
];

export default function PlaygroundCanvas() {
  const [hideLeva, setHideLeva] = useState(true);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [replayTrigger, setReplayTrigger] = useState(0);
  const [activePreset, setActivePreset] = useState<PresetId>("light");
  const glbUrlRef = useRef<string | null>(null);

  const handleLoadGlb = useCallback((file: File) => {
    if (glbUrlRef.current) URL.revokeObjectURL(glbUrlRef.current);
    const url = URL.createObjectURL(file);
    glbUrlRef.current = url;
    setGlbUrl(url);
  }, []);

  const handleClearGlb = useCallback(() => {
    if (glbUrlRef.current) URL.revokeObjectURL(glbUrlRef.current);
    glbUrlRef.current = null;
    setGlbUrl(null);
  }, []);

  const leva = useHologramControls(() => {
    setReplayTrigger((t) => t + 1);
    setHeaderVisible(false);
  });

  return (
    <>
      <Leva
        theme={LEVA_THEME}
        titleBar={{ title: "CONTROLS" }}
        collapsed={false}
        flat={false}
        oneLineLabels={false}
        hidden={hideLeva}
      />
      <OverlayHeader visible={headerVisible} />
      <div style={{ position: "fixed", inset: 0 }}>
        <HologramScene
          url={glbUrl ?? MODELS[activeModelIndex].url}
          preloadUrls={MODELS.map((m) => m.url)}
          onTransitionComplete={() => setHeaderVisible(true)}
          replayTrigger={replayTrigger}
          {...leva}
          {...PRESETS[activePreset]}
        />
      </div>

      <OverlayButtons
        showGrid={false}
        onToggleGrid={() => {}}
        hideLeva={hideLeva}
        onToggleLeva={() => setHideLeva((v) => !v)}
        hasGlb={glbUrl !== null}
        onLoadGlb={handleLoadGlb}
        onClearGlb={handleClearGlb}
        activePreset={activePreset}
        onTogglePreset={() =>
          setActivePreset((p) => (p === "light" ? "dark" : "light"))
        }
      />
      <ModelSelector
        models={MODELS}
        activeIndex={activeModelIndex}
        onChange={setActiveModelIndex}
      />
    </>
  );
}
