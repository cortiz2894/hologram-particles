import Link from "next/link";
import HologramScene from "@/components/playground/HologramScene";
import styles from "./hologram.module.css";

export default function HologramPage() {
  return (
    <div className={styles.root}>
      <HologramScene url="/glb/bd1.glb" />

      {/* Top bar */}
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← HOME
        </Link>
        <div className={styles.meta}>
          <span className={styles.metaTitle}>PARTICLES HOLOGRAM</span>
          <span className={styles.metaDivider}>/</span>
          <span>TSL · WebGPU</span>
          <span className={styles.metaDivider}>/</span>
          <span>80K PARTICLES</span>
        </div>
      </header>

      {/* Bottom hint */}
      <footer className={styles.footer}>
        DRAG TO ORBIT · SCROLL TO ZOOM
      </footer>
    </div>
  );
}
