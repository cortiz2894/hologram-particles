"use client";

import { useState, useCallback, useRef } from "react";
import { Leva, useControls, folder } from "leva";
import { LEVA_THEME } from "@/components/shared/theme";
import HologramScene from "./HologramScene";
import OverlayButtons from "@/components/overlay/OverlayButtons";
import LoadingOverlay from "@/components/overlay/LoadingOverlay";

export default function PlaygroundCanvas() {
  const [hideLeva, setHideLeva] = useState(false);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const glbUrlRef = useRef<string | null>(null);

  const handleLoadGlb = useCallback((file: File) => {
    if (glbUrlRef.current) URL.revokeObjectURL(glbUrlRef.current);
    const url = URL.createObjectURL(file);
    glbUrlRef.current = url;
    setIsLoadingModel(true);
    setGlbUrl(url);
  }, []);

  const handleModelLoaded = useCallback(() => setIsLoadingModel(false), []);

  const handleClearGlb = useCallback(() => {
    if (glbUrlRef.current) URL.revokeObjectURL(glbUrlRef.current);
    glbUrlRef.current = null;
    setGlbUrl(null);
  }, []);

  // ── Leva controls ─────────────────────────────────────────────────────────
  const {
    particleCount,
    autoRotateSpeed,
    color,
    floatAmp,
    sphereSize,
    ambient,
    wrap,
    volumeStrength,
    noiseAmp,
    noiseScale,
    noiseSpeed,
    noiseGain,
    maskScale,
    maskSpeed,
    maskContrast,
    modelX,
    modelY,
    modelZ,
    mouseRadius,
    mouseStrength,
    springStiffness,
    springDamping,
    pushStrength,
    mouseScatter,
    mouseGlowColor,
    mouseGlowPassive,
    mouseGlowActive,
    mouseGlowPow,
    mouseLerp,
    lightX,
    lightY,
    lightZ,
  } = useControls("Hologram", {
    Geometry: folder(
      {
        particleCount: {
          value: 80000,
          min: 1000,
          max: 150000,
          step: 1000,
          label: "Particles",
        },
      },
      { collapsed: false },
    ),
    Material: folder(
      {
        color: { value: "#8aa0b8", label: "Color" },
        sphereSize: {
          value: 0.01,
          min: 0.003,
          max: 0.08,
          step: 0.001,
          label: "Sphere Size",
        },
        ambient: {
          value: 0.28,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Shadow Floor",
        },
        wrap: {
          value: 1,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Light Softness",
        },
        volumeStrength: {
          value: 1,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Sphere Volume",
        },
      },
      { collapsed: false },
    ),
    Position: folder(
      {
        modelX: {
          value: 0,
          min: -5,
          max: 5,
          step: 0.05,
          label: "X",
        },
        modelY: {
          value: 2.5,
          min: -5,
          max: 5,
          step: 0.05,
          label: "Y",
        },
        modelZ: {
          value: 0,
          min: -5,
          max: 5,
          step: 0.05,
          label: "Z",
        },
      },
      { collapsed: false },
    ),
    Interaction: folder(
      {
        mouseRadius: {
          value: 1.1,
          min: 0.1,
          max: 5,
          step: 0.05,
          label: "Radius",
        },
        mouseStrength: {
          value: 7.1,
          min: 0,
          max: 10,
          step: 0.05,
          label: "Strength",
        },
        pushStrength: {
          value: 1,
          min: 0,
          max: 30,
          step: 0.5,
          label: "Push Force",
        },
        springStiffness: {
          value: 40,
          min: 0.5,
          max: 40,
          step: 0.5,
          label: "Stiffness",
        },
        springDamping: {
          value: 20,
          min: 0.1,
          max: 20,
          step: 0.1,
          label: "Damping",
        },

        mouseScatter: {
          value: 1.55,
          min: 0,
          max: 3,
          step: 0.05,
          label: "Scatter",
        },
        mouseGlowColor: { value: "#ffffff", label: "Glow Color" },
        mouseGlowPassive: {
          value: 1.8,
          min: 0,
          max: 3,
          step: 0.05,
          label: "Glow Passive",
        },
        mouseGlowActive: {
          value: 1.5,
          min: 0,
          max: 6,
          step: 0.05,
          label: "Glow Active",
        },
        mouseGlowPow: {
          value: 2.0,
          min: 0.5,
          max: 6,
          step: 0.1,
          label: "Glow Sharpness",
        },
        mouseLerp: {
          value: 2.0,
          min: 0.5,
          max: 30,
          step: 0.5,
          label: "Follow Speed",
        },
      },
      { collapsed: false },
    ),
    Light: folder(
      {
        lightX: {
          value: -0.5,
          min: -10,
          max: 10,
          step: 0.1,
          label: "Light X",
        },
        lightY: {
          value: -0.2,
          min: -10,
          max: 10,
          step: 0.1,
          label: "Light Y",
        },
        lightZ: {
          value: -0.1,
          min: -10,
          max: 10,
          step: 0.1,
          label: "Light Z",
        },
      },
      { collapsed: false },
    ),
    Animation: folder(
      {
        floatAmp: {
          value: 0.01,
          min: 0,
          max: 0.15,
          step: 0.001,
          label: "Float Amp",
        },
        autoRotateSpeed: {
          value: 2.53,
          min: 0,
          max: 5,
          step: 0.05,
          label: "Rotate Speed",
        },
      },
      { collapsed: false },
    ),
    Wave: folder(
      {
        noiseAmp: {
          value: 0.5,
          min: 0,
          max: 0.5,
          step: 0.005,
          label: "Wave Amp",
        },
        noiseScale: {
          value: 3.0,
          min: 0.05,
          max: 3,
          step: 0.05,
          label: "Wave Scale",
        },
        noiseSpeed: {
          value: 0.59,
          min: 0,
          max: 2,
          step: 0.01,
          label: "Wave Speed",
        },
        noiseGain: {
          value: 0.73,
          min: 0.1,
          max: 0.9,
          step: 0.01,
          label: "Turbulence",
        },
        maskScale: {
          value: 0.5,
          min: 0.05,
          max: 2,
          step: 0.05,
          label: "Instability Scale",
        },
        maskSpeed: {
          value: 0.21,
          min: 0,
          max: 0.5,
          step: 0.005,
          label: "Instability Speed",
        },
        maskContrast: {
          value: 4.0,
          min: 0.1,
          max: 8,
          step: 0.1,
          label: "Instability Edge",
        },
      },
      { collapsed: false },
    ),
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

      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 48% 45%, #d2dde8 0%, #a0b4c8 45%, #7a96aa 100%)",
        }}
      >
        <HologramScene
          url={glbUrl ?? "/glb/bd1.glb"}
          onLoaded={handleModelLoaded}
          particleCount={particleCount}
          autoRotateSpeed={autoRotateSpeed}
          color={color}
          floatAmp={floatAmp}
          sphereSize={sphereSize}
          ambient={ambient}
          wrap={wrap}
          volumeStrength={volumeStrength}
          modelX={modelX}
          modelY={modelY}
          modelZ={modelZ}
          mouseRadius={mouseRadius}
          mouseStrength={mouseStrength}
          springStiffness={springStiffness}
          springDamping={springDamping}
          pushStrength={pushStrength}
          mouseScatter={mouseScatter}
          mouseGlowColor={mouseGlowColor}
          mouseGlowPassive={mouseGlowPassive}
          mouseGlowActive={mouseGlowActive}
          mouseGlowPow={mouseGlowPow}
          mouseLerp={mouseLerp}
          noiseAmp={noiseAmp}
          noiseScale={noiseScale}
          noiseSpeed={noiseSpeed}
          noiseGain={noiseGain}
          maskScale={maskScale}
          maskSpeed={maskSpeed}
          maskContrast={maskContrast}
          lightX={lightX}
          lightY={lightY}
          lightZ={lightZ}
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
      />
      <LoadingOverlay visible={isLoadingModel} />
    </>
  );
}
