"use client";

import dynamic from "next/dynamic";
import type { ParticlesHologramProps } from "./ParticlesHologram";

const ParticlesHologram = dynamic(
  () => import("./ParticlesHologram"),
  { ssr: false }
);

export default function HologramScene(props: ParticlesHologramProps) {
  return <ParticlesHologram {...props} />;
}
