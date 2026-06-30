# Hologram Particles VFX

A real-time hologram particle effect built with Three.js WebGPU, TSL Node Shaders, and Next.js.
This repository is a free open-source resource for the creative development community.

It includes a fully interactive **3D Playground** to explore every parameter of the effect in real time — particle count, lighting, noise displacement, mouse interaction, model morphing, bloom, and more.

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square&logo=next.js)
![Three.js](https://img.shields.io/badge/Three.js-0.182-black?style=flat-square&logo=three.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![WebGPU](https://img.shields.io/badge/WebGPU-native-orange?style=flat-square)

---

https://github.com/user-attachments/assets/b0cf8dd1-9178-4018-b74a-cfabce1b08b9



> **Original design & concept — [igloo.inc](https://www.igloo.inc/)**
> Replica developed by Cortiz

---

## ✨ What is this?

**Hologram Particles VFX** is a production-quality WebGPU particle system that turns any GLB model into an animated holographic cloud of 60,000 instanced spheres.
It is designed as a learning resource and a starting point for similar VFX in interactive 3D projects.

Key highlights:

- **TSL Node Shaders** — all GPU logic written in JavaScript, no GLSL files
- **GPU compute physics** — fluid, cursor-driven particle interaction simulated on the GPU
- **WebGPU native** — runs on Three.js r182 WebGPU renderer
- **Any GLB** — load your own model via drag & drop, particles adapt automatically
- **Live model morphing** — smooth three-phase transition between GLB models
- **Fully parametric** — every visual property exposed via real-time GUI
- **Zero external shader libraries** — everything is hand-written in TSL

---

## ⚡ Particle System Features

### Geometry
- **InstancedMesh** — 60,000 icosahedron spheres rendered in a single draw call
- **GLB surface sampling** — positions and normals sampled via `MeshSurfaceSampler`, distributed proportionally by triangle area
- **Dual normal blending** — per-particle blend between figure surface normal and sphere local normal for micro-volume shading

### Shading (TSL)
- **Wrapped diffuse lighting** — two-light model with softened terminator (`wrap` parameter)
- **Volume strength** — blends figure macro-normal with sphere micro-normal for physical roundness
- **Fractal noise displacement** — `mx_fractal_noise_vec3` drives particle animation along surface normals
- **Animated noise mask** — controls which particles displace and by how much

### Mouse Interaction & Physics
- **GPU compute physics** — per-particle velocity + offset simulated in a TSL compute shader, scaling to all 60k particles
- **Fluid "pusher"** — a collider that follows the cursor and shoves particles in the direction of movement, like sweeping a hand through water (wave + turbulence, with an adjustable influence radius and full depth reach)
- **Spring-damper return** — particles glide back to rest with tunable stiffness and damping
- **Physics-driven glow** — particles light up based on how far they've been displaced, fading as they settle
- **Camera spring** — XY translation + Z roll driven by cursor NDC position

### Model Morphing
- **Three-phase state machine** — deform out → morph → reform
- **GPU lerp** — `mix(current, target, progress)` uniform drives all 60k particles simultaneously
- **Transition glow** — particles with greatest displacement bloom brightest during morph
- **Noise mask dissolve** — organic non-uniform deform controlled by mask contrast

### Scene Elements
- **Cylinder** — transparent Fresnel edge glow tube framing the figure, with optional **particle collision** so particles stay contained, bounce off the wall, and briefly cling before returning
- **Halo rings** — two pairs of rotating arcs at top and bottom of cylinder
- **Dot grid** — animated floor grid with wave brightness

### Post-processing
- **Bloom** — WebGPU native bloom node, luminance-threshold with tunable strength and radius

---

## 🔍 Debug Modes

Built-in debug visualizations for breakdown and presentation:

| Button | Mode | Shows |
|--------|------|-------|
| `WF` | Wireframe | Edge geometry of the loaded GLB |
| `FLAT` | Flat | Raw particle density, no lighting |
| `NRM` | Normals | Surface normals as RGB color |
| `NOI` | Noise | Raw fractal noise field as grayscale |
| `LIT` | Lit | Combined grayscale diffuse + ambient |
| `L1` | Light 1 | Light 1 contribution only |
| `L2` | Light 2 | Light 2 contribution only |

All debug modes hide scene decorations (cylinder, rings, grid, header) for clean capture.

---

## 🎮 3D Playground

A built-in development environment for exploring the effect in context.

### Controls
- Particle count, sphere size, auto-rotate speed
- Two-light rig — position, color, intensity per light
- Wrap, ambient, volume strength
- Noise amplitude, scale, speed, gain
- Pusher physics — collider size, influence radius, depth, wave & push force, return spring/damping
- Turbulence amount, scale, and speed
- Physics-driven glow sensitivity, intensity, and color
- Camera spring stiffness and damping
- Morph duration, reform duration, entrance animation with replay
- Cylinder collision — bounce and wall-cling hold time
- Cylinder, rings, and grid toggles with individual parameters
- Bloom strength and radius

---

## 🛠 Tech Stack

- **Framework:** Next.js 16.1 (App Router)
- **3D / WebGL:** Three.js 0.182 (WebGPU renderer)
- **Shaders:** TSL — Three.js Shading Language (GPU logic in JavaScript)
- **Post-processing:** Three.js WebGPU bloom node
- **GUI Controls:** Leva
- **Animation:** GSAP
- **Styling:** Tailwind CSS 4
- **Language:** TypeScript

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- A browser with WebGPU support (Chrome 113+, Edge 113+)

### Installation

```bash
# Clone the repository
git clone https://github.com/cortiz2894/creative-boilerplate.git

# Navigate to the project
cd creative-boilerplate

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to explore the effect.

> **Note:** WebGPU is required. If the canvas is blank, check that your browser supports WebGPU at [webgpureport.org](https://webgpureport.org).

---

## 👨‍💻 Author

**Christian Ortiz** — Creative Developer

## 🔗 Connect

- **Portfolio:** [cortiz.dev](https://cortiz.dev)
- **YouTube:** [@cortizdev](https://youtube.com/@cortizdev)
- **X (Twitter):** [@cortiz2894](https://twitter.com/cortiz2894)
- **LinkedIn:** [Christian Daniel Ortiz](https://linkedin.com/in/christian-daniel-ortiz)

## 📬 Contact

For inquiries, collaborations or questions: **cortiz2894@gmail.com**

---

⭐ If you found this useful, consider subscribing to my [YouTube channel](https://youtube.com/@cortizdev) for more creative development content!
