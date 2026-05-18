"use client";

import { useEffect, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import {
  BufferGeometry,
  BufferAttribute,
  Color,
  Points,
  Box3,
  Vector3,
  Mesh,
} from "three";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { PointsNodeMaterial } from "three/webgpu";
import {
  positionLocal,
  attribute,
  sin,
  cos,
  time,
  uniform,
  vec3,
  vec4,
  float,
  mix,
} from "three/tsl";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

export interface HologramControls {
  particleCount: number;
  colorBase: string;
  colorBright: string;
  scanFreq: number;
  scanSpeed: number;
  floatAmp: number;
  sizeBase: number;
  sizeVar: number;
}

interface ParticlesHologramSceneProps extends HologramControls {
  url: string;
  onLoaded?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sampleGeometry(
  gltfScene: import("three").Object3D,
  particleCount: number
): BufferGeometry {
  // Centre + normalise the scene so the model fits inside a ~3-unit box
  const bbox = new Box3().setFromObject(gltfScene);
  const centre = new Vector3();
  bbox.getCenter(centre);
  gltfScene.position.sub(centre);
  gltfScene.updateMatrixWorld(true);

  const bbox2 = new Box3().setFromObject(gltfScene);
  const sizeVec = new Vector3();
  bbox2.getSize(sizeVec);
  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
  gltfScene.scale.setScalar(maxDim > 0 ? 3 / maxDim : 1);
  gltfScene.updateMatrixWorld(true);

  // Collect all mesh surfaces
  const meshes: Mesh[] = [];
  gltfScene.traverse((child: import("three").Object3D) => {
    if ((child as Mesh).isMesh) meshes.push(child as Mesh);
  });

  const positions = new Float32Array(particleCount * 3);
  const seeds = new Float32Array(particleCount);
  const tempPos = new Vector3();

  let filled = 0;
  const perMesh = Math.floor(particleCount / meshes.length);

  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    const count = m < meshes.length - 1 ? perMesh : particleCount - filled;
    const sampler = new MeshSurfaceSampler(mesh).build();

    for (let i = 0; i < count; i++) {
      sampler.sample(tempPos);
      mesh.localToWorld(tempPos);
      const base = (filled + i) * 3;
      positions[base] = tempPos.x;
      positions[base + 1] = tempPos.y;
      positions[base + 2] = tempPos.z;
      seeds[filled + i] = Math.random();
    }
    filled += count;
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setAttribute("seed", new BufferAttribute(seeds, 1));
  return geo;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ParticlesHologramScene({
  url,
  onLoaded,
  particleCount,
  colorBase,
  colorBright,
  scanFreq,
  scanSpeed,
  floatAmp,
  sizeBase,
  sizeVar,
}: ParticlesHologramSceneProps) {
  const { scene } = useGLTF(url);

  // TSL uniform nodes – created once, updated via individual effects below
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniformsRef = useRef<Record<string, any> | null>(null);
  function getUniforms() {
    if (!uniformsRef.current) {
      uniformsRef.current = {
        colorBase: uniform(new Color(colorBase)),
        colorBright: uniform(new Color(colorBright)),
        scanFreq: uniform(scanFreq),
        scanSpeed: uniform(scanSpeed),
        floatAmp: uniform(floatAmp),
        sizeBase: uniform(sizeBase),
        sizeVar: uniform(sizeVar),
      };
    }
    return uniformsRef.current;
  }

  // Stable material ref (created once alongside uniforms, reused across geometry rebuilds)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materialRef = useRef<any>(null);

  // Points state drives the <primitive> render
  const [points, setPoints] = useState<Points | null>(null);

  // ── Build / rebuild geometry when model or count changes ────────────────
  useEffect(() => {
    const u = getUniforms();

    // Build TSL material on first run
    if (!materialRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mat = new PointsNodeMaterial({
        transparent: true,
        depthWrite: false,
        sizeAttenuation: false,
      } as any);

      const seedAttr = attribute("seed", "float");
      const phase = seedAttr.mul(Math.PI * 2);

      // Per-particle floating oscillation driven by u.floatAmp uniform
      mat.positionNode = positionLocal.add(
        vec3(
          cos(time.mul(1.3).add(phase)).mul(u.floatAmp).mul(0.6),
          sin(time.mul(1.6).add(phase)).mul(u.floatAmp),
          sin(time.mul(1.1).add(phase.add(1.0))).mul(u.floatAmp).mul(0.6)
        )
      );

      // Scanline sweep using uniform freq/speed
      const scanline = sin(
        positionLocal.y.mul(u.scanFreq).add(time.mul(u.scanSpeed))
      )
        .mul(0.5)
        .add(0.5);

      // Subtle per-particle flicker
      const flicker = sin(time.mul(20.0).add(seedAttr.mul(60.0)))
        .mul(0.04)
        .add(0.96);

      mat.colorNode = vec4(
        mix(u.colorBase, u.colorBright, scanline),
        scanline.mul(0.35).add(0.55).mul(flicker)
      );

      // Size in screen pixels: sizeBase + sizeVar * scanline
      mat.sizeNode = float(u.sizeBase).add(float(u.sizeVar).mul(scanline));

      materialRef.current = mat;
    }

    const geo = sampleGeometry(scene, particleCount);
    const pts = new Points(geo, materialRef.current);
    setPoints(pts);
    onLoaded?.();

    return () => {
      geo.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, particleCount]);

  // Dispose material on unmount
  useEffect(() => {
    return () => {
      materialRef.current?.dispose();
      materialRef.current = null;
      uniformsRef.current = null;
    };
  }, []);

  // ── Realtime uniform updates (no geometry rebuild) ──────────────────────
  useEffect(() => {
    uniformsRef.current?.colorBase.value.set(colorBase);
  }, [colorBase]);

  useEffect(() => {
    uniformsRef.current?.colorBright.value.set(colorBright);
  }, [colorBright]);

  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.scanFreq.value = scanFreq;
  }, [scanFreq]);

  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.scanSpeed.value = scanSpeed;
  }, [scanSpeed]);

  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.floatAmp.value = floatAmp;
  }, [floatAmp]);

  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.sizeBase.value = sizeBase;
  }, [sizeBase]);

  useEffect(() => {
    if (uniformsRef.current) uniformsRef.current.sizeVar.value = sizeVar;
  }, [sizeVar]);

  if (!points) return null;
  return <primitive object={points} />;
}
