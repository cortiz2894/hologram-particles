"use client";

import { useEffect, useRef } from "react";
import {
  Scene,
  PerspectiveCamera,
  InstancedMesh,
  IcosahedronGeometry,
  CylinderGeometry,
  TorusGeometry,
  PlaneGeometry,
  InstancedBufferAttribute,
  Object3D,
  Group,
  Matrix3,
  Vector2,
  Vector3,
  Box3,
  Plane,
  Raycaster,
  Mesh,
  Color,
  DoubleSide,
  CanvasTexture,
  TextureLoader,
  RepeatWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
} from "three";
import {
  WebGPURenderer,
  MeshBasicNodeMaterial,
  PostProcessing,
} from "three/webgpu";
import {
  positionLocal,
  normalLocal,
  normalView,
  attribute,
  sin,
  cos,
  time,
  uniform,
  vec2,
  vec3,
  float,
  fract,
  positionWorld,
  normalize,
  dot,
  clamp,
  mix,
  pow,
  abs,
  smoothstep as tslSmoothstep,
  texture as tslTexture,
  uv,
  pass,
  mx_noise_float,
  mx_fractal_noise_vec3,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { chromaticAberration } from "three/addons/tsl/display/ChromaticAberrationNode.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Stats from "stats.js";

// ── Module-level geometry cache ───────────────────────────────────────────────
// Keyed by `url:particleCount` so models are pre-sampled once and reused for
// instant transitions.  When particleCount changes the main effect rebuilds
// everything, so stale entries are effectively ignored (they'll never be hit
// with a new count until they're re-populated by the preload effect).
type GeometryData = { positions: Float32Array; normals: Float32Array };
const geometryCache = new Map<string, GeometryData>();
// Track in-flight requests to avoid duplicate sampling when preload and
// a transition trigger the same URL simultaneously.
const geometryInflight = new Map<string, Promise<GeometryData>>();

function cacheKey(url: string, particleCount: number) {
  return `${url}:${particleCount}`;
}

async function sampleGLBGeometry(
  url: string,
  particleCount: number,
): Promise<GeometryData> {
  const key = cacheKey(url, particleCount);
  if (geometryCache.has(key)) return geometryCache.get(key)!;
  if (geometryInflight.has(key)) return geometryInflight.get(key)!;

  const promise = (async (): Promise<GeometryData> => {
    const gltf = await new GLTFLoader().loadAsync(url);

    // ── Normalise to a consistent bounding box ──────────────────────────
    // Step 1 — center to bbox center (handles any world-space offset)
    const bbox = new Box3().setFromObject(gltf.scene);
    const centre = new Vector3();
    bbox.getCenter(centre);
    gltf.scene.position.sub(centre);
    gltf.scene.updateMatrixWorld(true);

    // Step 2 — uniform scale so the largest dimension == 3 units
    const bbox2 = new Box3().setFromObject(gltf.scene);
    const sv = new Vector3();
    bbox2.getSize(sv);
    const maxDim = Math.max(sv.x, sv.y, sv.z);
    gltf.scene.scale.setScalar(maxDim > 0 ? 3 / maxDim : 1);
    gltf.scene.updateMatrixWorld(true);

    // Step 3 — shift so the BOTTOM of the bounding box sits at Y=0.
    // Different GLBs can have their pivot at different heights (some at the
    // mesh centroid, some at the floor, some exported with an arbitrary
    // offset).  Anchoring the bottom ensures every model "stands on the
    // same floor" and appears at the same Y position in the scene for a
    // given modelY value.
    const bbox3 = new Box3().setFromObject(gltf.scene);
    gltf.scene.position.y -= bbox3.min.y;
    gltf.scene.updateMatrixWorld(true);

    const meshes: Mesh[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gltf.scene.traverse((child: any) => {
      if ((child as Mesh).isMesh) meshes.push(child as Mesh);
    });

    const positions = new Float32Array(particleCount * 3);
    const normals = new Float32Array(particleCount * 3);
    const tempPos = new Vector3();
    const tempNorm = new Vector3();
    const normMatrix = new Matrix3();

    let filled = 0;
    const perMesh = Math.floor(particleCount / meshes.length);

    for (let m = 0; m < meshes.length; m++) {
      const mesh = meshes[m];
      const count = m < meshes.length - 1 ? perMesh : particleCount - filled;
      normMatrix.getNormalMatrix(mesh.matrixWorld);
      const sampler = new MeshSurfaceSampler(mesh).build();
      for (let i = 0; i < count; i++) {
        sampler.sample(tempPos, tempNorm);
        mesh.localToWorld(tempPos);
        tempNorm.applyMatrix3(normMatrix).normalize();
        const b = (filled + i) * 3;
        positions[b] = tempPos.x;
        positions[b + 1] = tempPos.y;
        positions[b + 2] = tempPos.z;
        normals[b] = tempNorm.x;
        normals[b + 1] = tempNorm.y;
        normals[b + 2] = tempNorm.z;
      }
      filled += count;
    }

    const data: GeometryData = { positions, normals };
    geometryCache.set(key, data);
    geometryInflight.delete(key);
    return data;
  })();

  geometryInflight.set(key, promise);
  return promise;
}

export interface ParticlesHologramProps {
  url: string;
  onLoaded?: () => void;
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
}

export default function ParticlesHologram({
  url,
  onLoaded,
  particleCount = 50_000,
  autoRotateSpeed = 0.8,
  color = "#8aa0b8",
  floatAmp = 0.01,
  sphereSize = 0.01,
  ambient = 0.31,
  wrap = 0.87,
  light1X = 0,
  light1Y = 4,
  light1Z = 0,
  light1Color = "#ffffff",
  light1Intensity = 1.0,
  light2X = 0,
  light2Y = -4,
  light2Z = 0,
  light2Color = "#4488ff",
  light2Intensity = 0.5,
  volumeStrength = 0.79,
  modelX = 0,
  modelY = 1.0,
  modelZ = 0,
  noiseAmp = 0.08,
  noiseScale = 0.6,
  noiseSpeed = 0.15,
  noiseGain = 0.5,
  maskScale = 0.4,
  maskSpeed = 0.04,
  maskContrast = 1.5,
  mouseRadius = 1.5,
  mouseStrength = 0.6,
  springStiffness = 5.0,
  springDamping = 3.0,
  pushStrength = 12.0,
  mouseScatter = 0.6,
  mouseGlowColor = "#ffffff",
  mouseGlowPassive = 0.0,
  mouseGlowActive = 1.5,
  mouseGlowPow = 2.0,
  mouseGlowDecay = 1.5,
  mouseLerp = 6.0,
  bloomStrength = 0.4,
  bloomRadius = 0.4,
  bloomThreshold = 0.1,
  chromaticStr = 0.0,
  preloadUrls = [] as string[],
  transitionDeformDur = 0.5,
  transitionMorphDur = 1.2,
  transitionReformDur = 0.7,
  transitionMaskContrast = 0.2,
  transitionGlowScale = 1.0,
  cylVisible = true,
  cylRadius = 1.8,
  cylHeight = 3.5,
  cylColor = "#88ccff",
  cylNoiseScale = 2.0,
  cylLineWidth = 0.08,
  cylFresnelPow = 2.0,
  cylBaseOpacity = 0.15,
  cylLineOpacity = 0.6,
  cylNoiseSpeed = 0.3,
  cylPulseSpeed = 0.8,
  cylPulseAmp = 0.4,
  cylPulseEasing = 2.5,
  cylWaveFreq = 2.0,
  cylTexRepeat = 3,
  cylY = 0,
  gridVisible = true,
  gridColor = "#c8d4de",
  gridBaseOpacity = 0.12,
  gridWaveAmp = 0.55,
  gridNoiseScale = 0.18,
  gridWaveSpeed = 0.07,
  gridDensity = 1.1,
  gridDotSize = 0.07,
  ringVisible = true,
  ringRadius = 1.95,
  ringThickness = 0.03,
  ringGap = 20,
  ringColor = "#ffffff",
  ringOpacity = 0.9,
  ringBrightness = 3.0,
  camIntensity = 12,
  camStiffness = 3.0,
  camDamping = 4.0,
  bgColorCenter = "#d2dde8",
  bgColorMid = "#a0b4c8",
  bgColorEdge = "#7a96aa",
}: ParticlesHologramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<Group | null>(null);
  const autoRotateSpeedRef = useRef(autoRotateSpeed);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniformsRef = useRef<Record<string, any> | null>(null);
  const springKRef = useRef(springStiffness);
  const springDampingRef = useRef(springDamping);
  const pushStrengthRef = useRef(pushStrength);
  const mouseScatterRef = useRef(mouseScatter);
  const mouseGlowDecayRef = useRef(mouseGlowDecay);
  const mouseLerpRef = useRef(mouseLerp);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bloomNodeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caUniformRef = useRef<any>(null);
  const cylMeshRef = useRef<Mesh | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cylUniRef = useRef<Record<string, any> | null>(null);
  const gridMeshRef = useRef<Mesh | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gridUniRef = useRef<Record<string, any> | null>(null);
  const ringRotGroupRef = useRef<Group | null>(null); // rotates with autoRotateSpeed
  const ringTopGroupRef = useRef<Group | null>(null); // positioned at cylinder top
  const ringBotGroupRef = useRef<Group | null>(null); // positioned at cylinder bottom
  const ring1Ref = useRef<Mesh | null>(null); // top arc 1
  const ring2Ref = useRef<Mesh | null>(null); // top arc 2
  const ring3Ref = useRef<Mesh | null>(null); // bottom arc 1
  const ring4Ref = useRef<Mesh | null>(null); // bottom arc 2
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ringUniRef = useRef<Record<string, any> | null>(null);
  const camIntensityRef = useRef(camIntensity);
  const camStiffnessRef = useRef(camStiffness);
  const camDampingRef = useRef(camDamping);
  const bgCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const bgTexRef = useRef<CanvasTexture | null>(null);
  const bgColorCenterRef = useRef(bgColorCenter);
  const bgColorMidRef = useRef(bgColorMid);
  const bgColorEdgeRef = useRef(bgColorEdge);

  const redrawBg = () => {
    const ctx = bgCtxRef.current;
    const tex = bgTexRef.current;
    if (!ctx || !tex) return;
    const { width, height } = ctx.canvas;
    const grad = ctx.createRadialGradient(
      width * 0.48,
      height * 0.45,
      0,
      width * 0.5,
      height * 0.5,
      width * 0.8,
    );
    grad.addColorStop(0, bgColorCenterRef.current);
    grad.addColorStop(0.45, bgColorMidRef.current);
    grad.addColorStop(1, bgColorEdgeRef.current);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    tex.needsUpdate = true;
  };

  // Tracks the user's current maskContrast so deform-in can restore it
  const maskContrastRef = useRef(maskContrast);
  // Transition timing/shape — read in the animate loop, updated by useEffects
  const transitionDeformDurRef = useRef(transitionDeformDur);
  const transitionMorphDurRef = useRef(transitionMorphDur);
  const transitionReformDurRef = useRef(transitionReformDur);
  const transitionMaskContrastRef = useRef(transitionMaskContrast);

  // ── Transition refs ───────────────────────────────────────────────────────
  const transitionStateRef = useRef<
    "idle" | "deform-out" | "morphing" | "deform-in"
  >("idle");
  const transitionTimeRef = useRef(0);
  const posAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const normAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const posAttrTargetRef = useRef<InstancedBufferAttribute | null>(null);
  const normAttrTargetRef = useRef<InstancedBufferAttribute | null>(null);
  const isFirstUrlRef = useRef(true);

  // ── Full re-init on url / particleCount change ────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId: number;
    let renderer: WebGPURenderer;
    let disposed = false;
    let cleanupInner: (() => void) | undefined;

    (async () => {
      // Renderer ────────────────────────────────────────────────────────────
      renderer = new WebGPURenderer({ antialias: true, alpha: true });
      await renderer.init();
      if (disposed) return;

      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
      container.appendChild(renderer.domElement);

      // Post-processing ─────────────────────────────────────────────────────
      // Must be created after renderer.init() since it needs the WebGPU device.
      // scene / camera are set up below so we build the pipeline at the end of
      // the async block (after the scene is fully built).
      let postProcessing: PostProcessing | null = null;

      // Stats ───────────────────────────────────────────────────────────────
      // const stats = new Stats();
      // stats.showPanel(0);
      // stats.dom.style.position = "absolute";
      // stats.dom.style.top = "0px";
      // stats.dom.style.left = "0px";
      // container.appendChild(stats.dom);

      // Scene / Camera ──────────────────────────────────────────────────────
      const scene = new Scene();

      // Radial gradient background — drawn on a canvas so PostProcessing
      // captures it correctly (CSS backgrounds are not visible through the
      // WebGPU PostProcessing output pass).
      {
        const bgCanvas = document.createElement("canvas");
        bgCanvas.width = bgCanvas.height = 512;
        const bgCtx = bgCanvas.getContext("2d")!;
        bgCtxRef.current = bgCtx;

        const bgTex = new CanvasTexture(bgCanvas);
        bgTexRef.current = bgTex;
        scene.background = bgTex;
        redrawBg();
      }

      // ── Dot grid background ───────────────────────────────────────────────
      // Full-screen plane placed far behind the scene.  The TSL shader draws
      // a regular dot grid and animates brightness with a drifting noise wave.
      // renderOrder = -1 + depthTest = false  →  always renders behind everything.
      {
        // Oversized plane so any camera XY offset stays covered
        const gridGeo = new PlaneGeometry(50, 32);
        const gridMat = new MeshBasicNodeMaterial() as any;
        gridMat.transparent = true;
        gridMat.depthWrite = false;
        // depthTest ON — the hologram particles are opaque and write depth at
        // Z≈0.  The grid plane sits at Z=−5 (further from camera), so its depth
        // test fails wherever the hologram or cylinder are present → they always
        // appear in front of the dots without any manual renderOrder tricks.
        gridMat.depthTest = true;

        const uGridColor = uniform(new Color(gridColor));
        const uGridBaseOpacity = uniform(gridBaseOpacity);
        const uGridWaveAmp = uniform(gridWaveAmp);
        const uGridNoiseScale = uniform(gridNoiseScale);
        const uGridWaveSpeed = uniform(gridWaveSpeed);
        const uGridDensity = uniform(gridDensity);
        const uGridDotSize = uniform(gridDotSize);

        // Grid: divide world-XY into cells of size 1/density.
        // Within each cell, compute distance to the cell centre.
        const cellPos = positionWorld.xy.mul(uGridDensity);
        const fracCell = fract(cellPos).sub(vec2(0.5, 0.5));
        const dotDist = fracCell.length();
        const dotShape = float(1).sub(
          tslSmoothstep(float(0), uGridDotSize, dotDist),
        );

        // Wave: drifting 3-D noise — X/Y are spatial, Z scrolls with time.
        // Result is a slow organic illumination wave rolling across the grid.
        const noiseCoord = vec3(
          positionWorld.x.mul(uGridNoiseScale),
          positionWorld.y.mul(uGridNoiseScale),
          time.mul(uGridWaveSpeed),
        );
        const wave = mx_noise_float(noiseCoord).mul(float(0.5)).add(float(0.5));

        // Drive COLOR brightness with the wave — not just opacity.
        // This lets wave crests exceed 1.0 and trigger the bloom pass,
        // making the illumination clearly visible against the background.
        // uGridBaseOpacity = dim floor · uGridWaveAmp can be > 1 for bloom.
        const waveBrightness = uGridBaseOpacity.add(wave.mul(uGridWaveAmp));
        gridMat.colorNode = uGridColor.mul(waveBrightness);
        gridMat.opacityNode = dotShape; // dot shape is a solid mask — no fade

        const gridMesh = new Mesh(gridGeo, gridMat);
        gridMesh.position.z = -5;
        gridMesh.renderOrder = -1;
        scene.add(gridMesh);

        gridMeshRef.current = gridMesh;
        gridUniRef.current = {
          uGridColor,
          uGridBaseOpacity,
          uGridWaveAmp,
          uGridNoiseScale,
          uGridWaveSpeed,
          uGridDensity,
          uGridDotSize,
          gridMat,
        };
      }

      const camera = new PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        0.1,
        200,
      );
      camera.position.set(0, 0, 6);

      // Orbit Controls ──────────────────────────────────────────────────────
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enabled = false;
      controls.autoRotate = false;
      controlsRef.current = controls;

      // Load + sample initial GLB ───────────────────────────────────────────
      const { positions, normals } = await sampleGLBGeometry(
        url,
        particleCount,
      );
      if (disposed) return;

      // Per-sphere random seeds (stay fixed through model swaps so particle
      // identities remain consistent and scatter directions are stable).
      const seeds = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i++) seeds[i] = Math.random();

      // Sphere geometry with per-instance attributes ─────────────────────────
      // Detail 0 = 20 faces / 12 vertices per sphere (vs 80 faces / 42 at detail 1).
      // At small sphere sizes the difference is invisible, ~3.5× fewer VS invocations.
      const sphereGeo = new IcosahedronGeometry(1, 0);
      sphereGeo.setAttribute(
        "instanceSeed",
        new InstancedBufferAttribute(seeds, 1),
      );
      // .slice() — buffer gets its own copy; cache keeps its original array so
      // writing new model data during transitions never corrupts cached geometry.
      sphereGeo.setAttribute(
        "instanceNormal",
        new InstancedBufferAttribute(normals.slice(), 3),
      );
      sphereGeo.setAttribute(
        "instancePos",
        new InstancedBufferAttribute(positions.slice(), 3),
      );
      // Target attributes start identical to current — transitionProgress=0
      // means blendPos = instPos so no visual difference on first render.
      sphereGeo.setAttribute(
        "instanceNormalTarget",
        new InstancedBufferAttribute(normals.slice(), 3),
      );
      sphereGeo.setAttribute(
        "instancePosTarget",
        new InstancedBufferAttribute(positions.slice(), 3),
      );

      // Sphere positioning is done entirely in the shader via instancePos/blendPos,
      // so instance matrices can stay as identity — no per-instance matrix loop needed.
      const instancedMesh = new InstancedMesh(
        sphereGeo,
        null as any,
        particleCount,
      );
      instancedMesh.instanceMatrix.needsUpdate = true;

      // Store buffer refs for transition swaps
      posAttrRef.current = sphereGeo.getAttribute(
        "instancePos",
      ) as InstancedBufferAttribute;
      normAttrRef.current = sphereGeo.getAttribute(
        "instanceNormal",
      ) as InstancedBufferAttribute;
      posAttrTargetRef.current = sphereGeo.getAttribute(
        "instancePosTarget",
      ) as InstancedBufferAttribute;
      normAttrTargetRef.current = sphereGeo.getAttribute(
        "instanceNormalTarget",
      ) as InstancedBufferAttribute;
      transitionStateRef.current = "idle";
      transitionTimeRef.current = 0;

      // TSL uniforms ────────────────────────────────────────────────────────
      const u = {
        color: uniform(new Color(color)),
        floatAmp: uniform(floatAmp),
        sphereSize: uniform(sphereSize),
        ambient: uniform(ambient),
        wrap: uniform(wrap),
        light1Pos: uniform(new Vector3(light1X, light1Y, light1Z)),
        light1Color: uniform(new Color(light1Color)),
        light1Intensity: uniform(light1Intensity),
        light2Pos: uniform(new Vector3(light2X, light2Y, light2Z)),
        light2Color: uniform(new Color(light2Color)),
        light2Intensity: uniform(light2Intensity),
        volumeStrength: uniform(volumeStrength),
        noiseAmp: uniform(noiseAmp),
        noiseScale: uniform(noiseScale),
        noiseSpeed: uniform(noiseSpeed),
        noiseGain: uniform(noiseGain),
        maskScale: uniform(maskScale),
        maskSpeed: uniform(maskSpeed),
        maskContrast: uniform(maskContrast),
        // Mouse interaction
        mousePos: uniform(new Vector3()),
        mouseVel: uniform(new Vector3()),
        mouseRadius: uniform(mouseRadius),
        mouseStrength: uniform(mouseStrength),
        mouseScatter: uniform(mouseScatter),
        mouseGlowColor: uniform(new Color(mouseGlowColor)),
        mouseGlowPassive: uniform(mouseGlowPassive),
        mouseGlowActive: uniform(mouseGlowActive),
        mouseGlowPow: uniform(mouseGlowPow),
        mouseGlowEnergy: uniform(0), // JS-side decaying glow energy, independent of spring
        transitionProgress: uniform(0), // 0 = current model, 1 = target model
        transitionGlowScale: uniform(transitionGlowScale),
      };
      uniformsRef.current = u;

      // TSL material ────────────────────────────────────────────────────────
      const material = new MeshBasicNodeMaterial() as any;

      const seedAttr = attribute("instanceSeed", "float");
      const instNorm = attribute("instanceNormal", "vec3");
      const instPos = attribute("instancePos", "vec3");
      const instNormTgt = attribute("instanceNormalTarget", "vec3");
      const instPosTgt = attribute("instancePosTarget", "vec3");

      // Smoothly blend sphere centres and normals between current and target model.
      // Instance matrices are identity — the centre position is fully in the shader.
      const blendPos = mix(instPos, instPosTgt, u.transitionProgress);
      const blendNorm = normalize(
        mix(instNorm, instNormTgt, u.transitionProgress),
      );

      const phase = seedAttr.mul(Math.PI * 2);

      // ── Animation ────────────────────────────────────────────────────────
      //
      // Three layers are combined:
      //
      //  1. Individual float — per-sphere sin/cos oscillation using random seed.
      //     Gives organic micro-vibration everywhere.
      //
      //  2. Noise flow — fractal noise field scrolls over time, sampled at the
      //     sphere centre so the whole sphere moves rigidly.  Nearby spheres
      //     get similar displacements → coherent waves.
      //
      //  3. Instability mask — a second, slower noise field modulates the wave
      //     amplitude per sphere.  Some regions of the figure stay calm while
      //     others break apart.  The mask itself drifts slowly so the unstable
      //     zones travel across the figure over time.

      // 1. Individual float (micro)
      const floatDisp = vec3(
        cos(time.mul(1.3).add(phase)).mul(u.floatAmp).mul(0.6),
        sin(time.mul(1.6).add(phase)).mul(u.floatAmp),
        sin(time.mul(1.1).add(phase.add(1.0)))
          .mul(u.floatAmp)
          .mul(0.6),
      );

      // 3. Instability mask — slow independent noise field, different axes so
      //    it doesn't correlate with the wave field.
      const maskCoord = blendPos
        .mul(u.maskScale)
        .add(
          vec3(
            time.mul(u.maskSpeed),
            time.mul(u.maskSpeed).mul(0.7),
            time.mul(u.maskSpeed).mul(1.3),
          ),
        );
      // Single-octave noise (no fractal loop) — sufficient for a smooth mask.
      const rawMask = mx_noise_float(maskCoord);
      const mask = pow(
        clamp(rawMask.mul(0.5).add(0.5), float(0), float(1)),
        u.maskContrast,
      );

      // 2. Noise flow (macro waves) — amplitude scaled by the mask so only
      //    regions with high mask value are visibly displaced.
      const noiseCoord = blendPos
        .mul(u.noiseScale)
        .add(
          vec3(
            time.mul(u.noiseSpeed),
            float(0),
            time.mul(u.noiseSpeed).mul(0.7),
          ),
        );

      const noiseDisp = mx_fractal_noise_vec3(noiseCoord, 2, 2.0, u.noiseGain)
        .mul(u.noiseAmp)
        .mul(mask);

      // 4. Mouse displacement — filled-circle shape.
      //
      //    Root cause of the ring/donut artefact: using "attract toward cursor"
      //    (dragDir = normalize(toMouse)) pulls all nearby particles to the same
      //    point.  Particles at the centre are already there and don't move;
      //    particles at medium distance converge, leaving a void in the middle →
      //    ring shape.
      //
      //    Fix: base direction is velDir (travel direction), not attraction.
      //    Every particle in the radius gets the SAME displacement direction →
      //    filled disc.  Scatter adds per-particle variation (cone around velDir)
      //    without breaking the filled-circle silhouette.
      const toMouse = u.mousePos.sub(blendPos);
      const dist = toMouse.length();
      const falloff = clamp(
        float(1.0).sub(dist.div(u.mouseRadius)),
        float(0),
        float(1),
      );
      const impulseLen = u.mouseVel.length();
      // Travel direction — the cone axis and primary push direction
      const velDir = normalize(u.mouseVel.add(vec3(0.0001, 0.0001, 0.0001)));
      // Per-particle unit vector on the sphere (normalised → circular, not cubic)
      const rawRand = vec3(
        sin(seedAttr.mul(127.1)),
        cos(seedAttr.mul(311.7)),
        sin(seedAttr.mul(74.3).add(1.0)),
      );
      const randUnit = normalize(rawRand);
      // Perpendicular-to-velocity disc scatter → cone opening around velDir
      const onAxis = velDir.mul(dot(randUnit, velDir));
      const perpToVel = normalize(randUnit.sub(onAxis).add(vec3(0, 0.0001, 0)));
      // velDir is the base (filled circle); perpToVel scatter widens the cone
      const mouseDisp = velDir
        .add(perpToVel.mul(u.mouseScatter))
        .mul(impulseLen)
        .mul(u.mouseStrength)
        .mul(falloff.mul(falloff));

      // blendPos is the sphere centre (instance matrices are identity).
      // positionLocal * sphereSize is the tiny icosahedron offset around the centre.
      material.positionNode = positionLocal
        .mul(u.sphereSize)
        .add(blendPos)
        .add(floatDisp)
        .add(noiseDisp)
        .add(mouseDisp);

      // ── Shading: two-light model with figure + sphere volume ─────────────
      //
      // Each light has a world-space position, color, and intensity.
      // Direction is computed per-particle: normalize(lightPos - blendPos).
      // Both lights use wrapped diffuse and are summed before the ambient floor.

      const lightContrib = (lightPos: any, lightCol: any, lightInt: any) => {
        const dir = normalize(lightPos.sub(blendPos));
        const figW = clamp(
          dot(blendNorm, dir).add(u.wrap).div(float(1.0).add(u.wrap)),
          float(0),
          float(1),
        );
        const sphW = clamp(
          dot(normalize(normalLocal), dir)
            .add(u.wrap)
            .div(float(1.0).add(u.wrap)),
          float(0),
          float(1),
        );
        const diffuse = mix(figW, figW.mul(sphW), u.volumeStrength);
        return lightCol.mul(diffuse).mul(lightInt);
      };

      const litColor = lightContrib(
        u.light1Pos,
        u.light1Color,
        u.light1Intensity,
      ).add(lightContrib(u.light2Pos, u.light2Color, u.light2Intensity));

      // Combine with base particle color, add ambient floor
      const shadedColor = u.color.mul(
        clamp(litColor.add(u.ambient), float(0), float(1)),
      );

      // ── Mouse glow — two independent layers ──────────────────────────────
      //
      //  Passive  — proximity only, visible even when the cursor is still.
      //             Useful for a subtle "torch" effect around the cursor.
      //
      //  Active   — driven by impulse magnitude, only visible while particles
      //             are being displaced.  Creates the bright flash-trail.
      //
      //  Both share the same glow color and falloff curve (mouseGlowPow).
      //  glowPow > 1 concentrates brightness toward the cursor centre.
      const glowFalloff = pow(
        clamp(falloff, float(0), float(1)),
        u.mouseGlowPow,
      );
      const passiveGlow = glowFalloff.mul(u.mouseGlowPassive);
      // Active glow uses mouseGlowEnergy — a JS-side value that decays at its
      // own rate, independently of the spring physics.  This lets the glow
      // linger as a smooth trail even after particles have physically returned.
      const activeGlow = glowFalloff
        .mul(u.mouseGlowEnergy)
        .mul(u.mouseGlowActive);
      const mouseGlowFactor = clamp(
        passiveGlow.add(activeGlow),
        float(0),
        float(1),
      );

      // ── Transition glow — particles with greatest displacement bloom the most ──
      //
      // morphActivity is a parabola over transitionProgress: peaks at mid-morph
      // (p=0.5 → value=1) and is 0 at the start and end.  This means the bloom
      // builds as particles start moving and fades as they settle.
      //
      // dispMag normalises each particle's travel distance (source→target) so
      // far-travelling particles glow brightest.  Scale 0.35 → fully lit at ~3u.
      const morphActivity = u.transitionProgress
        .mul(float(1).sub(u.transitionProgress))
        .mul(float(4));
      const transDispMag = instPosTgt.sub(instPos).length();
      const transNorm = clamp(
        transDispMag.mul(float(0.35)),
        float(0),
        float(1),
      );
      const transGlow = transNorm.mul(morphActivity).mul(u.transitionGlowScale);

      const glowFactor = clamp(
        mouseGlowFactor.add(transGlow),
        float(0),
        float(1),
      );
      material.colorNode = mix(shadedColor, u.mouseGlowColor, glowFactor);

      instancedMesh.material = material;

      // Two-group hierarchy:
      //   posGroup  — world position (modelX/Y/Z), no rotation
      //   rotGroup  — Y-axis auto-rotation, child of posGroup, holds particles
      //
      // The cylinder lives in posGroup so it shares the same position offset
      // but is NOT affected by rotGroup's rotation — it stays fixed in world space.
      const posGroup = new Group();
      posGroup.position.set(modelX, modelY, modelZ);
      const rotGroup = new Group();
      rotGroup.add(instancedMesh);
      posGroup.add(rotGroup);

      // ── Transparent cylinder ──────────────────────────────────────────────
      // Open-ended cylinder enclosing the hologram; bottom sits at Y=0 (matching
      // the GLB bbox-bottom normalisation) so all models fit inside consistently.
      // Added to posGroup so it moves with the model but never rotates.
      const cylGeo = new CylinderGeometry(
        cylRadius,
        cylRadius,
        cylHeight,
        64,
        1,
        true,
      );
      const cylMat = new MeshBasicNodeMaterial() as any;
      cylMat.transparent = true;
      cylMat.side = DoubleSide;
      cylMat.depthWrite = false;

      const uCylColor = uniform(new Color(cylColor));
      const uCylNoiseScale = uniform(cylNoiseScale);
      const uCylLineWidth = uniform(cylLineWidth);
      const uCylFresnelPow = uniform(cylFresnelPow);
      const uCylBaseOpacity = uniform(cylBaseOpacity);
      const uCylLineOpacity = uniform(cylLineOpacity);
      const uCylNoiseSpeed = uniform(cylNoiseSpeed);
      const uCylPulseSpeed = uniform(cylPulseSpeed);
      const uCylPulseAmp = uniform(cylPulseAmp);
      const uCylPulseEasing = uniform(cylPulseEasing);
      const uCylWaveFreq = uniform(cylWaveFreq);
      const uCylTexRepeat = uniform(cylTexRepeat);

      // Triangle texture — white lines on dark background.
      // loadAsync ensures the image is fully decoded before we touch any
      // sampler properties; setting needsUpdate on a null image crashes WebGPU.
      const triTex = await new TextureLoader().loadAsync(
        "/assets/triangle-texture.png",
      );
      if (disposed) return;
      triTex.wrapS = triTex.wrapT = RepeatWrapping;
      triTex.magFilter = LinearFilter;
      triTex.minFilter = LinearMipmapLinearFilter;
      triTex.generateMipmaps = true;
      triTex.anisotropy = 16;
      triTex.needsUpdate = true;

      // Fresnel rim — bright at grazing angles (edges of cylinder), dark when
      // surface directly faces the camera.  abs() handles back-face normals.
      const NdotV = abs(normalView.z);
      const fresnelRim = pow(
        clamp(float(1).sub(NdotV), float(0), float(1)),
        uCylFresnelPow,
      );

      // Animated noise coords — two separate time offsets so the two frequencies
      // drift independently, giving a more organic crystalline feel.
      const cylTimeOff1 = vec3(
        time.mul(uCylNoiseSpeed),
        float(0),
        time.mul(uCylNoiseSpeed).mul(float(0.7)),
      );
      const cylTimeOff2 = vec3(
        float(0),
        time.mul(uCylNoiseSpeed).mul(float(0.5)),
        time.mul(uCylNoiseSpeed).mul(float(1.3)),
      );

      // Two-frequency noise zero-crossings create a crystalline mesh pattern.
      // At zero-crossings, abs(noise) ≈ 0 → 1 - smoothstep(...) ≈ 1 (bright line).
      const cylP1 = positionLocal.mul(uCylNoiseScale).add(cylTimeOff1);
      const cylP2 = positionLocal
        .mul(uCylNoiseScale.mul(float(1.87)))
        .add(vec3(17.3, 5.7, 23.1))
        .add(cylTimeOff2);
      const cylLine1 = float(1).sub(
        tslSmoothstep(float(0), uCylLineWidth, abs(mx_noise_float(cylP1))),
      );
      const cylLine2 = float(1).sub(
        tslSmoothstep(float(0), uCylLineWidth, abs(mx_noise_float(cylP2))),
      );
      const cylLinePat = clamp(cylLine1.add(cylLine2), float(0), float(1));

      // Traveling wave pulse — the sine phase is offset by positionLocal.y so
      // each height on the cylinder is at a different point in the cycle.
      // Result: a bright ring that sweeps up the cylinder continuously.
      // Easing (pow) sharpens the ring into a thin crisp band; at easing=1 the
      // ring is wide and soft, at higher values it becomes a narrow bright flash.
      const cylPhase = time
        .mul(uCylPulseSpeed)
        .sub(positionLocal.y.mul(uCylWaveFreq));
      const cylSineRaw = sin(cylPhase).mul(float(0.5)).add(float(0.5));
      const cylPulse = pow(cylSineRaw, uCylPulseEasing);
      const cylPulsedLineOp = uCylLineOpacity.mul(
        float(1).sub(uCylPulseAmp).add(uCylPulseAmp.mul(cylPulse)),
      );

      // Triangle texture sampled at tiled cylinder UVs.
      // .r channel holds the brightness: white triangle lines → 1, dark bg → 0.
      // This brightness is used as a detail mask — it makes the dark parts of the
      // texture fully transparent and only shows the white triangle geometry.
      const cylTexUV = uv().mul(uCylTexRepeat);
      const texBright = tslTexture(triTex, cylTexUV).r;

      // Final opacity layers:
      //   detail  = triangle texture × noise-line mask × Fresnel × pulsed opacity
      //             → triangles visible only inside noise-line bands, at rim edges
      //   rim     = subtle Fresnel base glow with no texture/noise requirement
      const detailOp = texBright
        .mul(cylLinePat)
        .mul(fresnelRim)
        .mul(cylPulsedLineOp);
      const cylFinalOp = clamp(
        fresnelRim.mul(uCylBaseOpacity).add(detailOp),
        float(0),
        float(1),
      );

      cylMat.colorNode = uCylColor;
      cylMat.opacityNode = cylFinalOp;

      const cylMesh = new Mesh(cylGeo, cylMat);
      cylMesh.position.set(0, cylHeight / 2 + cylY, 0);
      cylMesh.visible = cylVisible;
      posGroup.add(cylMesh);
      cylMeshRef.current = cylMesh;
      cylUniRef.current = {
        uCylColor,
        uCylNoiseScale,
        uCylLineWidth,
        uCylFresnelPow,
        uCylBaseOpacity,
        uCylLineOpacity,
        uCylNoiseSpeed,
        uCylPulseSpeed,
        uCylPulseAmp,
        uCylPulseEasing,
        uCylWaveFreq,
        uCylTexRepeat,
      };

      // ── Halo rings — top + bottom, rotating with autoRotateSpeed ─────────
      //
      // TorusGeometry lies in the XY plane → rotation.x = -PI/2 makes it flat.
      // Arc positioning around Y uses a wrapper Group so the two rotations
      // stay independent (no Euler coupling).
      //
      // Both top and bottom ring groups live inside ringRotGroup, which spins
      // at the same rate as the particle rotGroup in the animate loop.
      {
        const gapRad = ringGap * (Math.PI / 180);
        const arcSpan = Math.PI - gapRad;

        const makeRingGeo = () =>
          new TorusGeometry(ringRadius, ringThickness, 8, 80, arcSpan);

        const ringMat = new MeshBasicNodeMaterial() as any;
        ringMat.transparent = true;
        ringMat.depthWrite = false;
        ringMat.side = DoubleSide;

        const uRingColor = uniform(new Color(ringColor));
        const uRingOpacity = uniform(ringOpacity);
        const uRingBrightness = uniform(ringBrightness);
        ringMat.colorNode = uRingColor.mul(uRingBrightness);
        ringMat.opacityNode = uRingOpacity;

        const makeArcPair = (): [Mesh, Mesh, Group, Group] => {
          const m1 = new Mesh(makeRingGeo(), ringMat);
          m1.rotation.x = -Math.PI / 2;
          const m2 = new Mesh(makeRingGeo(), ringMat);
          m2.rotation.x = -Math.PI / 2;
          const wA = new Group();
          wA.rotation.y = gapRad / 2;
          wA.add(m1);
          const wB = new Group();
          wB.rotation.y = Math.PI + gapRad / 2;
          wB.add(m2);
          return [m1, m2, wA, wB];
        };

        const [r1, r2, w1, w2] = makeArcPair();
        const topGroup = new Group();
        topGroup.position.y = cylHeight + cylY;
        topGroup.add(w1, w2);

        const [r3, r4, w3, w4] = makeArcPair();
        const botGroup = new Group();
        botGroup.position.y = cylY;
        botGroup.add(w3, w4);

        const ringRotGroup = new Group();
        ringRotGroup.add(topGroup, botGroup);
        ringRotGroup.visible = ringVisible;
        posGroup.add(ringRotGroup);

        ringRotGroupRef.current = ringRotGroup;
        ringTopGroupRef.current = topGroup;
        ringBotGroupRef.current = botGroup;
        ring1Ref.current = r1;
        ring2Ref.current = r2;
        ring3Ref.current = r3;
        ring4Ref.current = r4;
        ringUniRef.current = {
          uRingColor,
          uRingOpacity,
          uRingBrightness,
          ringMat,
          w1,
          w2,
          w3,
          w4,
        };
      }

      scene.add(posGroup);
      groupRef.current = posGroup;
      onLoaded?.();

      // ── Post-processing pipeline ──────────────────────────────────────────
      //
      //  scenePass renders the scene to a texture, then:
      //    bloom   — brightens pixels above the threshold, spreads the glow
      //    CA      — RGB fringe toward screen edges for a lens-like look
      //
      //  Pattern: postProcessing.outputNode = sceneColor.add(bloomPass)
      //  The CA node wraps the combined output.
      {
        const pp = new PostProcessing(renderer);
        const scenePass = pass(scene, camera);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sceneColor = (scenePass as any).getTextureNode("output");

        const bloomPass = bloom(
          sceneColor,
          bloomStrength,
          bloomRadius,
          bloomThreshold,
        );
        bloomNodeRef.current = bloomPass;

        const caStrengthU = uniform(chromaticStr);
        caUniformRef.current = caStrengthU;

        const combined = sceneColor.add(bloomPass);
        const caPass = chromaticAberration(
          combined,
          caStrengthU,
          new Vector2(0.5, 0.5),
        );

        pp.outputNode = caPass;
        postProcessing = pp;
      }

      const onResize = () => {
        if (disposed || !container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener("resize", onResize);

      // Mouse interaction ────────────────────────────────────────────────────
      // Spring-damper model:
      //
      //  • impulse  — spring displacement fed into the shader as mouseVel.
      //  • impVel   — velocity of the spring (how fast displacement is changing).
      //
      //  Each frame:
      //    spring force  = -k  * impulse   (restoring force toward zero)
      //    damping force = -c  * impVel    (resistance against motion)
      //    impVel       += (spring + damp) * delta
      //
      //  While mouse is moving, pushStrength drives impVel proportional to the
      //  smoothed frame velocity — this is the "kick" from the user.
      //
      //  Critical damping: c = 2√k ≈ 5.66 at k=8 → no oscillation.
      //  Underdamped (c < 2√k): springy water-like rebound.
      const raycaster = new Raycaster();
      const mouseNDC = new Vector2();
      // Camera-facing plane — updated every frame so interaction works from any
      // orbit angle.  Passes through the model's world centre.
      const mousePlane = new Plane();
      const mouseHit = new Vector3();
      const modelCenter = new Vector3();
      const cameraDir = new Vector3();
      // targetMousePos: raw cursor position in model-local space (set on mousemove)
      // smoothMousePos: exponentially-smoothed virtual cursor (chases target with lag)
      const targetMousePos = new Vector3();
      const smoothMousePos = new Vector3();
      const prevMousePos = new Vector3();
      const frameVel = new Vector3();
      // smoothVel: exponentially-smoothed frame velocity (plain Vector3)
      // impVel:    spring velocity
      // impulse:   spring displacement → fed to shader as mouseVel
      const smoothVel = new Vector3();
      const impVel = new Vector3();
      const impulse = new Vector3();
      let glowEnergy = 0; // decays independently of the spring
      let lastFrameTime = performance.now();
      let mouseMoving = false;
      // Camera parallax spring — XY translation + Z roll
      const CAM_RADIUS = camera.position.z;
      let camX = 0,
        camY = 0,
        camRoll = 0; // current state
      let camVelX = 0,
        camVelY = 0,
        camVelRoll = 0; // spring velocities
      let moveTimer = 0;
      const MOVE_TIMEOUT = 0.06;
      let mouseEverMoved = false;
      // Smoothstep: slow start → fast middle → slow end — cinematic easing
      const smoothstep = (p: number) => p * p * (3 - 2 * p);

      const onMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouseNDC.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(mouseNDC, camera);
        if (raycaster.ray.intersectPlane(mousePlane, mouseHit)) {
          // Convert world hit → rotGroup-local space.
          // instPos coords live in the rotGroup's local frame, so we must
          // undo both the posGroup translation and the rotGroup rotation.
          const localPos = mouseHit
            .clone()
            .sub(posGroup.position)
            .applyQuaternion(rotGroup.quaternion.clone().invert());
          targetMousePos.copy(localPos);
          // Initialise smooth position on first move to avoid a startup snap
          if (!mouseEverMoved) {
            smoothMousePos.copy(localPos);
            prevMousePos.copy(localPos);
            mouseEverMoved = true;
          }
        }
        mouseMoving = true;
        moveTimer = 0;
      };

      const onMouseLeave = () => {
        mouseMoving = false;
      };

      container.addEventListener("mousemove", onMouseMove);
      container.addEventListener("mouseleave", onMouseLeave);

      const animate = () => {
        if (disposed) return;
        animId = requestAnimationFrame(animate);

        const now = performance.now();
        const delta = Math.min((now - lastFrameTime) / 1000, 0.1);
        lastFrameTime = now;

        moveTimer += delta;
        if (moveTimer > MOVE_TIMEOUT) mouseMoving = false;

        // ── Model transition state machine ────────────────────────────────
        //
        //  deform-out — maskContrast → 0.2 (current model deforms into noise)
        //  morphing   — transitionProgress 0→1 (particles flow to new model,
        //               both shapes still deformed at maskContrast=0.2)
        //  deform-in  — maskContrast 0.2 → user value (new model reforms)
        const tState = transitionStateRef.current;

        if (tState === "deform-out") {
          transitionTimeRef.current += delta;
          const p = Math.min(
            transitionTimeRef.current / transitionDeformDurRef.current,
            1,
          );
          const tmc = transitionMaskContrastRef.current;
          u.maskContrast.value =
            maskContrastRef.current +
            (tmc - maskContrastRef.current) * smoothstep(p);
          if (p >= 1) {
            u.maskContrast.value = tmc;
            transitionTimeRef.current = 0;
            transitionStateRef.current = "morphing";
          }
        } else if (tState === "morphing") {
          transitionTimeRef.current += delta;
          const p = Math.min(
            transitionTimeRef.current / transitionMorphDurRef.current,
            1,
          );
          u.transitionProgress.value = smoothstep(p);
          if (p >= 1) {
            // Commit target → current so the next transition starts from here
            const srcPos = posAttrRef.current!.array as Float32Array;
            const tgtPos = posAttrTargetRef.current!.array as Float32Array;
            const srcNorm = normAttrRef.current!.array as Float32Array;
            const tgtNorm = normAttrTargetRef.current!.array as Float32Array;
            srcPos.set(tgtPos);
            srcNorm.set(tgtNorm);
            posAttrRef.current!.needsUpdate = true;
            normAttrRef.current!.needsUpdate = true;
            u.transitionProgress.value = 0;
            transitionTimeRef.current = 0;
            transitionStateRef.current = "deform-in";
          }
        } else if (tState === "deform-in") {
          transitionTimeRef.current += delta;
          const p = Math.min(
            transitionTimeRef.current / transitionReformDurRef.current,
            1,
          );
          const tmc = transitionMaskContrastRef.current;
          u.maskContrast.value =
            tmc + (maskContrastRef.current - tmc) * smoothstep(p);
          if (p >= 1) {
            u.maskContrast.value = maskContrastRef.current;
            transitionStateRef.current = "idle";
          }
        }

        // Manual Y rotation — replaces OrbitControls.autoRotate so only the
        // particle mesh (rotGroup) spins while the cylinder stays fixed.
        // Speed mapping matches OrbitControls convention: 1.0 ≈ one full
        // rotation every 60 s  ( 2π / 60 rad·s⁻¹ per unit of speed ).
        const rotDelta =
          ((2 * Math.PI) / 60) * autoRotateSpeedRef.current * delta;
        rotGroup.rotation.y += rotDelta;
        if (ringRotGroupRef.current)
          ringRotGroupRef.current.rotation.y += rotDelta;

        // Keep the projection plane perpendicular to the current camera view,
        // centred on the model — works correctly from any orbit angle.
        posGroup.getWorldPosition(modelCenter);
        camera.getWorldDirection(cameraDir);
        mousePlane.setFromNormalAndCoplanarPoint(cameraDir, modelCenter);

        // ── Smooth mouse position (momentum / lerp) ────────────────────────
        // Exponential smoothing: alpha = 1 - exp(-speed * dt) gives a
        // frame-rate-independent lerp.  Low mouseLerp = heavy inertia/lag,
        // high = near-instant follow.
        if (mouseEverMoved) {
          const alpha = 1 - Math.exp(-mouseLerpRef.current * delta);
          smoothMousePos.lerp(targetMousePos, alpha);
          u.mousePos.value.copy(smoothMousePos);
        }

        if (mouseMoving) {
          // Velocity derived from the SMOOTHED position so fast flicks don't
          // spike — the lag itself becomes the "drag" feel.
          frameVel
            .subVectors(smoothMousePos, prevMousePos)
            .divideScalar(Math.max(delta, 0.001))
            .clampLength(0, 8.0);
          // Smooth toward frame velocity (low lerp = more inertia)
          smoothVel.lerp(frameVel, 0.15);
        } else {
          smoothVel.multiplyScalar(0.85);
        }

        // ── Spring-damper integration ──────────────────────────────────────
        // F = -k * x  -  c * v
        const k = springKRef.current;
        const c = springDampingRef.current;

        // Apply spring + damping forces to spring velocity
        impVel.x += (-k * impulse.x - c * impVel.x) * delta;
        impVel.y += (-k * impulse.y - c * impVel.y) * delta;
        impVel.z += (-k * impulse.z - c * impVel.z) * delta;

        // Mouse push: drive spring velocity with current smoothed mouse velocity
        if (mouseMoving) {
          const push = pushStrengthRef.current;
          impVel.x += smoothVel.x * push * delta;
          impVel.y += smoothVel.y * push * delta;
          impVel.z += smoothVel.z * push * delta;
        }

        // Integrate displacement
        impulse.x += impVel.x * delta;
        impulse.y += impVel.y * delta;
        impulse.z += impVel.z * delta;
        impulse.clampLength(0, 3.5);

        // Write to uniform via .copy() — safe with TSL reactive proxies
        u.mouseVel.value.copy(impulse);
        prevMousePos.copy(smoothMousePos);

        // ── Glow energy — independent decay ───────────────────────────────
        // Snap up whenever the spring impulse grows, then decay at its own
        // rate.  Decoupling from the spring lets the glow linger as a smooth
        // after-image even after particles have physically sprung back.
        const currentImpulse = impulse.length();
        if (currentImpulse > glowEnergy) glowEnergy = currentImpulse;
        glowEnergy *= Math.exp(-mouseGlowDecayRef.current * delta);
        u.mouseGlowEnergy.value = glowEnergy;

        // ── Camera parallax spring ────────────────────────────────────────
        // Mouse X/Y → camera translates on world X/Y.
        // Mouse X   → camera rolls on its local Z axis (tilt).
        // Spring-damper gives momentum + smooth settle.
        {
          const intensity = camIntensityRef.current;
          const k = camStiffnessRef.current;
          const c = camDampingRef.current;
          const nx = mouseEverMoved ? mouseNDC.x : 0;
          const ny = mouseEverMoved ? mouseNDC.y : 0;
          const targetX = nx * intensity * 0.05;
          const targetY = ny * intensity * 0.05;
          const targetRoll = -nx * intensity * 0.008; // negative: tilt toward motion
          camVelX += ((targetX - camX) * k - camVelX * c) * delta;
          camVelY += ((targetY - camY) * k - camVelY * c) * delta;
          camVelRoll += ((targetRoll - camRoll) * k - camVelRoll * c) * delta;
          camX += camVelX * delta;
          camY += camVelY * delta;
          camRoll += camVelRoll * delta;
          // Pure offset — camera translates without pivoting toward origin.
          // Rotation is only Z roll (bank/tilt), keeping the forward direction
          // locked along -Z world axis.
          camera.position.set(camX, camY, CAM_RADIUS);
          camera.rotation.set(0, 0, camRoll);
        }

        // stats.begin();
        // Enforce no camera auto-rotation every frame — rotGroup handles the
        // particle spin and this guards against HMR / stale-effect scenarios.
        controls.autoRotate = false;
        controls.update();
        if (postProcessing) {
          postProcessing.renderAsync();
        } else {
          renderer.renderAsync(scene, camera);
        }
        // stats.end();
      };
      animate();

      cleanupInner = () => {
        window.removeEventListener("resize", onResize);
        container.removeEventListener("mousemove", onMouseMove);
        container.removeEventListener("mouseleave", onMouseLeave);
        sphereGeo.dispose();
        material.dispose();
        cylGeo.dispose();
        cylMat.dispose();
        triTex.dispose();
        controls.dispose();
        // stats.dom.remove();
        if (ringUniRef.current) ringUniRef.current.ringMat.dispose();
        ring1Ref.current?.geometry.dispose();
        ring2Ref.current?.geometry.dispose();
        ring3Ref.current?.geometry.dispose();
        ring4Ref.current?.geometry.dispose();
        cylMeshRef.current = null;
        cylUniRef.current = null;
        ringRotGroupRef.current = null;
        ringTopGroupRef.current = null;
        ringBotGroupRef.current = null;
        ring1Ref.current = null;
        ring2Ref.current = null;
        ring3Ref.current = null;
        ring4Ref.current = null;
        ringUniRef.current = null;
        if (gridUniRef.current) gridUniRef.current.gridMat.dispose();
        gridMeshRef.current?.geometry.dispose();
        gridMeshRef.current = null;
        gridUniRef.current = null;
        bgCtxRef.current = null;
        bgTexRef.current = null;
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      cleanupInner?.();
      controlsRef.current = null;
      groupRef.current = null;
      uniformsRef.current = null;
      if (renderer) {
        renderer.dispose();
        renderer.domElement?.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleCount]);

  // ── Animate model transition on url change ────────────────────────────────
  // Skip the very first run (initial load is handled by the main effect above).
  useEffect(() => {
    if (isFirstUrlRef.current) {
      isFirstUrlRef.current = false;
      return;
    }
    if (
      !uniformsRef.current ||
      !posAttrTargetRef.current ||
      !normAttrTargetRef.current
    )
      return;

    // Capture whether we're idle before the async call so the interrupted path
    // below stays consistent even when the microtask resolves.
    const wasIdle = transitionStateRef.current === "idle";

    // sampleGLBGeometry resolves from cache (models are preloaded) — nearly sync.
    sampleGLBGeometry(url, particleCount).then(
      ({ positions: newPos, normals: newNorm }) => {
        if (
          !posAttrTargetRef.current ||
          !normAttrTargetRef.current ||
          !uniformsRef.current
        )
          return;

        // If a morph was already in progress, commit the current visual position
        // so the new transition starts from where particles actually are.
        const prog = uniformsRef.current.transitionProgress.value as number;
        if (prog > 0) {
          const srcPos = posAttrRef.current!.array as Float32Array;
          const tgtPos = posAttrTargetRef.current.array as Float32Array;
          const srcNorm = normAttrRef.current!.array as Float32Array;
          const tgtNorm = normAttrTargetRef.current.array as Float32Array;
          for (let i = 0; i < srcPos.length; i++) {
            srcPos[i] = srcPos[i] * (1 - prog) + tgtPos[i] * prog;
            srcNorm[i] = srcNorm[i] * (1 - prog) + tgtNorm[i] * prog;
          }
          posAttrRef.current!.needsUpdate = true;
          normAttrRef.current!.needsUpdate = true;
          uniformsRef.current.transitionProgress.value = 0;
        }

        // Write new target geometry
        (posAttrTargetRef.current.array as Float32Array).set(newPos);
        (normAttrTargetRef.current.array as Float32Array).set(newNorm);
        posAttrTargetRef.current.needsUpdate = true;
        normAttrTargetRef.current.needsUpdate = true;
        transitionTimeRef.current = 0;

        if (wasIdle) {
          // Normal start: first deform the current model
          transitionStateRef.current = "deform-out";
        } else {
          // Already mid-transition — snap to deformed value and morph directly
          uniformsRef.current.maskContrast.value =
            transitionMaskContrastRef.current;
          transitionStateRef.current = "morphing";
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // ── Background preload ────────────────────────────────────────────────────
  // Kick off sampleGLBGeometry for every preloadUrl as soon as particleCount
  // is known.  Results land in geometryCache so transitions are instant.
  useEffect(() => {
    for (const u of preloadUrls) {
      sampleGLBGeometry(u, particleCount).catch(() => {
        /* ignore preload errors */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleCount]);

  // ── Realtime updates — mutate uniforms, no rebuild ────────────────────────

  // Belt-and-suspenders: ensure camera autoRotate is always off.
  // Particle rotation is handled entirely via rotGroup.rotation.y in the loop.
  // This effect also runs on HMR updates where the main effect hasn't re-run.
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false;
      controlsRef.current.enabled = false;
    }
  });

  useEffect(() => {
    autoRotateSpeedRef.current = autoRotateSpeed;
  }, [autoRotateSpeed]);

  useEffect(() => {
    uniformsRef.current?.color.value.set(color);
  }, [color]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.floatAmp.value = floatAmp;
  }, [floatAmp]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.sphereSize.value = sphereSize;
  }, [sphereSize]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.ambient.value = ambient;
  }, [ambient]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.wrap.value = wrap;
  }, [wrap]);
  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.volumeStrength.value = volumeStrength;
  }, [volumeStrength]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.noiseAmp.value = noiseAmp;
  }, [noiseAmp]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.noiseScale.value = noiseScale;
  }, [noiseScale]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.noiseSpeed.value = noiseSpeed;
  }, [noiseSpeed]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.noiseGain.value = noiseGain;
  }, [noiseGain]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.maskScale.value = maskScale;
  }, [maskScale]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.maskSpeed.value = maskSpeed;
  }, [maskSpeed]);
  useEffect(() => {
    maskContrastRef.current = maskContrast;
    // Only push directly while idle — active transitions own the uniform
    if (uniformsRef.current && transitionStateRef.current === "idle")
      uniformsRef.current.maskContrast.value = maskContrast;
  }, [maskContrast]);

  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.mouseRadius.value = mouseRadius;
  }, [mouseRadius]);
  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.mouseStrength.value = mouseStrength;
  }, [mouseStrength]);
  useEffect(() => {
    springKRef.current = springStiffness;
  }, [springStiffness]);
  useEffect(() => {
    springDampingRef.current = springDamping;
  }, [springDamping]);
  useEffect(() => {
    pushStrengthRef.current = pushStrength;
  }, [pushStrength]);
  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.mouseScatter.value = mouseScatter;
  }, [mouseScatter]);
  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.mouseGlowColor.value.set(mouseGlowColor);
  }, [mouseGlowColor]);
  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.mouseGlowPassive.value = mouseGlowPassive;
  }, [mouseGlowPassive]);
  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.mouseGlowActive.value = mouseGlowActive;
  }, [mouseGlowActive]);
  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.mouseGlowPow.value = mouseGlowPow;
  }, [mouseGlowPow]);
  useEffect(() => {
    mouseGlowDecayRef.current = mouseGlowDecay;
  }, [mouseGlowDecay]);
  useEffect(() => {
    mouseLerpRef.current = mouseLerp;
  }, [mouseLerp]);

  // Post-processing
  useEffect(() => {
    if (bloomNodeRef.current)
      bloomNodeRef.current.strength.value = bloomStrength;
  }, [bloomStrength]);
  useEffect(() => {
    if (bloomNodeRef.current) bloomNodeRef.current.radius.value = bloomRadius;
  }, [bloomRadius]);
  useEffect(() => {
    if (bloomNodeRef.current)
      bloomNodeRef.current.threshold.value = bloomThreshold;
  }, [bloomThreshold]);
  useEffect(() => {
    if (caUniformRef.current) caUniformRef.current.value = chromaticStr;
  }, [chromaticStr]);

  // Model position
  useEffect(() => {
    if (groupRef.current) groupRef.current.position.set(modelX, modelY, modelZ);
  }, [modelX, modelY, modelZ]);

  // Lights
  useEffect(() => {
    uniformsRef.current?.light1Pos.value.set(light1X, light1Y, light1Z);
  }, [light1X, light1Y, light1Z]);
  useEffect(() => {
    uniformsRef.current?.light1Color.value.set(light1Color);
  }, [light1Color]);
  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.light1Intensity.value = light1Intensity;
  }, [light1Intensity]);
  useEffect(() => {
    uniformsRef.current?.light2Pos.value.set(light2X, light2Y, light2Z);
  }, [light2X, light2Y, light2Z]);
  useEffect(() => {
    uniformsRef.current?.light2Color.value.set(light2Color);
  }, [light2Color]);
  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.light2Intensity.value = light2Intensity;
  }, [light2Intensity]);

  // Transition controls — refs only (read in the animate loop, no GPU uniform needed)
  useEffect(() => {
    transitionDeformDurRef.current = transitionDeformDur;
  }, [transitionDeformDur]);
  useEffect(() => {
    transitionMorphDurRef.current = transitionMorphDur;
  }, [transitionMorphDur]);
  useEffect(() => {
    transitionReformDurRef.current = transitionReformDur;
  }, [transitionReformDur]);
  useEffect(() => {
    transitionMaskContrastRef.current = transitionMaskContrast;
  }, [transitionMaskContrast]);
  useEffect(() => {
    if (uniformsRef.current)
      uniformsRef.current.transitionGlowScale.value = transitionGlowScale;
  }, [transitionGlowScale]);

  // ── Cylinder realtime updates ─────────────────────────────────────────────
  useEffect(() => {
    if (cylMeshRef.current) cylMeshRef.current.visible = cylVisible;
  }, [cylVisible]);
  useEffect(() => {
    if (cylUniRef.current) cylUniRef.current.uCylColor.value.set(cylColor);
  }, [cylColor]);
  useEffect(() => {
    if (cylUniRef.current)
      cylUniRef.current.uCylNoiseScale.value = cylNoiseScale;
  }, [cylNoiseScale]);
  useEffect(() => {
    if (cylUniRef.current) cylUniRef.current.uCylLineWidth.value = cylLineWidth;
  }, [cylLineWidth]);
  useEffect(() => {
    if (cylUniRef.current)
      cylUniRef.current.uCylFresnelPow.value = cylFresnelPow;
  }, [cylFresnelPow]);
  useEffect(() => {
    if (cylUniRef.current)
      cylUniRef.current.uCylBaseOpacity.value = cylBaseOpacity;
  }, [cylBaseOpacity]);
  useEffect(() => {
    if (cylUniRef.current)
      cylUniRef.current.uCylLineOpacity.value = cylLineOpacity;
  }, [cylLineOpacity]);
  useEffect(() => {
    if (cylUniRef.current)
      cylUniRef.current.uCylNoiseSpeed.value = cylNoiseSpeed;
  }, [cylNoiseSpeed]);
  useEffect(() => {
    if (cylUniRef.current)
      cylUniRef.current.uCylPulseSpeed.value = cylPulseSpeed;
  }, [cylPulseSpeed]);
  useEffect(() => {
    if (cylUniRef.current) cylUniRef.current.uCylPulseAmp.value = cylPulseAmp;
  }, [cylPulseAmp]);
  useEffect(() => {
    if (cylUniRef.current)
      cylUniRef.current.uCylPulseEasing.value = cylPulseEasing;
  }, [cylPulseEasing]);
  useEffect(() => {
    if (cylUniRef.current) cylUniRef.current.uCylWaveFreq.value = cylWaveFreq;
  }, [cylWaveFreq]);
  useEffect(() => {
    if (cylUniRef.current) cylUniRef.current.uCylTexRepeat.value = cylTexRepeat;
  }, [cylTexRepeat]);
  // Geometry-level changes — swap the cylinder geometry without a full scene rebuild
  useEffect(() => {
    if (!cylMeshRef.current) return;
    const old = cylMeshRef.current.geometry;
    cylMeshRef.current.geometry = new CylinderGeometry(
      cylRadius,
      cylRadius,
      cylHeight,
      64,
      1,
      true,
    );
    cylMeshRef.current.position.y = cylHeight / 2 + cylY;
    old.dispose();
  }, [cylRadius, cylHeight, cylY]);

  // Dot grid
  useEffect(() => {
    if (gridMeshRef.current) gridMeshRef.current.visible = gridVisible;
  }, [gridVisible]);
  useEffect(() => {
    gridUniRef.current?.uGridColor.value.set(gridColor);
  }, [gridColor]);
  useEffect(() => {
    if (gridUniRef.current)
      gridUniRef.current.uGridBaseOpacity.value = gridBaseOpacity;
  }, [gridBaseOpacity]);
  useEffect(() => {
    if (gridUniRef.current) gridUniRef.current.uGridWaveAmp.value = gridWaveAmp;
  }, [gridWaveAmp]);
  useEffect(() => {
    if (gridUniRef.current)
      gridUniRef.current.uGridNoiseScale.value = gridNoiseScale;
  }, [gridNoiseScale]);
  useEffect(() => {
    if (gridUniRef.current)
      gridUniRef.current.uGridWaveSpeed.value = gridWaveSpeed;
  }, [gridWaveSpeed]);
  useEffect(() => {
    if (gridUniRef.current) gridUniRef.current.uGridDensity.value = gridDensity;
  }, [gridDensity]);
  useEffect(() => {
    if (gridUniRef.current) gridUniRef.current.uGridDotSize.value = gridDotSize;
  }, [gridDotSize]);

  // Halo ring
  useEffect(() => {
    if (ringRotGroupRef.current) ringRotGroupRef.current.visible = ringVisible;
  }, [ringVisible]);
  useEffect(() => {
    if (ringUniRef.current) ringUniRef.current.uRingColor.value.set(ringColor);
  }, [ringColor]);
  useEffect(() => {
    if (ringUniRef.current) ringUniRef.current.uRingOpacity.value = ringOpacity;
  }, [ringOpacity]);
  useEffect(() => {
    if (ringUniRef.current)
      ringUniRef.current.uRingBrightness.value = ringBrightness;
  }, [ringBrightness]);
  // Geometry-level ring changes — rebuild all four arcs
  useEffect(() => {
    const meshes = [
      ring1Ref.current,
      ring2Ref.current,
      ring3Ref.current,
      ring4Ref.current,
    ];
    const uni = ringUniRef.current;
    if (meshes.some((m) => !m) || !uni) return;
    const gapRad = ringGap * (Math.PI / 180);
    const arcSpan = Math.PI - gapRad;
    meshes.forEach((mesh) => {
      const old = mesh!.geometry;
      mesh!.geometry = new TorusGeometry(
        ringRadius,
        ringThickness,
        8,
        80,
        arcSpan,
      );
      old.dispose();
    });
    const yA = gapRad / 2;
    const yB = Math.PI + gapRad / 2;
    uni.w1.rotation.y = yA;
    uni.w2.rotation.y = yB;
    uni.w3.rotation.y = yA;
    uni.w4.rotation.y = yB;
  }, [ringRadius, ringThickness, ringGap]);
  // Keep rings in sync with cylinder top/bottom
  useEffect(() => {
    if (ringTopGroupRef.current)
      ringTopGroupRef.current.position.y = cylHeight + cylY;
    if (ringBotGroupRef.current) ringBotGroupRef.current.position.y = cylY;
  }, [cylHeight, cylY]);

  // Camera parallax
  useEffect(() => {
    camIntensityRef.current = camIntensity;
  }, [camIntensity]);
  useEffect(() => {
    camStiffnessRef.current = camStiffness;
  }, [camStiffness]);
  useEffect(() => {
    camDampingRef.current = camDamping;
  }, [camDamping]);

  // Background gradient
  useEffect(() => {
    bgColorCenterRef.current = bgColorCenter;
    redrawBg();
  }, [bgColorCenter]);
  useEffect(() => {
    bgColorMidRef.current = bgColorMid;
    redrawBg();
  }, [bgColorMid]);
  useEffect(() => {
    bgColorEdgeRef.current = bgColorEdge;
    redrawBg();
  }, [bgColorEdge]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
