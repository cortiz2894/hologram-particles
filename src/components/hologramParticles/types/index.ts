// ── Presets ───────────────────────────────────────────────────────────────────

export type PresetId = "light" | "dark";

export interface HologramPreset {
  // Material
  color: string;
  ambient: number;
  wrap: number;
  volumeStrength: number;
  // Interaction
  mouseGlowColor: string;
  // Light 1
  light1Color: string;
  light1Intensity: number;
  // Light 2
  light2Color: string;
  light2Intensity: number;
  // Cylinder
  cylColor: string;
  // Dot Grid
  gridColor: string;
  gridBaseOpacity: number;
  // Ring
  ringColor: string;
  ringThickness: number;
  ringBrightness: number;
  ringOpacity: number;
  // Background
  bgColorCenter: string;
  bgColorMid: string;
  bgColorEdge: string;
}

// ── Geometry cache ────────────────────────────────────────────────────────────

export type GeometryData = { positions: Float32Array; normals: Float32Array };

// ── Component props ───────────────────────────────────────────────────────────

export interface ParticlesHologramProps {
  url: string;
  onLoaded?: () => void;
  onTransitionComplete?: () => void;
  particleCount?: number;
  autoRotateSpeed?: number;
  color?: string;
  floatAmp?: number;
  sphereSize?: number;
  /** Shadow floor — 0: pitch black shadows · 1: flat/no contrast */
  ambient?: number;
  /**
   * Wrapped-diffuse softness — 0: hard Lambert · 1: full wrap (light bleeds
   * into shadow side).
   */
  wrap?: number;
  // ── Light 1 ───────────────────────────────────────────────────────────────
  light1X?: number;
  light1Y?: number;
  light1Z?: number;
  light1Color?: string;
  light1Intensity?: number;
  // ── Light 2 ───────────────────────────────────────────────────────────────
  light2X?: number;
  light2Y?: number;
  light2Z?: number;
  light2Color?: string;
  light2Intensity?: number;
  /** Model position offset X */
  modelX?: number;
  /** Model position offset Y */
  modelY?: number;
  /** Model position offset Z */
  modelZ?: number;
  /**
   * How much local sphere volume shading blends in — 0: pure figure shading
   * (flat spheres) · 1: figure × sphere shading (full 3-D depth per sphere)
   */
  volumeStrength?: number;
  /** Noise wave displacement amplitude */
  noiseAmp?: number;
  /** Spatial scale of the noise field — lower = larger / smoother waves */
  noiseScale?: number;
  /** Speed at which the noise field scrolls through time */
  noiseSpeed?: number;
  /**
   * Turbulence — controls fractal octave diminish (0.1 = rough · 0.9 = smooth)
   */
  noiseGain?: number;
  /** Spatial scale of the instability mask — lower = larger calm/chaotic regions */
  maskScale?: number;
  /** How fast the instability mask drifts across the figure */
  maskSpeed?: number;
  /**
   * Sharpness of the mask edge — 1: soft gradient · high values: hard boundary
   * between stable and unstable zones
   */
  maskContrast?: number;
  /** World-space radius of the mouse influence sphere */
  mouseRadius?: number;
  /** Peak displacement amplitude at the mouse centre */
  mouseStrength?: number;
  /** Spring stiffness — how fast displaced particles return to rest (higher = snappier) */
  springStiffness?: number;
  /** Spring damping — higher = overdamped/smooth, lower = underdamped/springy */
  springDamping?: number;
  /** How hard the mouse push drives the spring velocity */
  pushStrength?: number;
  /** Per-particle scatter — 0: all particles move as one block, high: each particle flies in its own direction */
  mouseScatter?: number;
  /** Glow color — the color particles flash toward when disturbed (hex string) */
  mouseGlowColor?: string;
  /**
   * Passive glow — brightness just from cursor proximity, even when stationary.
   * 0 = off, higher = cursor always illuminates nearby particles.
   */
  mouseGlowPassive?: number;
  /**
   * Active glow — extra brightness driven by displacement magnitude (impulse).
   * Only visible while the cursor is moving / particles are disturbed.
   */
  mouseGlowActive?: number;
  /**
   * Glow falloff power — controls edge sharpness of the glow halo.
   * 1 = linear, 2 = smooth, 4+ = tight hot-spot at cursor centre.
   */
  mouseGlowPow?: number;
  /**
   * Glow decay speed — how fast the active glow fades after interaction.
   * Independent of spring physics so glow can linger after particles return.
   * Lower = longer glow trail, higher = snappy disappear.
   */
  mouseGlowDecay?: number;
  /**
   * Virtual cursor follow speed — lower = more inertia/drag lag, higher = instant.
   * Uses exponential smoothing: smoothPos = lerp(smoothPos, target, 1 - exp(-speed * dt))
   */
  mouseLerp?: number;
  // ── Post-processing ────────────────────────────────────────────────────────
  /** Bloom strength — how bright the bloom effect is */
  bloomStrength?: number;
  /** Bloom radius — how far the bloom spreads (0–1) */
  bloomRadius?: number;
  /** Bloom threshold — minimum luminance that triggers bloom (0–1) */
  bloomThreshold?: number;
  /** Chromatic aberration strength — RGB fringe at screen edges */
  chromaticStr?: number;
  /**
   * URLs to pre-sample in the background so model transitions are instant.
   * Pass all model URLs upfront; the current url is already loaded by the
   * main effect and doesn't need to be repeated here.
   */
  preloadUrls?: string[];
  // ── Transition timing ────────────────────────────────────────────────────
  /** Seconds to deform the current model before morphing (maskContrast → transitionMaskContrast) */
  transitionDeformDur?: number;
  /** Seconds for particles to flow from old model to new model */
  transitionMorphDur?: number;
  /** Seconds to reform the new model after morphing (maskContrast → user value) */
  transitionReformDur?: number;
  /** Target maskContrast during the transition — lower = more deformed/chaotic */
  transitionMaskContrast?: number;
  /** Scale of the bloom glow on high-movement particles during morph transition */
  transitionGlowScale?: number;
  // ── Cylinder ──────────────────────────────────────────────────────────────
  /** Show or hide the cylinder */
  cylVisible?: boolean;
  /** Cylinder radius in world units */
  cylRadius?: number;
  /** Cylinder height in world units */
  cylHeight?: number;
  /** Base color of the cylinder surface */
  cylColor?: string;
  /** Spatial frequency of the noise line pattern */
  cylNoiseScale?: number;
  /** Zero-crossing threshold — smaller = thinner lines */
  cylLineWidth?: number;
  /** Fresnel rim falloff power — higher = tighter rim band */
  cylFresnelPow?: number;
  /** Opacity driven by the Fresnel rim (0 = invisible rim) */
  cylBaseOpacity?: number;
  /** Opacity of the noise lines */
  cylLineOpacity?: number;
  /** Speed at which the noise pattern scrolls across the cylinder */
  cylNoiseSpeed?: number;
  /** Frequency of the line-opacity pulse in Hz */
  cylPulseSpeed?: number;
  /** Amplitude of the pulse — 0: constant opacity · 1: opacity oscillates fully */
  cylPulseAmp?: number;
  /** Easing power applied to the pulse — 1: linear sine · higher: sharp flash, longer dwell */
  cylPulseEasing?: number;
  /** Spatial frequency of the traveling wave along the cylinder Y axis — higher = more rings visible */
  cylWaveFreq?: number;
  /** UV repeat factor for the triangle texture — higher = smaller/denser triangles */
  cylTexRepeat?: number;
  /** Vertical offset of the cylinder centre in posGroup space */
  cylY?: number;
  // ── Dot grid background ──────────────────────────────────────────────────
  gridVisible?: boolean;
  /** Dot color */
  gridColor?: string;
  /** Minimum dot opacity (when no wave) */
  gridBaseOpacity?: number;
  /** How much brighter dots get at the wave crest */
  gridWaveAmp?: number;
  /** Spatial scale of the wave noise — lower = larger blobs */
  gridNoiseScale?: number;
  /** Speed the wave drifts through the grid */
  gridWaveSpeed?: number;
  /** Dots per world unit — higher = denser grid */
  gridDensity?: number;
  /** Dot radius as a fraction of cell size (0–0.5) */
  gridDotSize?: number;
  // ── Halo ring ─────────────────────────────────────────────────────────────
  /** Show or hide the halo ring */
  ringVisible?: boolean;
  /** Radius of the halo ring (should roughly match cylinder radius) */
  ringRadius?: number;
  /** Tube thickness of the ring */
  ringThickness?: number;
  /** Angular gap on each side, in degrees (0 = full circle) */
  ringGap?: number;
  /** Ring base color */
  ringColor?: string;
  /** Ring opacity */
  ringOpacity?: number;
  /** Brightness multiplier — values above bloomThreshold trigger bloom */
  ringBrightness?: number;
  // ── Camera mouse parallax ────────────────────────────────────────────────
  /** Max angle (degrees) the camera drifts from center in each axis */
  camIntensity?: number;
  /** Spring stiffness — how fast camera accelerates toward target */
  camStiffness?: number;
  /** Spring damping — higher = smoother settle, lower = more overshoot */
  camDamping?: number;
  // ── Background gradient ───────────────────────────────────────────────────
  /** Inner (centre) color of the radial gradient background */
  bgColorCenter?: string;
  /** Mid-stop color of the radial gradient background */
  bgColorMid?: string;
  /** Outer (edge) color of the radial gradient background */
  bgColorEdge?: string;
  /** Duration of the entrance morph (particles flow from origin to model) */
  entranceMorphDur?: number;
  /** Duration of the entrance reform (maskContrast + glow fade back to normal) */
  entranceReformDur?: number;
  /** Increment to re-trigger the entrance animation */
  replayTrigger?: number;
}
