"use client";

import { useEffect, useRef } from "react";
import {
  Scene,
  PerspectiveCamera,
  InstancedMesh,
  IcosahedronGeometry,
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
} from "three";
import { WebGPURenderer, MeshBasicNodeMaterial, PostProcessing } from "three/webgpu";
import {
  positionLocal,
  normalLocal,
  attribute,
  sin,
  cos,
  time,
  uniform,
  vec3,
  float,
  normalize,
  dot,
  clamp,
  mix,
  pow,
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
  /** Light direction X component */
  lightX?: number;
  /** Light direction Y component */
  lightY?: number;
  /** Light direction Z component */
  lightZ?: number;
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
  lightX = 3.8,
  lightY = -3.0,
  lightZ = -4.2,
  volumeStrength = 0.79,
  modelX = 0,
  modelY = 2.5,
  modelZ = 0,
  noiseAmp = 0.08,
  noiseScale = 0.6,
  noiseSpeed = 0.15,
  noiseGain = 0.5,
  maskScale = 0.4,
  maskSpeed = 0.04,
  maskContrast = 1.5,
  mouseRadius     = 1.5,
  mouseStrength   = 0.6,
  springStiffness = 5.0,
  springDamping   = 3.0,
  pushStrength    = 12.0,
  mouseScatter      = 0.6,
  mouseGlowColor    = "#ffffff",
  mouseGlowPassive  = 0.0,
  mouseGlowActive   = 1.5,
  mouseGlowPow      = 2.0,
  mouseGlowDecay    = 1.5,
  mouseLerp         = 6.0,
  bloomStrength     = 0.4,
  bloomRadius       = 0.4,
  bloomThreshold    = 0.1,
  chromaticStr      = 0.0,
}: ParticlesHologramProps) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const controlsRef       = useRef<OrbitControls | null>(null);
  const groupRef          = useRef<Group | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniformsRef       = useRef<Record<string, any> | null>(null);
  const springKRef        = useRef(springStiffness);
  const springDampingRef  = useRef(springDamping);
  const pushStrengthRef   = useRef(pushStrength);
  const mouseScatterRef   = useRef(mouseScatter);
  const mouseGlowDecayRef = useRef(mouseGlowDecay);
  const mouseLerpRef      = useRef(mouseLerp);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bloomNodeRef      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caUniformRef      = useRef<any>(null);

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
      const stats = new Stats();
      stats.showPanel(0);
      stats.dom.style.position = "absolute";
      stats.dom.style.top = "0px";
      stats.dom.style.left = "0px";
      container.appendChild(stats.dom);

      // Scene / Camera ──────────────────────────────────────────────────────
      const scene = new Scene();
      const camera = new PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        0.1,
        200,
      );
      camera.position.set(0, 0, 6);

      // Orbit Controls ──────────────────────────────────────────────────────
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = true;
      controls.autoRotateSpeed = autoRotateSpeed;
      controls.minDistance = 2;
      controls.maxDistance = 20;
      controlsRef.current = controls;

      // Load GLB ────────────────────────────────────────────────────────────
      const gltf = await new GLTFLoader().loadAsync(url);
      if (disposed) return;

      // Centre + normalise to ~3-unit bounding box
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

      // Collect meshes ──────────────────────────────────────────────────────
      const meshes: Mesh[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gltf.scene.traverse((child: any) => {
        if ((child as Mesh).isMesh) meshes.push(child as Mesh);
      });
      if (meshes.length === 0) return;

      // Sample positions + normals ──────────────────────────────────────────
      const positions = new Float32Array(particleCount * 3);
      const normals = new Float32Array(particleCount * 3);
      const seeds = new Float32Array(particleCount);

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
          seeds[filled + i] = Math.random();
        }
        filled += count;
      }

      // Sphere geometry with per-instance attributes ─────────────────────────
      // Detail 0 = 20 faces / 12 vertices per sphere (vs 80 faces / 42 at detail 1).
      // At small sphere sizes the difference is invisible, ~3.5× fewer VS invocations.
      const sphereGeo = new IcosahedronGeometry(1, 0);
      sphereGeo.setAttribute(
        "instanceSeed",
        new InstancedBufferAttribute(seeds, 1),
      );
      sphereGeo.setAttribute(
        "instanceNormal",
        new InstancedBufferAttribute(normals, 3),
      );
      // Sphere centre positions — used to sample noise at a coherent per-sphere
      // point so the whole sphere moves as a rigid body within the flow field.
      sphereGeo.setAttribute(
        "instancePos",
        new InstancedBufferAttribute(positions, 3),
      );

      const instancedMesh = new InstancedMesh(
        sphereGeo,
        null as any,
        particleCount,
      );
      const dummy = new Object3D();
      for (let i = 0; i < particleCount; i++) {
        const b = i * 3;
        dummy.position.set(positions[b], positions[b + 1], positions[b + 2]);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;

      // TSL uniforms ────────────────────────────────────────────────────────
      const initLightDir = new Vector3(lightX, lightY, lightZ).normalize();
      const u = {
        color: uniform(new Color(color)),
        floatAmp: uniform(floatAmp),
        sphereSize: uniform(sphereSize),
        ambient: uniform(ambient),
        wrap: uniform(wrap),
        lightDir: uniform(initLightDir),
        volumeStrength: uniform(volumeStrength),
        noiseAmp: uniform(noiseAmp),
        noiseScale: uniform(noiseScale),
        noiseSpeed: uniform(noiseSpeed),
        noiseGain: uniform(noiseGain),
        maskScale: uniform(maskScale),
        maskSpeed: uniform(maskSpeed),
        maskContrast: uniform(maskContrast),
        // Mouse interaction
        mousePos:         uniform(new Vector3()),
        mouseVel:         uniform(new Vector3()),
        mouseRadius:      uniform(mouseRadius),
        mouseStrength:    uniform(mouseStrength),
        mouseScatter:     uniform(mouseScatter),
        mouseGlowColor:   uniform(new Color(mouseGlowColor)),
        mouseGlowPassive: uniform(mouseGlowPassive),
        mouseGlowActive:  uniform(mouseGlowActive),
        mouseGlowPow:     uniform(mouseGlowPow),
        mouseGlowEnergy:  uniform(0),   // JS-side decaying glow energy, independent of spring
      };
      uniformsRef.current = u;

      // TSL material ────────────────────────────────────────────────────────
      const material = new MeshBasicNodeMaterial() as any;

      const seedAttr = attribute("instanceSeed", "float");
      const instNorm = attribute("instanceNormal", "vec3");
      // Per-sphere centre position for coherent noise sampling
      const instPos = attribute("instancePos", "vec3");
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
      const maskCoord = instPos
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
      const noiseCoord = instPos
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
      const toMouse    = u.mousePos.sub(instPos);
      const dist       = toMouse.length();
      const falloff    = clamp(
        float(1.0).sub(dist.div(u.mouseRadius)),
        float(0), float(1)
      );
      const impulseLen = u.mouseVel.length();
      // Travel direction — the cone axis and primary push direction
      const velDir     = normalize(u.mouseVel.add(vec3(0.0001, 0.0001, 0.0001)));
      // Per-particle unit vector on the sphere (normalised → circular, not cubic)
      const rawRand    = vec3(
        sin(seedAttr.mul(127.1)),
        cos(seedAttr.mul(311.7)),
        sin(seedAttr.mul(74.3).add(1.0))
      );
      const randUnit   = normalize(rawRand);
      // Perpendicular-to-velocity disc scatter → cone opening around velDir
      const onAxis     = velDir.mul(dot(randUnit, velDir));
      const perpToVel  = normalize(randUnit.sub(onAxis).add(vec3(0, 0.0001, 0)));
      // velDir is the base (filled circle); perpToVel scatter widens the cone
      const mouseDisp  = velDir
        .add(perpToVel.mul(u.mouseScatter))
        .mul(impulseLen)
        .mul(u.mouseStrength)
        .mul(falloff.mul(falloff));

      material.positionNode = positionLocal
        .mul(u.sphereSize)
        .add(floatDisp)
        .add(noiseDisp)
        .add(mouseDisp);

      // ── Shading: figure-level + sphere-local volume ───────────────────────
      //
      // Figure shading  — baked surface normal → overall light/shadow of figure.
      // Sphere shading  — normalLocal (icosahedron vertex) → 3-D depth per sphere.
      //
      // Wrapped diffuse: (dot(n,l) + wrap) / (1 + wrap)
      // volumeStrength blends between flat (figure only) and volumetric
      // (figure × sphere).

      const lightNorm = normalize(u.lightDir);

      const figureWrapped = clamp(
        dot(normalize(instNorm), lightNorm)
          .add(u.wrap)
          .div(float(1.0).add(u.wrap)),
        float(0),
        float(1),
      );

      const sphereWrapped = clamp(
        dot(normalize(normalLocal), lightNorm)
          .add(u.wrap)
          .div(float(1.0).add(u.wrap)),
        float(0),
        float(1),
      );

      const combined = mix(
        figureWrapped,
        figureWrapped.mul(sphereWrapped),
        u.volumeStrength,
      );
      const shading = u.ambient.add(combined.mul(float(1.0).sub(u.ambient)));

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
      const baseColor    = u.color.mul(shading);
      const glowFalloff  = pow(clamp(falloff, float(0), float(1)), u.mouseGlowPow);
      const passiveGlow  = glowFalloff.mul(u.mouseGlowPassive);
      // Active glow uses mouseGlowEnergy — a JS-side value that decays at its
      // own rate, independently of the spring physics.  This lets the glow
      // linger as a smooth trail even after particles have physically returned.
      const activeGlow   = glowFalloff.mul(u.mouseGlowEnergy).mul(u.mouseGlowActive);
      const glowFactor   = clamp(passiveGlow.add(activeGlow), float(0), float(1));
      material.colorNode = mix(baseColor, u.mouseGlowColor, glowFactor);

      instancedMesh.material = material;
      const group = new Group();
      group.position.set(modelX, modelY, modelZ);
      group.add(instancedMesh);
      scene.add(group);
      groupRef.current = group;
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
        const pp        = new PostProcessing(renderer);
        const scenePass = pass(scene, camera);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sceneColor = (scenePass as any).getTextureNode('output');

        const bloomPass = bloom(sceneColor, bloomStrength, bloomRadius, bloomThreshold);
        bloomNodeRef.current = bloomPass;

        const caStrengthU = uniform(chromaticStr);
        caUniformRef.current = caStrengthU;

        const combined  = sceneColor.add(bloomPass);
        const caPass    = chromaticAberration(combined, caStrengthU, new Vector2(0.5, 0.5));

        pp.outputNode   = caPass;
        postProcessing  = pp;
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
      const raycaster     = new Raycaster();
      const mouseNDC      = new Vector2();
      // Camera-facing plane — updated every frame so interaction works from any
      // orbit angle.  Passes through the model's world centre.
      const mousePlane    = new Plane();
      const mouseHit      = new Vector3();
      const modelCenter   = new Vector3();
      const cameraDir     = new Vector3();
      // targetMousePos: raw cursor position in model-local space (set on mousemove)
      // smoothMousePos: exponentially-smoothed virtual cursor (chases target with lag)
      const targetMousePos = new Vector3();
      const smoothMousePos = new Vector3();
      const prevMousePos   = new Vector3();
      const frameVel       = new Vector3();
      // smoothVel: exponentially-smoothed frame velocity (plain Vector3)
      // impVel:    spring velocity
      // impulse:   spring displacement → fed to shader as mouseVel
      const smoothVel     = new Vector3();
      const impVel        = new Vector3();
      const impulse       = new Vector3();
      let   glowEnergy    = 0;          // decays independently of the spring
      let   lastFrameTime = performance.now();
      let   mouseMoving   = false;
      let   moveTimer     = 0;
      const MOVE_TIMEOUT  = 0.06;
      let   mouseEverMoved = false;

      const onMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouseNDC.set(
          ((e.clientX - rect.left) / rect.width)  *  2 - 1,
          -((e.clientY - rect.top)  / rect.height) *  2 + 1,
        );
        raycaster.setFromCamera(mouseNDC, camera);
        if (raycaster.ray.intersectPlane(mousePlane, mouseHit)) {
          // Convert world hit to model-local space (instPos is stored without
          // group offset applied, so subtract the group's world position).
          const localPos = mouseHit.clone().sub(group.position);
          targetMousePos.copy(localPos);
          // Initialise smooth position on first move to avoid a startup snap
          if (!mouseEverMoved) {
            smoothMousePos.copy(localPos);
            prevMousePos.copy(localPos);
            mouseEverMoved = true;
          }
        }
        mouseMoving = true;
        moveTimer   = 0;
      };

      const onMouseLeave = () => { mouseMoving = false; };

      container.addEventListener("mousemove", onMouseMove);
      container.addEventListener("mouseleave", onMouseLeave);

      const animate = () => {
        if (disposed) return;
        animId = requestAnimationFrame(animate);

        const now   = performance.now();
        const delta = Math.min((now - lastFrameTime) / 1000, 0.1);
        lastFrameTime = now;

        moveTimer += delta;
        if (moveTimer > MOVE_TIMEOUT) mouseMoving = false;

        // Keep the projection plane perpendicular to the current camera view,
        // centred on the model — works correctly from any orbit angle.
        group.getWorldPosition(modelCenter);
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

        stats.begin();
        controls.update();
        if (postProcessing) {
          postProcessing.renderAsync();
        } else {
          renderer.renderAsync(scene, camera);
        }
        stats.end();
      };
      animate();

      cleanupInner = () => {
        window.removeEventListener("resize", onResize);
        container.removeEventListener("mousemove", onMouseMove);
        container.removeEventListener("mouseleave", onMouseLeave);
        sphereGeo.dispose();
        material.dispose();
        controls.dispose();
        stats.dom.remove();
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
  }, [url, particleCount]);

  // ── Realtime updates — mutate uniforms, no rebuild ────────────────────────
  useEffect(() => {
    if (controlsRef.current)
      controlsRef.current.autoRotateSpeed = autoRotateSpeed;
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
    if (uniformsRef.current)
      uniformsRef.current.maskContrast.value = maskContrast;
  }, [maskContrast]);

  useEffect(() => { if (uniformsRef.current) uniformsRef.current.mouseRadius.value   = mouseRadius;   }, [mouseRadius]);
  useEffect(() => { if (uniformsRef.current) uniformsRef.current.mouseStrength.value = mouseStrength; }, [mouseStrength]);
  useEffect(() => { springKRef.current       = springStiffness; }, [springStiffness]);
  useEffect(() => { springDampingRef.current = springDamping;   }, [springDamping]);
  useEffect(() => { pushStrengthRef.current  = pushStrength;    }, [pushStrength]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.mouseScatter.value = mouseScatter;
  }, [mouseScatter]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.mouseGlowColor.value.set(mouseGlowColor);
  }, [mouseGlowColor]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.mouseGlowPassive.value = mouseGlowPassive;
  }, [mouseGlowPassive]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.mouseGlowActive.value = mouseGlowActive;
  }, [mouseGlowActive]);
  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.mouseGlowPow.value = mouseGlowPow;
  }, [mouseGlowPow]);
  useEffect(() => { mouseGlowDecayRef.current = mouseGlowDecay; }, [mouseGlowDecay]);
  useEffect(() => { mouseLerpRef.current = mouseLerp; }, [mouseLerp]);

  // Post-processing
  useEffect(() => {
    if (bloomNodeRef.current) bloomNodeRef.current.strength.value = bloomStrength;
  }, [bloomStrength]);
  useEffect(() => {
    if (bloomNodeRef.current) bloomNodeRef.current.radius.value = bloomRadius;
  }, [bloomRadius]);
  useEffect(() => {
    if (bloomNodeRef.current) bloomNodeRef.current.threshold.value = bloomThreshold;
  }, [bloomThreshold]);
  useEffect(() => {
    if (caUniformRef.current) caUniformRef.current.value = chromaticStr;
  }, [chromaticStr]);

  // Model position
  useEffect(() => {
    if (groupRef.current) groupRef.current.position.set(modelX, modelY, modelZ);
  }, [modelX, modelY, modelZ]);

  // Light direction: update the single vec3 uniform whenever any component changes
  useEffect(() => {
    if (uniformsRef.current) {
      uniformsRef.current.lightDir.value
        .set(lightX, lightY, lightZ)
        .normalize();
    }
  }, [lightX, lightY, lightZ]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
