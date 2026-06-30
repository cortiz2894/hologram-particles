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
  Quaternion,
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
  StorageInstancedBufferAttribute,
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
  min,
  max,
  mix,
  step,
  pow,
  abs,
  smoothstep as tslSmoothstep,
  texture as tslTexture,
  uv,
  pass,
  storage,
  instanceIndex,
  Fn,
  mx_noise_float,
  mx_fractal_noise_vec3,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { chromaticAberration } from "three/addons/tsl/display/ChromaticAberrationNode.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Stats from "stats.js";
import type { GeometryData, ParticlesHologramProps } from "./types";

// ── Module-level geometry cache ───────────────────────────────────────────────

const geometryCache = new Map<string, GeometryData>();
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

    // ── Normalise to a consistent bounding box ────────────────────────────────
    const bbox = new Box3().setFromObject(gltf.scene);
    const centre = new Vector3();
    bbox.getCenter(centre);
    gltf.scene.position.sub(centre);
    gltf.scene.updateMatrixWorld(true);

    const bbox2 = new Box3().setFromObject(gltf.scene);
    const sv = new Vector3();
    bbox2.getSize(sv);
    const maxDim = Math.max(sv.x, sv.y, sv.z);
    gltf.scene.scale.setScalar(maxDim > 0 ? 3 / maxDim : 1);
    gltf.scene.updateMatrixWorld(true);

    const bbox3 = new Box3().setFromObject(gltf.scene);
    gltf.scene.position.y -= bbox3.min.y;
    gltf.scene.updateMatrixWorld(true);

    const meshes: Mesh[] = [];
    gltf.scene.traverse((child: Object3D) => {
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

export default function ParticlesHologram({
  url,
  onLoaded,
  onTransitionComplete,
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
  pusherVisible = true,
  pusherRadius = 0.6,
  pusherInfluence = 0.8,
  pusherFalloff = 1.5,
  pusherDepth = 12,
  pusherFollow = 16,
  pusherRadialStrength = 45,
  pusherMoveStrength = 14,
  pusherFlowBias = 1.5,
  pusherSpring = 18,
  pusherDamping = 5,
  pusherMaxOffset = 2,
  pusherTurbulence = 25,
  pusherTurbScale = 0.6,
  pusherTurbSpeed = 0.5,
  mouseGlowColor = "#ffffff",
  mouseGlowPassive = 0.0,
  mouseGlowActive = 1.5,
  mouseGlowPow = 2.0,
  glowSensitivity = 1.5,
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
  cylCollision = true,
  cylBounce = 0,
  cylHoldTime = 0.4,
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
  entranceMorphDur = 0.7,
  entranceReformDur = 0.35,
  replayTrigger = 0,
}: ParticlesHologramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<Group | null>(null);
  const autoRotateSpeedRef = useRef(autoRotateSpeed);
  const uniformsRef = useRef<Record<string, any> | null>(null);
  const restPosBufRef = useRef<StorageInstancedBufferAttribute | null>(null);
  const physOffBufRef = useRef<StorageInstancedBufferAttribute | null>(null);
  const physVelBufRef = useRef<StorageInstancedBufferAttribute | null>(null);
  const physHoldBufRef = useRef<StorageInstancedBufferAttribute | null>(null);
  const pusherMeshRef = useRef<Mesh | null>(null);
  const pusherFollowRef = useRef(pusherFollow);
  const pusherVisibleRef = useRef(pusherVisible);
  const springKRef = useRef(springStiffness);
  const springDampingRef = useRef(springDamping);
  const pushStrengthRef = useRef(pushStrength);
  const mouseGlowDecayRef = useRef(mouseGlowDecay);
  const mouseLerpRef = useRef(mouseLerp);
  const bloomNodeRef = useRef<any>(null);
  const caUniformRef = useRef<any>(null);
  const cylMeshRef = useRef<Mesh | null>(null);
  const cylUniRef = useRef<Record<string, any> | null>(null);
  const gridMeshRef = useRef<Mesh | null>(null);
  const gridUniRef = useRef<Record<string, any> | null>(null);
  const ringRotGroupRef = useRef<Group | null>(null);
  const ringTopGroupRef = useRef<Group | null>(null);
  const ringBotGroupRef = useRef<Group | null>(null);
  const ring1Ref = useRef<Mesh | null>(null);
  const ring2Ref = useRef<Mesh | null>(null);
  const ring3Ref = useRef<Mesh | null>(null);
  const ring4Ref = useRef<Mesh | null>(null);
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

  const onTransitionCompleteRef = useRef(onTransitionComplete);
  useEffect(() => {
    onTransitionCompleteRef.current = onTransitionComplete;
  }, [onTransitionComplete]);

  const maskContrastRef = useRef(maskContrast);
  const transitionDeformDurRef = useRef(transitionDeformDur);
  const transitionMorphDurRef = useRef(transitionMorphDur);
  const transitionReformDurRef = useRef(transitionReformDur);
  const transitionMaskContrastRef = useRef(transitionMaskContrast);
  const transitionGlowScaleRef = useRef(transitionGlowScale);
  const entranceMorphDurRef = useRef(entranceMorphDur);
  const entranceReformDurRef = useRef(entranceReformDur);

  // ── Transition refs ───────────────────────────────────────────────────────────
  const transitionStateRef = useRef<
    "idle" | "deform-out" | "morphing" | "deform-in"
  >("idle");
  const transitionTimeRef = useRef(0);
  const isEntranceRef = useRef(true);
  const posAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const normAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const posAttrTargetRef = useRef<InstancedBufferAttribute | null>(null);
  const normAttrTargetRef = useRef<InstancedBufferAttribute | null>(null);
  const isFirstUrlRef = useRef(true);

  // ── Ref sync — runs every render, read by the animate loop ───────────────────
  autoRotateSpeedRef.current = autoRotateSpeed;
  pusherFollowRef.current = pusherFollow;
  pusherVisibleRef.current = pusherVisible;
  springKRef.current = springStiffness;
  springDampingRef.current = springDamping;
  pushStrengthRef.current = pushStrength;
  mouseGlowDecayRef.current = mouseGlowDecay;
  mouseLerpRef.current = mouseLerp;
  camIntensityRef.current = camIntensity;
  camStiffnessRef.current = camStiffness;
  camDampingRef.current = camDamping;
  maskContrastRef.current = maskContrast;
  transitionDeformDurRef.current = transitionDeformDur;
  transitionMorphDurRef.current = transitionMorphDur;
  transitionReformDurRef.current = transitionReformDur;
  transitionMaskContrastRef.current = transitionMaskContrast;
  transitionGlowScaleRef.current = transitionGlowScale;
  entranceMorphDurRef.current = entranceMorphDur;
  entranceReformDurRef.current = entranceReformDur;
  bgColorCenterRef.current = bgColorCenter;
  bgColorMidRef.current = bgColorMid;
  bgColorEdgeRef.current = bgColorEdge;

  // ── Full re-init on url / particleCount change ────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId: number;
    let renderer: WebGPURenderer;
    let disposed = false;
    let cleanupInner: (() => void) | undefined;

    (async () => {
      // ── Renderer ──────────────────────────────────────────────────────────────
      renderer = new WebGPURenderer({ antialias: true, alpha: true });
      await renderer.init();
      if (disposed) return;

      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      let postProcessing: PostProcessing | null = null;

      // ── Scene / Camera ────────────────────────────────────────────────────────
      const scene = new Scene();

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

      // ── Dot grid background ───────────────────────────────────────────────────
      {
        const gridGeo = new PlaneGeometry(50, 32);
        const gridMat = new MeshBasicNodeMaterial() as any;
        gridMat.transparent = true;
        gridMat.depthWrite = false;
        gridMat.depthTest = true;

        const uGridColor = uniform(new Color(gridColor));
        const uGridBaseOpacity = uniform(gridBaseOpacity);
        const uGridWaveAmp = uniform(gridWaveAmp);
        const uGridNoiseScale = uniform(gridNoiseScale);
        const uGridWaveSpeed = uniform(gridWaveSpeed);
        const uGridDensity = uniform(gridDensity);
        const uGridDotSize = uniform(gridDotSize);

        const cellPos = positionWorld.xy.mul(uGridDensity);
        const fracCell = fract(cellPos).sub(vec2(0.5, 0.5));
        const dotDist = fracCell.length();
        const dotShape = float(1).sub(
          tslSmoothstep(float(0), uGridDotSize, dotDist),
        );
        const noiseCoord = vec3(
          positionWorld.x.mul(uGridNoiseScale),
          positionWorld.y.mul(uGridNoiseScale),
          time.mul(uGridWaveSpeed),
        );
        const wave = mx_noise_float(noiseCoord).mul(float(0.5)).add(float(0.5));
        const waveBrightness = uGridBaseOpacity.add(wave.mul(uGridWaveAmp));
        gridMat.colorNode = uGridColor.mul(waveBrightness);
        gridMat.opacityNode = dotShape;

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

      // ── Orbit Controls ────────────────────────────────────────────────────────
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enabled = false;
      controls.autoRotate = false;
      controlsRef.current = controls;

      const { positions, normals } = await sampleGLBGeometry(
        url,
        particleCount,
      );
      if (disposed) return;

      // ── Sphere geometry ───────────────────────────────────────────────────────
      // NOTE: the per-particle float phase is derived from the rest position
      // (hash) instead of a dedicated `instanceSeed` attribute — this frees a
      // vertex-buffer slot for the physics offset (WebGPU caps at 8).
      const sphereGeo = new IcosahedronGeometry(1, 0);
      sphereGeo.setAttribute(
        "instanceNormal",
        new InstancedBufferAttribute(new Float32Array(normals.length), 3),
      );
      sphereGeo.setAttribute(
        "instancePos",
        new InstancedBufferAttribute(new Float32Array(positions.length), 3),
      );
      sphereGeo.setAttribute(
        "instanceNormalTarget",
        new InstancedBufferAttribute(normals.slice(), 3),
      );
      sphereGeo.setAttribute(
        "instancePosTarget",
        new InstancedBufferAttribute(positions.slice(), 3),
      );

      const instancedMesh = new InstancedMesh(
        sphereGeo,
        null as any,
        particleCount,
      );
      instancedMesh.instanceMatrix.needsUpdate = true;

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

      transitionStateRef.current = "morphing";
      transitionTimeRef.current = 0;

      // ── TSL uniforms ──────────────────────────────────────────────────────────
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
        maskContrast: uniform(transitionMaskContrast),
        mousePos: uniform(new Vector3()),
        mouseVel: uniform(new Vector3()),
        mouseRadius: uniform(mouseRadius),
        mouseStrength: uniform(mouseStrength),
        mouseScatter: uniform(mouseScatter),
        // ── Pusher physics (GPU compute, collider sphere) ───────────────────
        physDt: uniform(0),
        pusherPos: uniform(new Vector3()),
        pusherVel: uniform(new Vector3()),
        pusherAxis: uniform(new Vector3(0, 0, 1)),
        pusherActive: uniform(0),
        pusherRadius: uniform(pusherRadius),
        pusherInfluence: uniform(pusherInfluence),
        pusherFalloff: uniform(pusherFalloff),
        pusherDepth: uniform(pusherDepth),
        pusherRadial: uniform(pusherRadialStrength),
        pusherMove: uniform(pusherMoveStrength),
        pusherFlowBias: uniform(pusherFlowBias),
        pusherSpring: uniform(pusherSpring),
        pusherDamping: uniform(pusherDamping),
        pusherMaxOffset: uniform(pusherMaxOffset),
        // Cylinder containment (collision against cylMesh's wall).
        cylCollision: uniform(cylCollision ? 1 : 0),
        cylRadius: uniform(cylRadius),
        cylBounce: uniform(cylBounce),
        cylHoldTime: uniform(cylHoldTime),
        pusherTurbulence: uniform(pusherTurbulence),
        pusherTurbScale: uniform(pusherTurbScale),
        pusherTurbSpeed: uniform(pusherTurbSpeed),
        mouseGlowColor: uniform(new Color(mouseGlowColor)),
        mouseGlowPassive: uniform(mouseGlowPassive),
        mouseGlowActive: uniform(mouseGlowActive),
        mouseGlowPow: uniform(mouseGlowPow),
        mouseGlowEnergy: uniform(0),
        glowSensitivity: uniform(glowSensitivity),
        transitionProgress: uniform(0),
        transitionGlowScale: uniform(transitionGlowScale),
        entranceGlow: uniform(1),
      };
      uniformsRef.current = u;

      // ── Per-particle physics state (GPU compute) ──────────────────────────────
      // restPos: each particle's rest (target) position — the spring pulls back to it.
      // physOff: live displacement from rest. physVel: live velocity.
      // physRand: a fixed per-particle unit vector used for directional scatter.
      const restPosBuf = new StorageInstancedBufferAttribute(
        positions.slice(),
        3,
      );
      const physOffBuf = new StorageInstancedBufferAttribute(particleCount, 3);
      const physVelBuf = new StorageInstancedBufferAttribute(particleCount, 3);
      // Per-particle "cling" timer: seconds left stuck to the cylinder wall.
      const physHoldBuf = new StorageInstancedBufferAttribute(particleCount, 1);
      const physRandArr = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        let x = Math.random() * 2 - 1;
        let y = Math.random() * 2 - 1;
        let z = Math.random() * 2 - 1;
        const len = Math.hypot(x, y, z) || 1;
        x /= len;
        y /= len;
        z /= len;
        physRandArr[i * 3] = x;
        physRandArr[i * 3 + 1] = y;
        physRandArr[i * 3 + 2] = z;
      }
      const physRandBuf = new StorageInstancedBufferAttribute(physRandArr, 3);

      restPosBufRef.current = restPosBuf;
      physOffBufRef.current = physOffBuf;
      physVelBufRef.current = physVelBuf;
      physHoldBufRef.current = physHoldBuf;

      const restPosStorage = storage(restPosBuf, "vec3", particleCount);
      const physOffStorage = storage(physOffBuf, "vec3", particleCount);
      const physVelStorage = storage(physVelBuf, "vec3", particleCount);
      const physHoldStorage = storage(physHoldBuf, "float", particleCount);
      const physRandStorage = storage(physRandBuf, "vec3", particleCount);

      // Vertex stage reads the compute-written displacement as a per-instance
      // attribute (three.js docs: `material.positionNode = buffer.toAttribute()`).
      const physOffNode = physOffStorage.toAttribute();

      const computePhysics = Fn(() => {
        const off = physOffStorage.element(instanceIndex);
        const vel = physVelStorage.element(instanceIndex);
        const hold = physHoldStorage.element(instanceIndex);
        const rest = restPosStorage.toReadOnly().element(instanceIndex);
        const rnd = physRandStorage.toReadOnly().element(instanceIndex);

        const eps = float(1e-5);
        // Particles clinging to the wall (hold timer running) skip the spring
        // return, so they stay stuck a moment before springing home.
        const held = step(float(1e-4), hold);
        const pos = rest.add(off);
        const speed = u.pusherVel.length();
        const moveDir = u.pusherVel.div(speed.add(eps)); // 0 when still

        // Collider CYLINDER along the view axis: distance is measured perpendicular
        // to that axis, so the pusher reaches through the model's full depth and
        // disturbs every particle under the cursor (front, middle and back alike).
        const toParticle = pos.sub(u.pusherPos);
        const axial = dot(toParticle, u.pusherAxis); // depth along view axis
        const perp = toParticle.sub(u.pusherAxis.mul(axial)); // in-screen offset
        const dPerp = perp.length();
        const dirOut = perp.div(dPerp.add(eps)); // outward in the screen plane

        // Area of effect (perpendicular to the view axis): a solid core
        // (pusherRadius) surrounded by a soft halo (pusherInfluence) so the drag
        // reaches the neighbouring particles too — 1 in the core, →0 at the edge.
        const reach = u.pusherRadius.add(u.pusherInfluence);
        const perpFall = float(1).sub(tslSmoothstep(u.pusherRadius, reach, dPerp));
        // Axial extent along the view axis (the cylinder's Z length): full effect
        // within ±depth/2, fading to 0 at the caps. Controls how deep it reaches.
        const halfDepth = u.pusherDepth.mul(float(0.5));
        const axialInfl = float(1).sub(
          tslSmoothstep(halfDepth.mul(float(0.7)), halfDepth, abs(axial)),
        );
        const influence = pow(perpFall, u.pusherFalloff).mul(axialInfl);

        // The collider DISPLACES particles out of its volume (it never attracts).
        // The exit direction is radially outward, leaning toward the cursor's
        // movement direction so the displaced particles form a wave that's pushed
        // forward — exactly like sweeping a hand through water.
        const exitDir = normalize(
          dirOut.add(moveDir.mul(u.pusherFlowBias)).add(rnd.mul(float(0.3))),
        );
        // Magnitude: steady expulsion (carves a cavity, even when still) plus a
        // speed-scaled forward shove (the bow wave grows with how fast you move),
        // both faded by the influence halo so neighbours get dragged too.
        const mag = influence
          .mul(u.pusherRadial)
          .add(influence.mul(speed).mul(u.pusherMove));
        const pushForce = exitDir.mul(mag);

        // Organic turbulence: animated fractal-noise field that frays the wave into
        // wisps — only acts on disturbed particles and grows with cursor speed.
        const nCoord = pos.mul(u.pusherTurbScale).add(
          vec3(
            time.mul(u.pusherTurbSpeed),
            time.mul(u.pusherTurbSpeed).mul(0.7),
            time.mul(u.pusherTurbSpeed).mul(1.3),
          ),
        );
        const turbAmp = u.pusherTurbulence
          .mul(influence)
          .mul(clamp(speed.mul(0.3).add(float(0.1)), float(0), float(1)));
        const turbForce = mx_fractal_noise_vec3(nCoord, 2, 2.0, 0.5).mul(turbAmp);

        const pushAccel = pushForce.add(turbForce).mul(u.pusherActive);

        // Spring back to rest + damping → particles return to their position.
        // While a particle is held against the wall, its spring is switched off.
        const accel = pushAccel
          .sub(off.mul(u.pusherSpring).mul(float(1).sub(held)))
          .sub(vel.mul(u.pusherDamping));

        vel.addAssign(accel.mul(u.physDt));
        off.addAssign(vel.mul(u.physDt));

        // Clamp displacement to the maximum.
        const offLen = off.length();
        const scale = min(float(1), u.pusherMaxOffset.div(offLen.add(eps)));
        off.mulAssign(scale);

        // ── Cylinder containment ──────────────────────────────────────────────
        // The cylinder (cylMesh) is Y-symmetric and the model only rotates around
        // Y, so its wall is the same in this local space: keep every particle
        // within `cylRadius` of the Y axis. Toggled by u.cylCollision (0 = off).
        const cpos = rest.add(off);
        const rXZ = vec2(cpos.x, cpos.z).length();
        // <1 only when the particle is outside the wall → pulls it back to it.
        const clampF = mix(
          float(1),
          min(float(1), u.cylRadius.div(rXZ.add(eps))),
          u.cylCollision,
        );
        off.assign(
          vec3(
            cpos.x.mul(clampF).sub(rest.x),
            cpos.y.sub(rest.y),
            cpos.z.mul(clampF).sub(rest.z),
          ),
        );

        // Collision response: cancel the outward radial velocity at the wall so
        // particles bounce/stop instead of pressing through (cylBounce = restitution).
        const outAmt = max(rXZ.sub(u.cylRadius), float(0));
        const isOut = outAmt.div(outAmt.add(eps)).mul(u.cylCollision); // ~1 outside
        const nrm = vec2(cpos.x, cpos.z).div(rXZ.add(eps)); // outward normal (xz)
        const vRad = vel.x.mul(nrm.x).add(vel.z.mul(nrm.y));
        const vRemove = max(vRad, float(0))
          .mul(isOut)
          .mul(float(1).add(u.cylBounce));
        vel.assign(
          vec3(vel.x.sub(nrm.x.mul(vRemove)), vel.y, vel.z.sub(nrm.y.mul(vRemove))),
        );

        // ── Wall cling timer ──────────────────────────────────────────────────
        // When a particle is actively driven past the wall (overshoot beyond a
        // small margin), (re)arm its hold timer; otherwise count it down. A held
        // particle stays pinned (spring off) until the timer reaches zero.
        const atWall = step(u.cylRadius.add(float(0.01)), rXZ).mul(u.cylCollision);
        const decremented = max(hold.sub(u.physDt), float(0));
        hold.assign(mix(decremented, u.cylHoldTime, atWall));
      })().compute(particleCount);

      // ── TSL material ──────────────────────────────────────────────────────────
      const material = new MeshBasicNodeMaterial() as any;

      const instNorm = attribute("instanceNormal", "vec3");
      const instPos = attribute("instancePos", "vec3");
      const instNormTgt = attribute("instanceNormalTarget", "vec3");
      const instPosTgt = attribute("instancePosTarget", "vec3");

      const blendPos = mix(instPos, instPosTgt, u.transitionProgress);
      const blendNorm = normalize(
        mix(instNorm, instNormTgt, u.transitionProgress),
      );

      // Stable per-particle phase, hashed from the rest position (replaces the
      // former `instanceSeed` vertex attribute to stay within the 8-buffer cap).
      const phase = fract(
        sin(dot(instPosTgt, vec3(12.9898, 78.233, 37.719))).mul(43758.5453),
      ).mul(Math.PI * 2);

      // ── Animation ─────────────────────────────────────────────────────────────
      const floatDisp = vec3(
        cos(time.mul(1.3).add(phase)).mul(u.floatAmp).mul(0.6),
        sin(time.mul(1.6).add(phase)).mul(u.floatAmp),
        sin(time.mul(1.1).add(phase.add(1.0)))
          .mul(u.floatAmp)
          .mul(0.6),
      );

      const maskCoord = blendPos
        .mul(u.maskScale)
        .add(
          vec3(
            time.mul(u.maskSpeed),
            time.mul(u.maskSpeed).mul(0.7),
            time.mul(u.maskSpeed).mul(1.3),
          ),
        );

      const rawMask = mx_noise_float(maskCoord);
      const mask = pow(
        clamp(rawMask.mul(0.5).add(0.5), float(0), float(1)),
        u.maskContrast,
      );

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

      // Full instance centre, including the ambient float/noise wobble.
      const instCenter = blendPos
        .add(floatDisp)
        .add(noiseDisp)
        .add(physOffNode);
      // Hard-contain the rendered position within the cylinder wall too, so the
      // wobble can never poke a particle through the container surface.
      const rCenter = vec2(instCenter.x, instCenter.z).length();
      const centerClampF = mix(
        float(1),
        min(float(1), u.cylRadius.div(rCenter.add(float(1e-5)))),
        u.cylCollision,
      );
      const containedCenter = vec3(
        instCenter.x.mul(centerClampF),
        instCenter.y,
        instCenter.z.mul(centerClampF),
      );

      material.positionNode = positionLocal
        .mul(u.sphereSize)
        .add(containedCenter);

      // ── Shading ───────────────────────────────────────────────────────────────
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

      const shadedColor = u.color.mul(
        clamp(litColor.add(u.ambient), float(0), float(1)),
      );

      // ── Physics glow ────────────────────────────────────────────────────────
      // Particles glow according to how far the physics has displaced them from
      // rest — i.e. exactly the ones currently being pushed/dragged light up, and
      // they fade back to normal as they settle home.
      const physDispMag = physOffNode.length();
      const mouseGlowFactor = pow(
        clamp(physDispMag.mul(u.glowSensitivity), float(0), float(1)),
        u.mouseGlowPow,
      ).mul(u.mouseGlowActive);

      // ── Transition glow ───────────────────────────────────────────────────────
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
      ).mul(u.entranceGlow);
      material.colorNode = mix(shadedColor, u.mouseGlowColor, glowFactor);

      instancedMesh.material = material;

      const posGroup = new Group();
      posGroup.position.set(modelX, modelY, modelZ);
      const rotGroup = new Group();
      rotGroup.add(instancedMesh);
      posGroup.add(rotGroup);

      // ── Debug collider sphere (the invisible pusher made visible) ──────────────
      // A cylinder (not a sphere): it spans the full depth along the view axis,
      // so the pusher influences particles at every Z under the cursor.
      const PUSHER_DEPTH = 12;
      const pusherGeo = new CylinderGeometry(1, 1, 1, 24, 1, true);
      const pusherMat = new MeshBasicNodeMaterial() as any;
      pusherMat.wireframe = true;
      pusherMat.transparent = true;
      pusherMat.depthWrite = false;
      pusherMat.colorNode = uniform(new Color("#00ffaa"));
      pusherMat.opacityNode = float(0.4);
      const pusherMesh = new Mesh(pusherGeo, pusherMat);
      pusherMesh.renderOrder = 10;
      pusherMesh.visible = false;
      pusherMesh.scale.set(pusherRadius, PUSHER_DEPTH, pusherRadius);
      rotGroup.add(pusherMesh);
      pusherMeshRef.current = pusherMesh;

      // ── Transparent cylinder ──────────────────────────────────────────────────
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

      const NdotV = abs(normalView.z);
      const fresnelRim = pow(
        clamp(float(1).sub(NdotV), float(0), float(1)),
        uCylFresnelPow,
      );

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

      const cylPhase = time
        .mul(uCylPulseSpeed)
        .sub(positionLocal.y.mul(uCylWaveFreq));
      const cylSineRaw = sin(cylPhase).mul(float(0.5)).add(float(0.5));
      const cylPulse = pow(cylSineRaw, uCylPulseEasing);
      const cylPulsedLineOp = uCylLineOpacity.mul(
        float(1).sub(uCylPulseAmp).add(uCylPulseAmp.mul(cylPulse)),
      );

      const cylTexUV = uv().mul(uCylTexRepeat);
      const texBright = tslTexture(triTex, cylTexUV).r;

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

      // ── Halo rings ────────────────────────────────────────────────────────────
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

      // ── Post-processing ───────────────────────────────────────────────────────
      {
        const pp = new PostProcessing(renderer);
        const scenePass = pass(scene, camera);
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

      // ── Mouse interaction ─────────────────────────────────────────────────────
      const raycaster = new Raycaster();
      const mouseNDC = new Vector2();
      const mousePlane = new Plane();
      const mouseHit = new Vector3();
      const modelCenter = new Vector3();
      const cameraDir = new Vector3();
      const targetMousePos = new Vector3();
      const smoothMousePos = new Vector3();
      const prevMousePos = new Vector3();
      const pusherPos = new Vector3();
      const pusherPrev = new Vector3();
      const pusherVelVec = new Vector3();
      const invRotQ = new Quaternion();
      const localAxisVec = new Vector3();
      const PUSHER_UP = new Vector3(0, 1, 0);
      let pusherInit = false;
      let mouseOver = false;
      const frameVel = new Vector3();
      const smoothVel = new Vector3();
      const impVel = new Vector3();
      const impulse = new Vector3();
      let glowEnergy = 0;
      let lastFrameTime = performance.now();
      let mouseMoving = false;
      const CAM_RADIUS = camera.position.z;
      let camX = 0,
        camY = 0,
        camRoll = 0;
      let camVelX = 0,
        camVelY = 0,
        camVelRoll = 0;
      let moveTimer = 0;
      const MOVE_TIMEOUT = 0.06;
      let mouseEverMoved = false;
      const smoothstep = (p: number) => p * p * (3 - 2 * p);

      const onMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouseNDC.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(mouseNDC, camera);
        if (raycaster.ray.intersectPlane(mousePlane, mouseHit)) {
          const localPos = mouseHit
            .clone()
            .sub(posGroup.position)
            .applyQuaternion(rotGroup.quaternion.clone().invert());
          targetMousePos.copy(localPos);
          if (!mouseEverMoved) {
            smoothMousePos.copy(localPos);
            prevMousePos.copy(localPos);
            mouseEverMoved = true;
          }
        }
        mouseMoving = true;
        mouseOver = true;
        moveTimer = 0;
      };

      const onMouseLeave = () => {
        mouseMoving = false;
        mouseOver = false;
        pusherInit = false;
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

        // ── Transition state machine ──────────────────────────────────────────
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
          const morphDur = isEntranceRef.current
            ? entranceMorphDurRef.current
            : transitionMorphDurRef.current;
          const p = Math.min(transitionTimeRef.current / morphDur, 1);
          u.transitionProgress.value = smoothstep(p);
          if (p >= 1) {
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
          const reformDur = isEntranceRef.current
            ? entranceReformDurRef.current
            : transitionReformDurRef.current;
          const p = Math.min(transitionTimeRef.current / reformDur, 1);
          const tmc = transitionMaskContrastRef.current;
          u.maskContrast.value =
            tmc + (maskContrastRef.current - tmc) * smoothstep(p);
          if (isEntranceRef.current) {
            u.entranceGlow.value = 1 - smoothstep(p);
          }
          if (p >= 1) {
            u.maskContrast.value = maskContrastRef.current;
            transitionStateRef.current = "idle";
            if (isEntranceRef.current) {
              isEntranceRef.current = false;
            }
            onTransitionCompleteRef.current?.();
          }
        }

        if (
          !isEntranceRef.current &&
          mouseEverMoved &&
          u.entranceGlow.value < 1
        ) {
          u.entranceGlow.value = Math.min(
            u.entranceGlow.value + delta / 1.0,
            1,
          );
        }

        const rotDelta =
          ((2 * Math.PI) / 60) * autoRotateSpeedRef.current * delta;
        rotGroup.rotation.y += rotDelta;
        if (ringRotGroupRef.current)
          ringRotGroupRef.current.rotation.y += rotDelta;

        posGroup.getWorldPosition(modelCenter);
        camera.getWorldDirection(cameraDir);
        mousePlane.setFromNormalAndCoplanarPoint(cameraDir, modelCenter);

        // Inverse of the model rotation — world → rotGroup-local space.
        invRotQ.copy(rotGroup.quaternion).invert();
        // View axis in local space: the collider is a cylinder along this axis,
        // so it reaches through the model's full depth under the cursor.
        localAxisVec.copy(cameraDir).applyQuaternion(invRotQ).normalize();
        u.pusherAxis.value.copy(localAxisVec);

        // Re-project the cursor onto the model plane every frame so the collider
        // tracks it even while the model auto-rotates or the camera drifts.
        if (mouseEverMoved) {
          raycaster.setFromCamera(mouseNDC, camera);
          if (raycaster.ray.intersectPlane(mousePlane, mouseHit)) {
            mouseHit.sub(posGroup.position).applyQuaternion(invRotQ);
            targetMousePos.copy(mouseHit);
          }
        }

        // ── Smooth mouse position ─────────────────────────────────────────────
        if (mouseEverMoved) {
          const alpha = 1 - Math.exp(-mouseLerpRef.current * delta);
          smoothMousePos.lerp(targetMousePos, alpha);
          u.mousePos.value.copy(smoothMousePos);
        }

        if (mouseMoving) {
          frameVel
            .subVectors(smoothMousePos, prevMousePos)
            .divideScalar(Math.max(delta, 0.001))
            .clampLength(0, 8.0);
          smoothVel.lerp(frameVel, 0.15);
        } else {
          smoothVel.multiplyScalar(0.85);
        }

        // ── Pusher (collider cylinder) physics input ──────────────────────────
        u.physDt.value = delta;
        if (mouseEverMoved) {
          if (!pusherInit) {
            pusherPos.copy(targetMousePos);
            pusherPrev.copy(targetMousePos);
            pusherInit = true;
          }
          const pa = 1 - Math.exp(-pusherFollowRef.current * delta);
          pusherPos.lerp(targetMousePos, pa);
          pusherVelVec
            .subVectors(pusherPos, pusherPrev)
            .divideScalar(Math.max(delta, 0.001))
            .clampLength(0, 40);
          pusherPrev.copy(pusherPos);
          u.pusherPos.value.copy(pusherPos);
          u.pusherVel.value.copy(pusherVelVec);
        }
        u.pusherActive.value = mouseEverMoved && mouseOver ? 1 : 0;

        // Position / orient / show the debug collider cylinder (along view axis).
        if (pusherMeshRef.current) {
          const r = u.pusherRadius.value + u.pusherInfluence.value;
          pusherMeshRef.current.position.copy(pusherPos);
          pusherMeshRef.current.scale.set(r, u.pusherDepth.value, r);
          pusherMeshRef.current.quaternion.setFromUnitVectors(
            PUSHER_UP,
            localAxisVec,
          );
          pusherMeshRef.current.visible =
            pusherVisibleRef.current && mouseEverMoved && mouseOver;
        }

        // ── Spring-damper ─────────────────────────────────────────────────────
        const k = springKRef.current;
        const c = springDampingRef.current;

        impVel.x += (-k * impulse.x - c * impVel.x) * delta;
        impVel.y += (-k * impulse.y - c * impVel.y) * delta;
        impVel.z += (-k * impulse.z - c * impVel.z) * delta;

        if (mouseMoving) {
          const push = pushStrengthRef.current;
          impVel.x += smoothVel.x * push * delta;
          impVel.y += smoothVel.y * push * delta;
          impVel.z += smoothVel.z * push * delta;
        }

        impulse.x += impVel.x * delta;
        impulse.y += impVel.y * delta;
        impulse.z += impVel.z * delta;
        impulse.clampLength(0, 3.5);

        u.mouseVel.value.copy(impulse);
        prevMousePos.copy(smoothMousePos);

        // ── Glow energy ───────────────────────────────────────────────────────
        const currentImpulse = impulse.length();
        if (currentImpulse > glowEnergy) glowEnergy = currentImpulse;
        glowEnergy *= Math.exp(-mouseGlowDecayRef.current * delta);
        u.mouseGlowEnergy.value = glowEnergy;

        // ── Camera parallax ───────────────────────────────────────────────────
        {
          const intensity = camIntensityRef.current;
          const k = camStiffnessRef.current;
          const c = camDampingRef.current;
          const nx = mouseEverMoved ? mouseNDC.x : 0;
          const ny = mouseEverMoved ? mouseNDC.y : 0;
          const targetX = nx * intensity * 0.05;
          const targetY = ny * intensity * 0.05;
          const targetRoll = -nx * intensity * 0.008;
          camVelX += ((targetX - camX) * k - camVelX * c) * delta;
          camVelY += ((targetY - camY) * k - camVelY * c) * delta;
          camVelRoll += ((targetRoll - camRoll) * k - camVelRoll * c) * delta;
          camX += camVelX * delta;
          camY += camVelY * delta;
          camRoll += camVelRoll * delta;
          camera.position.set(camX, camY, CAM_RADIUS);
          camera.rotation.set(0, 0, camRoll);
        }

        controls.autoRotate = false;
        controls.update();

        // Step the per-particle physics before rendering reads the offsets.
        renderer.computeAsync(computePhysics);

        if (postProcessing) {
          postProcessing.renderAsync();
        } else {
          renderer.renderAsync(scene, camera);
        }
      };
      animate();

      cleanupInner = () => {
        window.removeEventListener("resize", onResize);
        container.removeEventListener("mousemove", onMouseMove);
        container.removeEventListener("mouseleave", onMouseLeave);
        sphereGeo.dispose();
        material.dispose();
        pusherGeo.dispose();
        pusherMat.dispose();
        pusherMeshRef.current = null;
        cylGeo.dispose();
        cylMat.dispose();
        triTex.dispose();
        controls.dispose();
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
      restPosBufRef.current = null;
      physOffBufRef.current = null;
      physVelBufRef.current = null;
      physHoldBufRef.current = null;
      if (renderer) {
        renderer.dispose();
        renderer.domElement?.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleCount]);

  // ── Animate model transition on url change ────────────────────────────────────
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

    const wasIdle = transitionStateRef.current === "idle";

    sampleGLBGeometry(url, particleCount).then(
      ({ positions: newPos, normals: newNorm }) => {
        if (
          !posAttrTargetRef.current ||
          !normAttrTargetRef.current ||
          !uniformsRef.current
        )
          return;

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

        (posAttrTargetRef.current.array as Float32Array).set(newPos);
        (normAttrTargetRef.current.array as Float32Array).set(newNorm);
        posAttrTargetRef.current.needsUpdate = true;
        normAttrTargetRef.current.needsUpdate = true;
        transitionTimeRef.current = 0;

        // Spring rest position follows the new model shape.
        if (restPosBufRef.current) {
          (restPosBufRef.current.array as Float32Array).set(newPos);
          restPosBufRef.current.needsUpdate = true;
        }

        if (wasIdle) {
          transitionStateRef.current = "deform-out";
        } else {
          uniformsRef.current.maskContrast.value =
            transitionMaskContrastRef.current;
          transitionStateRef.current = "morphing";
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // ── Background preload ────────────────────────────────────────────────────────
  useEffect(() => {
    for (const u of preloadUrls) {
      sampleGLBGeometry(u, particleCount).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleCount]);

  // ── Uniform sync — runs after every render ────────────────────────────────────
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false;
      controlsRef.current.enabled = false;
    }

    const u = uniformsRef.current;
    if (u) {
      u.color.value.set(color);
      u.floatAmp.value = floatAmp;
      u.sphereSize.value = sphereSize;
      u.ambient.value = ambient;
      u.wrap.value = wrap;
      u.volumeStrength.value = volumeStrength;
      u.noiseAmp.value = noiseAmp;
      u.noiseScale.value = noiseScale;
      u.noiseSpeed.value = noiseSpeed;
      u.noiseGain.value = noiseGain;
      u.maskScale.value = maskScale;
      u.maskSpeed.value = maskSpeed;
      if (transitionStateRef.current === "idle")
        u.maskContrast.value = maskContrast;
      u.mouseRadius.value = mouseRadius;
      u.mouseStrength.value = mouseStrength;
      u.mouseScatter.value = mouseScatter;
      u.pusherRadius.value = pusherRadius;
      u.pusherInfluence.value = pusherInfluence;
      u.pusherFalloff.value = pusherFalloff;
      u.pusherDepth.value = pusherDepth;
      u.pusherRadial.value = pusherRadialStrength;
      u.pusherMove.value = pusherMoveStrength;
      u.pusherFlowBias.value = pusherFlowBias;
      u.pusherSpring.value = pusherSpring;
      u.pusherDamping.value = pusherDamping;
      u.pusherMaxOffset.value = pusherMaxOffset;
      u.cylCollision.value = cylCollision ? 1 : 0;
      u.cylRadius.value = cylRadius;
      u.cylBounce.value = cylBounce;
      u.cylHoldTime.value = cylHoldTime;
      u.pusherTurbulence.value = pusherTurbulence;
      u.pusherTurbScale.value = pusherTurbScale;
      u.pusherTurbSpeed.value = pusherTurbSpeed;
      u.mouseGlowColor.value.set(mouseGlowColor);
      u.mouseGlowPassive.value = mouseGlowPassive;
      u.mouseGlowActive.value = mouseGlowActive;
      u.mouseGlowPow.value = mouseGlowPow;
      u.glowSensitivity.value = glowSensitivity;
      u.transitionGlowScale.value = transitionGlowScale;
      u.light1Pos.value.set(light1X, light1Y, light1Z);
      u.light1Color.value.set(light1Color);
      u.light1Intensity.value = light1Intensity;
      u.light2Pos.value.set(light2X, light2Y, light2Z);
      u.light2Color.value.set(light2Color);
      u.light2Intensity.value = light2Intensity;
    }

    if (bloomNodeRef.current) {
      bloomNodeRef.current.strength.value = bloomStrength;
      bloomNodeRef.current.radius.value = bloomRadius;
      bloomNodeRef.current.threshold.value = bloomThreshold;
    }
    if (caUniformRef.current) caUniformRef.current.value = chromaticStr;
    if (groupRef.current) groupRef.current.position.set(modelX, modelY, modelZ);

    const cy = cylUniRef.current;
    if (cy) {
      cy.uCylColor.value.set(cylColor);
      cy.uCylNoiseScale.value = cylNoiseScale;
      cy.uCylLineWidth.value = cylLineWidth;
      cy.uCylFresnelPow.value = cylFresnelPow;
      cy.uCylBaseOpacity.value = cylBaseOpacity;
      cy.uCylLineOpacity.value = cylLineOpacity;
      cy.uCylNoiseSpeed.value = cylNoiseSpeed;
      cy.uCylPulseSpeed.value = cylPulseSpeed;
      cy.uCylPulseAmp.value = cylPulseAmp;
      cy.uCylPulseEasing.value = cylPulseEasing;
      cy.uCylWaveFreq.value = cylWaveFreq;
      cy.uCylTexRepeat.value = cylTexRepeat;
    }
    if (cylMeshRef.current) cylMeshRef.current.visible = cylVisible;

    const gr = gridUniRef.current;
    if (gr) {
      gr.uGridColor.value.set(gridColor);
      gr.uGridBaseOpacity.value = gridBaseOpacity;
      gr.uGridWaveAmp.value = gridWaveAmp;
      gr.uGridNoiseScale.value = gridNoiseScale;
      gr.uGridWaveSpeed.value = gridWaveSpeed;
      gr.uGridDensity.value = gridDensity;
      gr.uGridDotSize.value = gridDotSize;
    }
    if (gridMeshRef.current) gridMeshRef.current.visible = gridVisible;

    const ri = ringUniRef.current;
    if (ri) {
      ri.uRingColor.value.set(ringColor);
      ri.uRingOpacity.value = ringOpacity;
      ri.uRingBrightness.value = ringBrightness;
    }
    if (ringRotGroupRef.current) ringRotGroupRef.current.visible = ringVisible;

    redrawBg();
  });

  // ── Replay entrance animation ─────────────────────────────────────────────────
  const isFirstReplayRef = useRef(true);
  useEffect(() => {
    if (isFirstReplayRef.current) {
      isFirstReplayRef.current = false;
      return;
    }
    if (
      !uniformsRef.current ||
      !posAttrRef.current ||
      !normAttrRef.current ||
      !posAttrTargetRef.current
    )
      return;
    (posAttrRef.current.array as Float32Array).fill(0);
    (normAttrRef.current.array as Float32Array).fill(0);
    posAttrRef.current.needsUpdate = true;
    normAttrRef.current.needsUpdate = true;
    if (physOffBufRef.current) {
      (physOffBufRef.current.array as Float32Array).fill(0);
      physOffBufRef.current.needsUpdate = true;
    }
    if (physVelBufRef.current) {
      (physVelBufRef.current.array as Float32Array).fill(0);
      physVelBufRef.current.needsUpdate = true;
    }
    if (physHoldBufRef.current) {
      (physHoldBufRef.current.array as Float32Array).fill(0);
      physHoldBufRef.current.needsUpdate = true;
    }
    uniformsRef.current.transitionProgress.value = 0;
    uniformsRef.current.maskContrast.value = transitionMaskContrastRef.current;
    uniformsRef.current.entranceGlow.value = 1;
    isEntranceRef.current = true;
    transitionStateRef.current = "morphing";
    transitionTimeRef.current = 0;
  }, [replayTrigger]);

  // ── Cylinder geometry rebuild ─────────────────────────────────────────────────
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
    if (ringTopGroupRef.current)
      ringTopGroupRef.current.position.y = cylHeight + cylY;
    if (ringBotGroupRef.current) ringBotGroupRef.current.position.y = cylY;
  }, [cylRadius, cylHeight, cylY]);

  // ── Ring geometry rebuild ─────────────────────────────────────────────────────
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

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
