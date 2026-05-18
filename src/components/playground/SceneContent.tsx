"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import SceneCamera from "./SceneCamera";
import SceneLighting from "./SceneLighting";
import SceneEnvironment from "./SceneEnvironment";
import GridFloor from "./GridFloor";
import type { HologramControls } from "./ParticlesHologramScene";

// Loaded client-only: three/webgpu / three/tsl must not run on the server
const ParticlesHologramScene = dynamic(
  () => import("./ParticlesHologramScene"),
  { ssr: false }
);

export type SceneMode = "Background" | "Frame";

interface SceneContentProps {
  showGrid: boolean;
  mode: SceneMode;
  /** Uploaded GLB url, or null to use the default model */
  glbUrl: string | null;
  onModelLoaded?: () => void;
  hologramControls: HologramControls;
}

export default function SceneContent({
  showGrid,
  mode,
  glbUrl,
  onModelLoaded,
  hologramControls,
}: SceneContentProps) {
  return (
    <>
      <SceneCamera />
      <SceneLighting />
      <SceneEnvironment mode={mode} />
      {showGrid && <GridFloor mode={mode} />}

      <Suspense fallback={null}>
        <ParticlesHologramScene
          url={glbUrl ?? "/glb/bd1.glb"}
          onLoaded={onModelLoaded}
          {...hologramControls}
        />
      </Suspense>
    </>
  );
}
