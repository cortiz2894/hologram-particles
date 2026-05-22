"use client";

import { useState, useCallback, useRef } from "react";
import { Leva } from "leva";
import { LEVA_THEME } from "@/components/shared/theme";
import HologramScene from "./HologramScene";
import OverlayButtons from "@/components/overlay/OverlayButtons";
import LoadingOverlay from "@/components/overlay/LoadingOverlay";
import ModelSelector, { ModelOption } from "@/components/overlay/ModelSelector";
import OverlayHeader from "@/components/overlay/OverlayHeader";
import { useHologramControls } from "./utils/useHologramControls";

const MODELS: ModelOption[] = [
  { id: "bd1", label: "BD-1", url: "/glb/bd1.glb" },
  { id: "bb8", label: "BB-8", url: "/glb/bb8.glb" },
];

export default function PlaygroundCanvas() {
  const [hideLeva, setHideLeva] = useState(true);
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
  } = useHologramControls(() => {
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
