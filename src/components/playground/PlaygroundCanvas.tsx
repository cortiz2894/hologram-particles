"use client";

import { useState, useCallback, useRef } from "react";
import { Leva, useControls, folder, button } from "leva";
import { LEVA_THEME } from "@/components/shared/theme";
import HologramScene from "./HologramScene";
import OverlayButtons from "@/components/overlay/OverlayButtons";
import LoadingOverlay from "@/components/overlay/LoadingOverlay";
import ModelSelector, { ModelOption } from "@/components/overlay/ModelSelector";
import OverlayHeader from "../overlay/OverlayHeader";

const MODELS: ModelOption[] = [
  { id: "bd1", label: "BD-1", url: "/glb/bd1.glb" },
  { id: "bb8", label: "BB-8", url: "/glb/bb8.glb" },
];

export default function PlaygroundCanvas() {
  const [hideLeva, setHideLeva] = useState(false);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [replayTrigger, setReplayTrigger] = useState(0);
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
    mouseGlowDecay,
    mouseGlowActive,
    mouseGlowPow,
    mouseLerp,
    bloomStrength,
    bloomRadius,
    bloomThreshold,
    chromaticStr,
    light1X,
    light1Y,
    light1Z,
    light1Color,
    light1Intensity,
    light2X,
    light2Y,
    light2Z,
    light2Color,
    light2Intensity,
    transitionDeformDur,
    transitionMorphDur,
    transitionReformDur,
    transitionMaskContrast,
    transitionGlowScale,
    cylVisible,
    cylRadius,
    cylHeight,
    cylColor,
    cylNoiseScale,
    cylLineWidth,
    cylFresnelPow,
    cylBaseOpacity,
    cylLineOpacity,
    cylNoiseSpeed,
    cylPulseSpeed,
    cylPulseAmp,
    cylPulseEasing,
    cylWaveFreq,
    cylTexRepeat,
    cylY,
    bgColorCenter,
    bgColorMid,
    bgColorEdge,
    gridVisible,
    gridColor,
    gridBaseOpacity,
    gridWaveAmp,
    gridNoiseScale,
    gridWaveSpeed,
    gridDensity,
    gridDotSize,
    ringVisible,
    ringRadius,
    ringThickness,
    ringGap,
    ringColor,
    ringOpacity,
    ringBrightness,
    camIntensity,
    camStiffness,
    camDamping,
    entranceMorphDur,
    entranceReformDur,
  } = useControls("Hologram", {
    Geometry: folder(
      {
        particleCount: {
          value: 60000,
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
        color: { value: "#99a5b7", label: "Color" },
        sphereSize: {
          value: 0.014,
          min: 0.003,
          max: 0.08,
          step: 0.001,
          label: "Sphere Size",
        },
        ambient: {
          value: 0.2,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Shadow Floor",
        },
        wrap: {
          value: 0.35,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Light Softness",
        },
        volumeStrength: {
          value: 0.67,
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
          value: -1.2,
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
          value: 2.15,
          min: 0.1,
          max: 5,
          step: 0.05,
          label: "Radius",
        },
        mouseStrength: {
          value: 4.9,
          min: 0,
          max: 10,
          step: 0.05,
          label: "Strength",
        },
        pushStrength: {
          value: 2.5,
          min: 0,
          max: 30,
          step: 0.5,
          label: "Push Force",
        },
        springStiffness: {
          value: 40,
          min: 0.5,
          max: 60,
          step: 0.5,
          label: "Return Speed",
        },
        springDamping: {
          value: 20,
          min: 0.1,
          max: 40,
          step: 0.1,
          label: "Return Smoothness",
        },

        mouseScatter: {
          value: 1,
          min: 0,
          max: 3,
          step: 0.05,
          label: "Scatter",
        },
        // mouseGlowColor: { value: "#bac9cb", label: "Glow Color" },
        mouseGlowColor: { value: "#ffada7", label: "Glow Color" },
        mouseGlowPassive: {
          value: 3,
          min: 0,
          max: 3,
          step: 0.05,
          label: "Glow Passive",
        },
        mouseGlowActive: {
          value: 6,
          min: 0,
          max: 6,
          step: 0.05,
          label: "Glow Active",
        },
        mouseGlowDecay: {
          value: 0.3,
          min: 0.1,
          max: 10,
          step: 0.1,
          label: "Glow Decay",
        },
        mouseGlowPow: {
          value: 6.0,
          min: 0.5,
          max: 6,
          step: 0.1,
          label: "Glow Sharpness",
        },
        mouseLerp: {
          value: 1.5,
          min: 0.5,
          max: 30,
          step: 0.5,
          label: "Follow Speed",
        },
      },
      { collapsed: false },
    ),
    PostFX: folder(
      {
        bloomStrength: {
          value: 0.65,
          min: 0,
          max: 3,
          step: 0.05,
          label: "Bloom Strength",
        },
        bloomRadius: {
          value: 0.65,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Bloom Radius",
        },
        bloomThreshold: {
          value: 0.34,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Bloom Threshold",
        },
        chromaticStr: {
          value: 0.05,
          min: 0,
          max: 3,
          step: 0.05,
          label: "Chromatic Aberration",
        },
      },
      { collapsed: false },
    ),
    "Light 1": folder(
      {
        light1X: { value: 0, min: -10, max: 10, step: 0.1, label: "X" },
        light1Y: { value: 5, min: -10, max: 10, step: 0.1, label: "Y" },
        light1Z: { value: 2, min: -10, max: 10, step: 0.1, label: "Z" },
        light1Color: { value: "#ffffff", label: "Color" },
        light1Intensity: {
          value: 1.5,
          min: 0,
          max: 3,
          step: 0.05,
          label: "Intensity",
        },
      },
      { collapsed: false },
    ),
    "Light 2": folder(
      {
        light2X: { value: 0, min: -10, max: 10, step: 0.1, label: "X" },
        light2Y: { value: -5, min: -10, max: 10, step: 0.1, label: "Y" },
        light2Z: { value: -2, min: -10, max: 10, step: 0.1, label: "Z" },
        light2Color: { value: "#f2e0e0", label: "Color" },
        light2Intensity: {
          value: 1.1,
          min: 0,
          max: 3,
          step: 0.05,
          label: "Intensity",
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
          value: 0.72,
          min: 0,
          max: 1,
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
          value: 1,
          min: 0,
          max: 2,
          step: 0.01,
          label: "Wave Speed",
        },
        noiseGain: {
          value: 0.65,
          min: 0.1,
          max: 0.9,
          step: 0.01,
          label: "Turbulence",
        },
        maskScale: {
          value: 0.95,
          min: 0.05,
          max: 2,
          step: 0.05,
          label: "Instability Scale",
        },
        maskSpeed: {
          value: 0.5,
          min: 0,
          max: 0.5,
          step: 0.005,
          label: "Instability Speed",
        },
        maskContrast: {
          value: 3.8,
          min: 0.1,
          max: 8,
          step: 0.1,
          label: "Instability Edge",
        },
      },
      { collapsed: false },
    ),
    Transition: folder(
      {
        transitionDeformDur: {
          value: 0.4,
          min: 0.1,
          max: 3,
          step: 0.05,
          label: "Deform Duration",
        },
        transitionMorphDur: {
          value: 2.05,
          min: 0.1,
          max: 4,
          step: 0.05,
          label: "Morph Duration",
        },
        transitionReformDur: {
          value: 0.45,
          min: 0.1,
          max: 3,
          step: 0.05,
          label: "Reform Duration",
        },
        transitionMaskContrast: {
          value: 1.65,
          min: 0.0,
          max: 2,
          step: 0.05,
          label: "Deform Amount",
        },
        transitionGlowScale: {
          value: 1.0,
          min: 0,
          max: 4,
          step: 0.05,
          label: "Glow Scale",
        },
      },
      { collapsed: true },
    ),
    Entrance: folder(
      {
        entranceMorphDur: {
          value: 1.8,
          min: 0.1,
          max: 3,
          step: 0.05,
          label: "Morph Duration",
        },
        entranceReformDur: {
          value: 1.1,
          min: 0.05,
          max: 2,
          step: 0.05,
          label: "Reform Duration",
        },
        replay: button(() => {
          setReplayTrigger((t) => t + 1);
          setHeaderVisible(false);
        }),
      },
      { collapsed: true },
    ),
    Cylinder: folder(
      {
        cylVisible: { value: true, label: "Visible" },
        cylColor: { value: "#ffffff", label: "Color" },
        cylRadius: {
          value: 1.95,
          min: 0.5,
          max: 5,
          step: 0.05,
          label: "Radius",
        },
        cylHeight: {
          value: 5.3,
          min: 0.5,
          max: 10,
          step: 0.1,
          label: "Height",
        },
        cylNoiseScale: {
          value: 0.2,
          min: 0.1,
          max: 12,
          step: 0.1,
          label: "Noise Scale",
        },
        cylLineWidth: {
          value: 0.22,
          min: 0.005,
          max: 0.5,
          step: 0.005,
          label: "Line Width",
        },
        cylFresnelPow: {
          value: 1.6,
          min: 0.5,
          max: 8,
          step: 0.1,
          label: "Fresnel Power",
        },
        cylBaseOpacity: {
          value: 0.0,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Base Opacity",
        },
        cylLineOpacity: {
          value: 1,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Line Opacity",
        },
        cylNoiseSpeed: {
          value: 0.15,
          min: 0,
          max: 3,
          step: 0.05,
          label: "Noise Speed",
        },
        cylPulseSpeed: {
          value: 2.5,
          min: 0,
          max: 5,
          step: 0.05,
          label: "Pulse Speed",
        },
        cylPulseAmp: {
          value: 0.68,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Pulse Amount",
        },
        cylPulseEasing: {
          value: 2.5,
          min: 1,
          max: 8,
          step: 0.1,
          label: "Pulse Easing",
        },
        cylWaveFreq: {
          value: 2.0,
          min: 0.1,
          max: 10,
          step: 0.1,
          label: "Wave Freq",
        },
        cylTexRepeat: {
          value: 8.5,
          min: 0.5,
          max: 20,
          step: 0.5,
          label: "Tex Repeat",
        },
        cylY: {
          value: -0.85,
          min: -5,
          max: 5,
          step: 0.05,
          label: "Position Y",
        },
      },
      { collapsed: true },
    ),
    "Dot Grid": folder(
      {
        gridVisible: { value: true, label: "Visible" },
        gridColor: { value: "#c8d4de", label: "Color" },
        gridBaseOpacity: {
          value: 0.31,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Base Opacity",
        },
        gridWaveAmp: {
          value: 0.73,
          min: 0,
          max: 4,
          step: 0.05,
          label: "Wave Amp",
        },
        gridNoiseScale: {
          value: 0.44,
          min: 0.01,
          max: 1,
          step: 0.01,
          label: "Wave Scale",
        },
        gridWaveSpeed: {
          value: 0.62,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Wave Speed",
        },
        gridDensity: {
          value: 2.15,
          min: 0.2,
          max: 4,
          step: 0.05,
          label: "Density",
        },
        gridDotSize: {
          value: 0.04,
          min: 0.01,
          max: 0.45,
          step: 0.01,
          label: "Dot Size",
        },
      },
      { collapsed: true },
    ),
    Ring: folder(
      {
        ringVisible: { value: true, label: "Visible" },
        ringColor: { value: "#ffffff", label: "Color" },
        ringRadius: {
          value: 1.95,
          min: 0.1,
          max: 6,
          step: 0.05,
          label: "Radius",
        },
        ringThickness: {
          value: 0.03,
          min: 0.005,
          max: 0.3,
          step: 0.005,
          label: "Thickness",
        },
        ringGap: {
          value: 20,
          min: 0,
          max: 80,
          step: 1,
          label: "Gap (deg)",
        },
        ringOpacity: {
          value: 0.9,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Opacity",
        },
        ringBrightness: {
          value: 3.0,
          min: 0,
          max: 8,
          step: 0.1,
          label: "Brightness",
        },
      },
      { collapsed: true },
    ),
    Camera: folder(
      {
        camIntensity: {
          value: 1,
          min: 0,
          max: 40,
          step: 0.5,
          label: "Intensity",
        },
        camStiffness: {
          value: 3.0,
          min: 0.1,
          max: 20,
          step: 0.1,
          label: "Stiffness",
        },
        camDamping: {
          value: 4.0,
          min: 0.1,
          max: 20,
          step: 0.1,
          label: "Damping",
        },
      },
      { collapsed: true },
    ),
    Background: folder(
      {
        bgColorCenter: { value: "#495155", label: "Center" },
        bgColorMid: { value: "#495258", label: "Mid" },
        bgColorEdge: { value: "#305269", label: "Edge" },
      },
      { collapsed: true },
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
      <OverlayHeader visible={headerVisible} />
      <div style={{ position: "fixed", inset: 0 }}>
        <HologramScene
          url={glbUrl ?? MODELS[activeModelIndex].url}
          preloadUrls={MODELS.map((m) => m.url)}
          onLoaded={handleModelLoaded}
          onTransitionComplete={() => setHeaderVisible(true)}
          entranceMorphDur={entranceMorphDur}
          entranceReformDur={entranceReformDur}
          replayTrigger={replayTrigger}
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
          mouseGlowDecay={mouseGlowDecay}
          mouseLerp={mouseLerp}
          bloomStrength={bloomStrength}
          bloomRadius={bloomRadius}
          bloomThreshold={bloomThreshold}
          chromaticStr={chromaticStr}
          noiseAmp={noiseAmp}
          noiseScale={noiseScale}
          noiseSpeed={noiseSpeed}
          noiseGain={noiseGain}
          maskScale={maskScale}
          maskSpeed={maskSpeed}
          maskContrast={maskContrast}
          light1X={light1X}
          light1Y={light1Y}
          light1Z={light1Z}
          light1Color={light1Color}
          light1Intensity={light1Intensity}
          light2X={light2X}
          light2Y={light2Y}
          light2Z={light2Z}
          light2Color={light2Color}
          light2Intensity={light2Intensity}
          transitionDeformDur={transitionDeformDur}
          transitionMorphDur={transitionMorphDur}
          transitionReformDur={transitionReformDur}
          transitionMaskContrast={transitionMaskContrast}
          transitionGlowScale={transitionGlowScale}
          cylVisible={cylVisible}
          cylRadius={cylRadius}
          cylHeight={cylHeight}
          cylColor={cylColor}
          cylNoiseScale={cylNoiseScale}
          cylLineWidth={cylLineWidth}
          cylFresnelPow={cylFresnelPow}
          cylBaseOpacity={cylBaseOpacity}
          cylLineOpacity={cylLineOpacity}
          cylNoiseSpeed={cylNoiseSpeed}
          cylPulseSpeed={cylPulseSpeed}
          cylPulseAmp={cylPulseAmp}
          cylPulseEasing={cylPulseEasing}
          cylWaveFreq={cylWaveFreq}
          cylTexRepeat={cylTexRepeat}
          cylY={cylY}
          bgColorCenter={bgColorCenter}
          bgColorMid={bgColorMid}
          bgColorEdge={bgColorEdge}
          gridVisible={gridVisible}
          gridColor={gridColor}
          gridBaseOpacity={gridBaseOpacity}
          gridWaveAmp={gridWaveAmp}
          gridNoiseScale={gridNoiseScale}
          gridWaveSpeed={gridWaveSpeed}
          gridDensity={gridDensity}
          gridDotSize={gridDotSize}
          ringVisible={ringVisible}
          ringRadius={ringRadius}
          ringThickness={ringThickness}
          ringGap={ringGap}
          ringColor={ringColor}
          ringOpacity={ringOpacity}
          ringBrightness={ringBrightness}
          camIntensity={camIntensity}
          camStiffness={camStiffness}
          camDamping={camDamping}
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
      <ModelSelector
        models={MODELS}
        activeIndex={activeModelIndex}
        onChange={setActiveModelIndex}
      />
    </>
  );
}
