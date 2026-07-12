# Orbital Mechanics Sandbox — Full Technical Specification

> **Document version:** 1.0  
> **Target file:** `portfolio/templates/space_physics/pages/orbital_mechanics.html`  
> **Route:** `/space-physics/orbital-mechanics`  
> **Status:** Pre-development specification  
> **Author:** Engineering reference document

---

## Table of Contents

1. [Overview & Pedagogical Goals](#1-overview--pedagogical-goals)
2. [Physics Engine — Full Mathematical Specification](#2-physics-engine--full-mathematical-specification)
3. [Rendering & 3D Visualization](#3-rendering--3d-visualization)
4. [Game Mechanics & Mission Structure](#4-game-mechanics--mission-structure)
5. [UI/UX Design](#5-uiux-design)
6. [Dependencies & Technical Requirements](#6-dependencies--technical-requirements)
7. [Integration with Flask/Jinja2 Site Structure](#7-integration-with-flaskjinja2-site-structure)

---

## 1. Overview & Pedagogical Goals

### 1.1 What the User Learns

The Orbital Mechanics Sandbox is a **discovery-first interactive laboratory** in which the user pilots a spacecraft through progressively harder missions. Unlike a lecture or video, the lab teaches through *consequence*: wrong burns waste fuel, wrong timing misses orbital insertion windows, and the spacecraft may escape the solar system or crash into a planet. The learner is never lectured at; physics emerges as the only vocabulary that explains what they are seeing.

By completing all five missions the user will have internalized:

| Concept | Emergent through |
|---|---|
| Why orbits are ellipses, not circles | Sandbox free-play and Mission 1 |
| Conservation of energy and angular momentum | Integrator error display, failed maneuvers |
| Why rocket burns are short impulsive events | Delta-v budget running out |
| Why Hohmann transfers are fuel-optimal | Comparing direct vs. Hohmann cost |
| Why gravity assists feel free | Mission 5 reference-frame toggle |
| Patched conic approximation limitations | Sphere-of-influence boundary visualization |
| Why timing matters for interplanetary windows | Mission 4 launch-window slider |

### 1.2 Discovery-First Design Principles

**Principle 1 — Minimal Instruction.** Each mission begins with only a short briefing card (< 60 words). No equations are shown to the user by default. A toggleable Physics Notes panel is available for those who want the math.

**Principle 2 — Immediate Feedback.** Every burn fires in real time. Trajectory prediction arcs update within a single animation frame after burn parameters change.

**Principle 3 — Safe Failure.** Failure is always reversible. The user can reset to mission start or rewind to any checkpoint. Ghost orbits from previous attempts overlay the scene so the user can reason about what changed.

**Principle 4 — Progressive Revelation.** Advanced HUD elements (orbital elements, phase-space view) are hidden behind an expert mode toggle so beginners are not overwhelmed.

**Principle 5 — Physical Authenticity.** All numbers are real: Earth mass is 5.972e24 kg, the AU is 1.496e11 m, and delta-v budgets match real mission profiles. Simplifications are documented in the Physics Notes panel.

### 1.3 Difficulty Progression

```text
Mission 1 → Simple circular orbit (1 burn, no timing)
Mission 2 → Hohmann transfer (2 burns, timing trivial)
Mission 3 → Moon flyby & return (3 burns, patched conics, re-entry)
Mission 4 → Earth to Mars (2 burns, launch window alignment)
Mission 5 → Gravity assist off Jupiter (3+ burns, reference-frame reasoning)
```

Each mission unlocks only after the previous one is completed. Partial credit is awarded for orbits within 5% of target parameters, which unlocks the next mission but leaves a gold-star achievement uncollected.

---

## 2. Physics Engine — Full Mathematical Specification

### 2.1 N-Body Gravitational Equations (Vector Form)

The simulation maintains a list of N bodies. Body i has position $\mathbf{r}_i \in \mathbb{R}^3$, velocity $\mathbf{v}_i \in \mathbb{R}^3$, and mass $m_i$. The gravitational acceleration of body i due to all other bodies is:

$$\mathbf{a}_i = -G \sum_{\substack{j=1 \\ j \neq i}}^{N} \frac{m_j \left(\mathbf{r}_i - \mathbf{r}_j\right)}{\left|\mathbf{r}_i - \mathbf{r}_j\right|^3}$$

where $G = 6.674 \times 10^{-11}\,\text{N}\,\text{m}^2\,\text{kg}^{-2}$.

**Softening parameter.** To prevent singularities, add softening length $\varepsilon = 10^4\,\text{m}$:

$$\mathbf{a}_i = -G \sum_{j \neq i} \frac{m_j \left(\mathbf{r}_i - \mathbf{r}_j\right)}{\left(\left|\mathbf{r}_i - \mathbf{r}_j\right|^2 + \varepsilon^2\right)^{3/2}}$$

**State vector.** The full simulation state at time t:

$$\mathbf{S}(t) = \left[\mathbf{r}_1,\,\mathbf{v}_1,\,\mathbf{r}_2,\,\mathbf{v}_2,\,\ldots,\,\mathbf{r}_N,\,\mathbf{v}_N\right] \in \mathbb{R}^{6N}$$

**Implementation note.** For Missions 1-4 the spacecraft mass is negligible ($m_\text{ship} \approx 0$), so planets do not accelerate due to the spacecraft. Full N-body is reserved for Mission 5 and sandbox mode where $N \leq 6$.

### 2.2 RK4 Integrator — Step-by-Step

The 4th-order Runge-Kutta method integrates $\dot{\mathbf{S}} = f(\mathbf{S}, t)$ with step $\Delta t$.

Let $\mathbf{S}_n$ be the state at $t_n$. The next state $\mathbf{S}_{n+1}$ at $t_{n+1} = t_n + \Delta t$ is:

$$\mathbf{k}_1 = f\!\left(\mathbf{S}_n,\; t_n\right)$$

$$\mathbf{k}_2 = f\!\left(\mathbf{S}_n + \tfrac{\Delta t}{2}\,\mathbf{k}_1,\; t_n + \tfrac{\Delta t}{2}\right)$$

$$\mathbf{k}_3 = f\!\left(\mathbf{S}_n + \tfrac{\Delta t}{2}\,\mathbf{k}_2,\; t_n + \tfrac{\Delta t}{2}\right)$$

$$\mathbf{k}_4 = f\!\left(\mathbf{S}_n + \Delta t\,\mathbf{k}_3,\; t_n + \Delta t\right)$$

$$\mathbf{S}_{n+1} = \mathbf{S}_n + \frac{\Delta t}{6}\left(\mathbf{k}_1 + 2\mathbf{k}_2 + 2\mathbf{k}_3 + \mathbf{k}_4\right)$$

RK4 local truncation error: $\mathcal{O}(\Delta t^5)$. Global error: $\mathcal{O}(\Delta t^4)$.

**Pseudocode (JavaScript):**

```javascript
const G   = 6.674e-11;
const EPS = 1e4;

function computeDerivatives(S, t, bodies) {
  const dS = new Float64Array(S.length);
  for (let i = 0; i < bodies.length; i++) {
    const base = i * 6;
    dS[base + 0] = S[base + 3]; // dx/dt = vx
    dS[base + 1] = S[base + 4]; // dy/dt = vy
    dS[base + 2] = S[base + 5]; // dz/dt = vz
    let ax = 0, ay = 0, az = 0;
    for (let j = 0; j < bodies.length; j++) {
      if (i === j) continue;
      const jbase = j * 6;
      const dx = S[base]     - S[jbase];
      const dy = S[base + 1] - S[jbase + 1];
      const dz = S[base + 2] - S[jbase + 2];
      const dist2 = dx*dx + dy*dy + dz*dz + EPS*EPS;
      const coeff = -G * bodies[j].mass / Math.pow(dist2, 1.5);
      ax += coeff * dx;
      ay += coeff * dy;
      az += coeff * dz;
    }
    dS[base + 3] = ax;
    dS[base + 4] = ay;
    dS[base + 5] = az;
  }
  return dS;
}

function addScaled(S, k, scale) {
  const result = new Float64Array(S.length);
  for (let i = 0; i < S.length; i++) result[i] = S[i] + scale * k[i];
  return result;
}

function rk4Step(S, t, dt, bodies) {
  const k1 = computeDerivatives(S,                      t,        bodies);
  const k2 = computeDerivatives(addScaled(S, k1, dt/2), t + dt/2, bodies);
  const k3 = computeDerivatives(addScaled(S, k2, dt/2), t + dt/2, bodies);
  const k4 = computeDerivatives(addScaled(S, k3, dt),   t + dt,   bodies);
  const Snew = new Float64Array(S.length);
  for (let i = 0; i < S.length; i++) {
    Snew[i] = S[i] + (dt / 6) * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]);
  }
  return Snew;
}
```

**Recommended base time step:** $\Delta t = 10\,\text{s}$ at 1x warp. At 1000x warp, perform 300 steps per animation frame (see Section 4.6). Never increase $\Delta t$ to implement warp — only increase steps per frame.

### 2.3 Patched Conic Approximation

The patched conic approximation replaces the N-body problem with a sequence of two-body problems. A spacecraft operates under exactly one body at a time, switching when it crosses a **Sphere of Influence (SOI)** boundary.

#### 2.3.1 Sphere of Influence Radius

The SOI radius of a planet of mass $m_p$ orbiting a star of mass $M_\star$ at semi-major axis $a_p$:

$$r_\text{SOI} = a_p \left(\frac{m_p}{M_\star}\right)^{2/5}$$

| Body | Reference | SOI Radius |
|---|---|---|
| Earth | Sun | 9.25e8 m (925,000 km) |
| Moon | Earth | 6.62e7 m (66,200 km) |
| Mars | Sun | 5.77e8 m (577,000 km) |
| Jupiter | Sun | 4.82e10 m (48,200,000 km) |

#### 2.3.2 SOI Handoff Algorithm

```
Every integration step:
  for each planet P (sorted by mass descending):
    d = |ship_pos_world - P.pos_world|
    if d < P.soi_radius:
      if ship.current_parent != P:
        // Entering P's SOI — convert state to P's reference frame
        ship.current_parent = P
        ship.local_vel = ship.vel_world - P.vel_world
      break
  else:
    ship.current_parent = Star
```

**Velocity continuity at handoff:**

$$\mathbf{v}_\text{new frame} = \mathbf{v}_\text{world} - \mathbf{v}_\text{new parent}$$

This ensures no discontinuity in either position or velocity.

### 2.4 Hohmann Transfer Orbit Mathematics

A Hohmann transfer is the fuel-minimum two-impulse transfer between two coplanar circular orbits.

Let $r_1$ = initial orbit radius, $r_2$ = target orbit radius, $\mu = GM$ for the central body.

**Semi-major axis of transfer ellipse:**

$$a_t = \frac{r_1 + r_2}{2}$$

**First burn delta-v (prograde at periapsis):**

$$\Delta v_1 = \sqrt{\frac{\mu}{r_1}}\left(\sqrt{\frac{2 r_2}{r_1 + r_2}} - 1\right)$$

**Second burn delta-v (prograde at apoapsis):**

$$\Delta v_2 = \sqrt{\frac{\mu}{r_2}}\left(1 - \sqrt{\frac{2 r_1}{r_1 + r_2}}\right)$$

**Total delta-v:**

$$\Delta v_\text{total} = \Delta v_1 + \Delta v_2$$

**Transfer time (half orbital period):**

$$T_\text{transfer} = \pi \sqrt{\frac{a_t^3}{\mu}}$$

**Example — Mission 2 (LEO to GEO):**

- $r_1 = 6{,}778\,\text{km}$, $r_2 = 42{,}164\,\text{km}$, $\mu_\oplus = 3.986 \times 10^{14}\,\text{m}^3\text{s}^{-2}$
- $\Delta v_1 = 2.44\,\text{km/s}$, $\Delta v_2 = 1.48\,\text{km/s}$, total $= 3.92\,\text{km/s}$
- Transfer time $= 5.25\,\text{hours}$

### 2.5 Gravitational Assist / Slingshot

#### 2.5.1 Reference Frame Analysis

In the planet's rest frame, the spacecraft approaches with hyperbolic excess speed $u_\infty$ and departs with the same speed but a different direction. Speed in the planet frame is conserved:

$$|\mathbf{u}_\infty^\text{in}| = |\mathbf{u}_\infty^\text{out}| = u_\infty$$

The deflection angle $\delta$ depends on periapsis distance $r_p$ and planet gravitational parameter $\mu_p$:

$$\sin\!\left(\frac{\delta}{2}\right) = \frac{1}{1 + \dfrac{r_p\,u_\infty^2}{\mu_p}}$$

#### 2.5.2 Velocity Boost in Heliocentric Frame

Converting back to the heliocentric frame:

$$\mathbf{v}_\text{out,helio} = \mathbf{u}_\infty^\text{out} + \mathbf{V}_\text{planet}$$

Maximum heliocentric boost (exit parallel to planet velocity):

$$\Delta v_\text{assist,max} = 2 u_\infty \sin\!\left(\frac{\delta}{2}\right)$$

**Implementation note:** In the patched conic model, the boost is automatic. No special formula is coded. The SOI handoff (Section 2.3.2) naturally applies the planet velocity offset when the spacecraft exits the SOI, yielding the speed gain.

#### 2.5.3 Visualization (Mission 5 Reference Frame Toggle)

When the user activates the reference frame toggle:
- All rendered velocities subtract $\mathbf{V}_\text{Jupiter}$
- Jupiter is shown at rest at the canvas center
- The spacecraft hyperbolic trajectory is symmetric (same speed in and out)
- An arrow overlay shows $\mathbf{V}_\text{Jupiter}$ being added back in the fixed frame

This allows the student to directly observe why kinetic energy increases in the heliocentric frame without violating any conservation law.

### 2.6 Escape Velocity

The escape velocity from a body at distance $r$:

$$v_\text{esc} = \sqrt{\frac{2\mu}{r}} = \sqrt{2}\,v_\text{circ}(r)$$

where $v_\text{circ}(r) = \sqrt{\mu/r}$ is circular orbital speed at the same radius.

**HUD integration.** Compute and display $v / v_\text{esc}$ as a progress bar labelled Escape fraction. When it reaches 100%, show banner: ESCAPE TRAJECTORY — leaving [body]'s gravity.

### 2.7 Orbital Elements from State Vector

Given $\mathbf{r}$ (position) and $\mathbf{v}$ (velocity) relative to the central body:

**Specific orbital energy:**

$$\mathcal{E} = \frac{|\mathbf{v}|^2}{2} - \frac{\mu}{|\mathbf{r}|}$$

- $\mathcal{E} < 0$: bound (elliptical)
- $\mathcal{E} = 0$: parabolic escape
- $\mathcal{E} > 0$: hyperbolic escape

**Semi-major axis:**

$$a = -\frac{\mu}{2\mathcal{E}}$$

**Specific angular momentum:**

$$\mathbf{h} = \mathbf{r} \times \mathbf{v}$$

**Eccentricity vector** (points toward periapsis, magnitude = eccentricity):

$$\mathbf{e} = \frac{\mathbf{v} \times \mathbf{h}}{\mu} - \frac{\mathbf{r}}{|\mathbf{r}|}, \qquad e = |\mathbf{e}|$$

**Inclination (3D mode):**

$$i = \arccos\!\left(\frac{h_z}{|\mathbf{h}|}\right)$$

**True anomaly:**

$$\nu = \arccos\!\left(\frac{\mathbf{e} \cdot \mathbf{r}}{e\,|\mathbf{r}|}\right)$$

If $\mathbf{r} \cdot \mathbf{v} < 0$, set $\nu \leftarrow 2\pi - \nu$ (past apoapsis).

**Periapsis and apoapsis:**

$$r_\text{peri} = a(1 - e), \quad r_\text{apo} = a(1 + e)$$

$$h_\text{peri} = r_\text{peri} - R_\text{body}, \quad h_\text{apo} = r_\text{apo} - R_\text{body}$$

These six values ($a$, $e$, $h_\text{peri}$, $h_\text{apo}$, $\nu$, $i$) are recomputed every frame from the live state vector.

### 2.8 Conservation Checks — Integrator Accuracy Monitor

**Specific mechanical energy:**

$$E = \frac{|\mathbf{v}|^2}{2} - \sum_{j} \frac{G m_j}{|\mathbf{r} - \mathbf{r}_j|}$$

**Relative energy drift** (measured per orbital arc between burns):

$$\delta E = \frac{|E - E_0|}{|E_0|}$$

- $\delta E > 10^{-4}$: HUD badge yellow (Warning: integrator drift)
- $\delta E > 10^{-3}$: HUD badge red + automatic $\Delta t$ halving

**Angular momentum:**

$$\mathbf{L} = \mathbf{r} \times \mathbf{v}$$

Display $|\mathbf{L}| / |\mathbf{L}_0| - 1$ alongside energy drift.

```javascript
class ConservationMonitor {
  constructor() { this.E0 = null; this.L0 = null; }

  snapshot(E, L) { this.E0 = E; this.L0 = L; }

  check(E, L) {
    const dE = Math.abs((E - this.E0) / this.E0);
    const dL = Math.abs((Math.abs(L) - Math.abs(this.L0)) / Math.abs(this.L0));
    return { dE, dL, warn: dE > 1e-4 || dL > 1e-4, error: dE > 1e-3 };
  }
}
```

### 2.9 Delta-V Budget System

The Tsiolkovsky rocket equation for reference:

$$\Delta v = v_e \ln\!\left(\frac{m_0}{m_f}\right)$$

This simulator does **not** model propellant mass. Instead each mission starts with a finite delta-v budget (km/s), decremented per burn:

$$\Delta v_\text{remaining} \mathrel{-}= |\Delta \mathbf{v}_\text{burn}|$$

**Impulsive burn application:**

$$\mathbf{v} \leftarrow \mathbf{v} + \Delta v \cdot \hat{\mathbf{d}}$$

**Direction basis vectors** (computed from current state):

| Direction | Formula | Keyboard |
|---|---|---|
| Prograde $\hat{\mathbf{t}}$ | $\mathbf{v}/|\mathbf{v}|$ | W |
| Retrograde | $-\hat{\mathbf{t}}$ | S |
| Radial-out $\hat{\mathbf{r}}$ | $\mathbf{r}/|\mathbf{r}|$ | A |
| Radial-in | $-\hat{\mathbf{r}}$ | D |
| Normal (3D) | $\hat{\mathbf{r}} \times \hat{\mathbf{t}}$ | N |

A fuel bar with an optimal-budget marker shows how far the user's maneuver deviates from the theoretical minimum.

---

## 3. Rendering & 3D Visualization

### 3.1 Recommendation: Three.js (WebGL) with Canvas 2D Fallback

| Criterion | Canvas 2D | Three.js WebGL |
|---|---|---|
| Orbit trails (10,000 points) | Slow — full redraw every frame | GPU buffer; near-zero CPU cost |
| Camera rotation | Not possible | Built-in OrbitControls |
| Planet spheres with texture | drawImage workaround | Native SphereGeometry + MeshStandardMaterial |
| SOI bubble transparency | Not possible in 2D | THREE.MeshBasicMaterial opacity |
| Browser support | Universal | 97%+ (WebGL 1 suffices for r158) |
| Bundle overhead | 0 KB | ~600 KB (Three.js r158 module) |

**Decision: Three.js is the primary render path.** Canvas 2D is the fallback for Missions 1-2 only when WebGL is unavailable.

### 3.2 Coordinate System Design

All simulation math runs in SI units (meters, seconds, kilograms). Three.js render units are scaled separately per scene context:

| Scene context | Three.js 1 unit = | Usage |
|---|---|---|
| Solar system (Missions 4-5) | 1 AU = 1.496e11 m | Interplanetary scale |
| Earth system (Missions 1-2) | 1 Earth radius = 6.371e6 m | LEO / GEO |
| Moon system (Mission 3) | 1 Moon radius = 1.737e6 m | Lunar approach |

Conversion: `threePos = simPos_SI / sceneScale`

### 3.3 Camera: Three.js OrbitControls

```javascript
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.05;
controls.minDistance    = 0.001;
controls.maxDistance    = 200;
controls.zoomSpeed      = 1.2;
controls.rotateSpeed    = 0.4;
```

**Focus-on-body mode** (double-click any body):

```javascript
import * as TWEEN from '@tweenjs/tween.js';

function focusOn(targetPos) {
  new TWEEN.Tween(controls.target)
    .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 600)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .start();
}
// Call TWEEN.update() inside the animation loop.
```

### 3.4 Trajectory Trail Rendering

**Ring buffer:**

```javascript
const TRAIL_MAX = 4096;

class TrailBuffer {
  constructor() {
    this.positions = new Float32Array(TRAIL_MAX * 3);
    this.head = 0;
    this.count = 0;
  }
  push(x, y, z) {
    const i = this.head * 3;
    this.positions[i] = x; this.positions[i+1] = y; this.positions[i+2] = z;
    this.head  = (this.head + 1) % TRAIL_MAX;
    this.count = Math.min(this.count + 1, TRAIL_MAX);
  }
}
```

**Fading alpha.** Per-segment alpha formula:

$$\alpha_i = \alpha_\text{max} \cdot \left(\frac{i}{N_\text{trail}}\right)^{1.5}$$

Because THREE.LineBasicMaterial does not support per-vertex alpha, use a THREE.ShaderMaterial:

```javascript
const trailMat = new THREE.ShaderMaterial({
  transparent: true,
  vertexShader: `
    attribute float aAlpha;
    varying   float vAlpha;
    void main() {
      vAlpha      = aAlpha;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3  uColor;
    varying float vAlpha;
    void main() { gl_FragColor = vec4(uColor, vAlpha); }
  `,
  uniforms: { uColor: { value: new THREE.Color(0x00ff88) } },
});
```

Update the `aAlpha` BufferAttribute every frame with new fading values.

### 3.5 Predicted Orbit Arc (Keplerian Prediction)

Compute the future trajectory analytically from the current state vector (Section 2.7). Sample 512 evenly-spaced true anomaly values $\nu \in [0, 2\pi]$:

$$r(\nu) = \frac{a(1-e^2)}{1 + e\cos\nu}$$

$$\mathbf{r}_\text{world}(\nu) = R(\omega)\begin{pmatrix}r(\nu)\cos\nu \\ r(\nu)\sin\nu\end{pmatrix}$$

where $R(\omega)$ is a 2D rotation by argument of periapsis $\omega$ (angle of eccentricity vector from reference direction).

**SOI clipping:** Stop sampling and draw an asymptote arrow when $r(\nu) > r_\text{SOI}$.

Render as white dashed line at 60% opacity. Rebuild only on burn events (debounced), not every animation frame.

### 3.6 Ghost Orbit from Previous Attempt

On mission reset, snapshot the current `TrailBuffer` into a `GhostTrail` array. Render with alpha 0.2, color `#666666`. A toggle button shows/hides it. This enables direct before/after comparison of maneuvers.

### 3.7 Sphere of Influence Rendering

Render two components per body with a defined SOI:

1. **Transparent volume sphere** (alpha 0.05, blue `0x4488ff`, `depthWrite: false`)
2. **Equatorial ring** (alpha 0.4) using `THREE.RingGeometry` rotated $\pi/2$
3. **Billboard label sprite** (`THREE.Sprite`) showing body name and SOI distance in km

```javascript
// SOI transparent sphere
const soiMesh = new THREE.Mesh(
  new THREE.SphereGeometry(soiR, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.05, depthWrite: false })
);
```

---

## 4. Game Mechanics & Mission Structure

### 4.1 Mission 1 — Simple Circular Orbit

**Brief:** You are in low Earth orbit. Make it stable. A circular orbit stays the same height all the way around.

**Initial conditions:**
- Altitude: 200 km, eccentricity e = 0.02 (slightly elliptical)
- Speed: 98% of circular velocity at that altitude (~7.68 km/s)
- Delta-v budget: 0.5 km/s

**Success conditions (must hold for at least one full orbital period):**
1. Eccentricity $e < 0.01$
2. Periapsis altitude $h_\text{peri} > 100\,\text{km}$

**Partial credit:** $e < 0.05$, $h_\text{peri} > 100\,\text{km}$ → Stable but elliptical badge, unlocks Mission 2.

**Failure conditions:**
- $h_\text{peri} < 80\,\text{km}$: ATMOSPHERE ENTRY — reset prompt
- $\Delta v_\text{remaining} < 0$: OUT OF FUEL
- $e > 1$: ESCAPE TRAJECTORY

**Hints (unlocked sequentially, each after 60 s):**
1. Try a prograde burn at your lowest point.
2. Burn until Periapsis = Apoapsis on the HUD.
3. Fire ~0.08 km/s prograde at periapsis.

**Learning goals:** What makes an orbit circular; prograde = raise opposite side; retrograde = lower opposite side.

### 4.2 Mission 2 — Hohmann Transfer (LEO to GEO)

**Brief:** A satellite is waiting at GEO (35,786 km altitude). Reach it using exactly 2 burns. Minimize fuel.

**Initial conditions:**
- Circular LEO, altitude 400 km, $v_c = 7.669\,\text{km/s}$
- GEO target ring: dashed gold circle at 42,164 km radius
- Delta-v budget: 6.0 km/s (optimal: 3.92 km/s)

**Success conditions:**
1. Apoapsis within 500 km of GEO radius
2. Eccentricity $e < 0.002$
3. Orbital period within 1% of 86,164 s

**Fuel efficiency score:**

$$\text{Score} = \max\!\left(0,\; 1 - \frac{\Delta v_\text{used} - \Delta v_\text{optimal}}{\Delta v_\text{optimal}}\right) \times 100\%$$

**Failure conditions:** Fuel exhausted before GEO; escape trajectory; reentry.

**Hints (every 60 s):**
1. A Hohmann transfer uses exactly two burns.
2. First burn: prograde here to raise apoapsis to GEO altitude.
3. Wait half an orbit (~5.2 hours at 1000x). Second burn: prograde at apoapsis.
4. Optimal delta-v is 3.92 km/s total.

### 4.3 Mission 3 — Moon Flyby and Return

**Brief:** Fly to the Moon, orbit it briefly, and return to Earth orbit.

**Initial conditions:**
- Circular Earth orbit, altitude 185 km, $v = 7.79\,\text{km/s}$
- Moon at correct position for free-return trajectory
- Delta-v budget: 4.0 km/s

**Required burns:**

| Burn | Name | Delta-v | Direction |
|---|---|---|---|
| 1 | TLI | ~3.12 km/s | Prograde at Earth perigee |
| 2 | LOI | ~0.90 km/s | Retrograde at periselene |
| 3 | TEI | ~0.90 km/s | Prograde at periselene |

**Success conditions — three phases:**
1. Enter Moon SOI and achieve orbit with $h_\text{peri,Moon} < 200\,\text{km}$
2. Exit Moon SOI on trajectory toward Earth
3. Hit Earth atmosphere at $80 < h < 130\,\text{km}$ with flight path angle $-12° < \gamma < -4°$

**Flight path angle** $\gamma = \arcsin(\mathbf{v} \cdot \hat{\mathbf{r}} / |\mathbf{v}|)$ — negative when descending.

**Failure conditions:**
- Moon surface impact ($h < 0$)
- Reentry outside corridor ($\gamma < -12°$ too steep; $\gamma > -4°$ skips off atmosphere)
- Escape Earth SOI on return
- Fuel exhaustion

**Hints (every 60 s):**
1. Burn prograde at Earth perigee to leave for the Moon (TLI ~3.12 km/s).
2. At periselene, burn retrograde to enter Moon orbit.
3. From Moon orbit, burn prograde to head back.
4. Aim for a shallow Earth reentry angle: between -4° and -12°.

### 4.4 Mission 4 — Earth to Mars

**Brief:** Mars is at opposition in 8.5 months. Leave now or wait 26 months for the next window.

**Initial conditions:**
- Heliocentric simulation (no planetary SOI active at solar system scale)
- Mars at phase angle $-44.4°$ ahead of Earth (correct Hohmann departure angle)
- Launch window slider: shows current phase angle, cycles over 779.9-day synodic period
- Delta-v budget: 8.0 km/s (optimal: ~5.6 km/s)

**Key parameters:**

| Parameter | Value |
|---|---|
| Transfer semi-major axis $a_t$ | 1.262 AU |
| First burn $\Delta v_1$ | 2.94 km/s |
| Second burn $\Delta v_2$ | 2.65 km/s |
| Transfer time | 258.9 days |
| Required Mars phase angle at departure | $-44.4°$ |

**Phase angle formula:**

$$\theta_\text{departure} = \pi - \omega_\text{Mars} \cdot T_\text{transfer}, \quad \omega_\text{Mars} = \frac{2\pi}{686.97 \times 86400}\,\text{rad/s}$$

**Success conditions:**
1. Enter Mars SOI ($r_\text{SOI,Mars} = 5.77 \times 10^8\,\text{m}$)
2. Achieve bound Mars orbit ($e_\text{Mars} < 1$, $h_\text{peri} > 0$)

**Failure conditions:**
- Miss Mars SOI by more than $2r_\text{SOI}$
- Fuel exhausted in transit
- Escape Solar System ($e_\text{helio} > 1$)

**Hints (every 60 s):**
1. Check the phase angle. Mars must be ~44° ahead of Earth.
2. Wrong window? Time-warp forward ~780 days to the next one.
3. Burn prograde at Earth until heliocentric apoapsis = Mars orbit radius.
4. At Mars, burn retrograde to slow down and enter orbit.

### 4.5 Mission 5 — Gravitational Assist (Slingshot off Jupiter)

**Brief:** You need to reach Saturn, but your fuel is insufficient for a direct transfer. Use Jupiter.

**Initial conditions:**
- Earth departure $v_\infty = 8.7\,\text{km/s}$
- Jupiter phased for flyby interception
- Delta-v budget: 3.0 km/s (far below the ~7 km/s needed for direct Saturn transfer)

**Flyby parameters:**

| Parameter | Value |
|---|---|
| Min safe flyby radius | $6.71 \times 10^7\,\text{m}$ |
| Jupiter $\mu$ | $1.267 \times 10^{17}\,\text{m}^3\text{s}^{-2}$ |
| Hyperbolic speed $u_\infty$ | $\approx 5.6\,\text{km/s}$ |
| Deflection angle $\delta$ at min radius | $\approx 94°$ |
| Expected heliocentric boost | $\approx 5.6\,\text{km/s}$ |

**Success conditions:**
1. Spacecraft reaches Saturn SOI ($r_\text{SOI,Saturn} \approx 5.48 \times 10^{10}\,\text{m}$)
2. Remaining $\Delta v > 0$

**Failure conditions:**
- Jupiter surface impact
- Post-flyby apoapsis misses Saturn orbit
- Escape Solar System on incorrect vector

**Hints (every 60 s):**
1. Toggle Reference Frame to see your path from Jupiter's perspective.
2. Fly behind Jupiter (in the direction of its orbital motion) to gain speed.
3. Adjust periapsis distance to control deflection angle.
4. Tighter flyby = more deflection = more boost — but watch out for the surface.

**Reference frame toggle (Mission 5 core pedagogy).** In Jupiter frame:
- Speed in = speed out (visually confirmed)
- Arrows show $\mathbf{V}_\text{Jupiter}$ being vectorially added to exit velocity
- Student sees that the energy boost is real in the heliocentric frame, sourced from Jupiter's orbital kinetic energy (negligibly small fraction)

### 4.6 Time Warp Implementation

**Rule:** Never increase $\Delta t$. Only increase steps per animation frame.

| Warp | Steps/frame | Sim time/frame (60 fps) |
|---|---|---|
| 1× | 1 | 10 s |
| 10× | 10 | 100 s |
| 100× | 60 | 600 s |
| 1000× | 300 | 3,000 s |

```javascript
const WARP_STEPS = { 1: 1, 10: 10, 100: 60, 1000: 300 };
const DT_BASE    = 10; // seconds — NEVER changed by warp

function animationLoop(timestamp) {
  const n = WARP_STEPS[currentWarp];
  for (let s = 0; s < n; s++) {
    state   = rk4Step(state, simTime, DT_BASE, bodies);
    simTime += DT_BASE;
    trail.push(...shipPos(state));
  }
  const { dE, dL, warn, error } = conservation.check(energy(state), angMom(state));
  if (error) { DT_current = DT_BASE / 2; } // auto-halve on severe drift
  updateHUD(state, dE, dL);
  renderer.render(scene, camera);
  TWEEN.update(timestamp);
  requestAnimationFrame(animationLoop);
}
```

**Frame-rate guard.** If frame time > 33 ms at 1000× warp, reduce to 100× and show notification.

---

## 5. UI/UX Design

### 5.1 Layout Overview

The lab uses a two-column layout inside the existing space physics lab shell:

- **Left column (70%):** Three.js WebGL canvas (full-height)
- **Right column (30%):** HUD data panel + burn controls panel
- **Bottom bar:** Collapsible mission briefing + Physics Notes drawer
- **Top bar:** Mission title + time warp controls

On screens narrower than 900 px: right column collapses below the canvas.

### 5.2 Burn Interface

**Burn direction buttons (2×2 grid):**

| Position | Label | Effect | Key |
|---|---|---|---|
| Top-left | ▲ PRO | Prograde | `W` |
| Top-right | ▼ RET | Retrograde | `S` |
| Bottom-left | ← RAD+ | Radial-out | `A` |
| Bottom-right | → RAD- | Radial-in | `D` |

Selected button glows: `box-shadow: 0 0 12px #00ff88`. 5th button (Normal, 3D only) shown in expert mode.

**Magnitude slider (logarithmic mapping):**

```javascript
// Maps slider 0..1 to burn magnitude 0.001..5.0 km/s
function sliderToBurnMag(v) {
  return Math.pow(10, Math.log10(0.001) + v * (Math.log10(5.0) - Math.log10(0.001)));
}
```

**Execute Burn button:** 0.5 s flash animation, then applies velocity change. Keyboard: `Space`.

**Hold-to-burn:** Continuous burn at 0.01 km/s per second while button held down.

**Live preview:** Burn arrow rendered on spacecraft; prediction arc rebuilt on slider move (debounced 50 ms).

### 5.3 HUD Elements

All values computed from state vector every frame:

| Element | Description | Color coding |
|---|---|---|
| Altitude | km above body surface | Green > 200 km, Yellow 80-200 km, Red < 80 km |
| Velocity | km/s | White |
| Periapsis $h_\text{peri}$ | km | Red < 100 km |
| Apoapsis $h_\text{apo}$ | km | White |
| Eccentricity $e$ | dimensionless | Green < 0.01, White otherwise |
| Orbital period $T$ | hours or minutes | White |
| Delta-v remaining | km/s + bar | Green > 50%, Yellow 20-50%, Red < 20% |
| Escape fraction | $v/v_\text{esc}$ | Animated progress bar |
| Integrator health | $\delta E$ | Green < 1e-4, Yellow < 1e-3, Red ≥ 1e-3 |

**Expert Mode additions:** $a$, $\nu$, $i$, $|\mathbf{L}|$, $\omega$, phase angle to target.

### 5.4 Phase Space Toggle

When activated, a Canvas 2D panel appears on the right showing the radial phase portrait ($r$ vs $v_r$ — radial velocity vs. radius):

- Circular orbit → closed ellipse in phase space
- Elliptical orbit → larger, more elongated ellipse
- Escape trajectory → open hyperbolic arc (exits the canvas)

The trail history of the last 1,000 state snapshots is plotted with fading alpha. Color matches the spacecraft trail color.

### 5.5 Mission Briefing Panel

Collapsible bottom panel, always visible with one line of summary:

```
[🎯 Mission 2: Hohmann Transfer]  ΔV used: 1.24 km/s | Budget: 6.0 km/s  [−]
────────────────────────────────────────────────────────────────────────────
Get to GEO (35,786 km) using exactly 2 burns. Optimal ΔV: 3.92 km/s

  [💡 Hint 1]   [💡 Hint 2 🔒]   [💡 Hint 3 🔒]
  [📐 Physics Notes]             [🔄 Reset Mission]
```

Hints unlock sequentially after 60 s / 90 s / 120 s. Physics Notes opens a side drawer with MathJax-rendered equations. Reset saves the current trail as a ghost orbit before clearing.

---

## 6. Dependencies & Technical Requirements

### 6.1 Exact CDN Links (No Build Step)

```html
<!-- Import map for Three.js ES modules -->
<script type="importmap">
{
  "imports": {
    "three":         "https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/"
  }
}
</script>

<!-- TWEEN.js for camera animation -->
<script src="https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@21.0.0/dist/tween.umd.js"></script>

<!-- MathJax for Physics Notes equations -->
<script>
  window.MathJax = {
    tex: { inlineMath: [['$','$'], ['\\(','\\)']] },
    svg: { fontCache: 'global' }
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
```

All CDN `<script>` tags must include SRI `integrity` attributes. Generate hashes at https://www.srihash.org/.

### 6.2 Library vs. Vanilla JS Decision Table

| Feature | Library | Reason |
|---|---|---|
| 3D rendering | Three.js r158 | Raw WebGL for a full scene needs ~2,000 lines of boilerplate |
| Camera controls | Three.js OrbitControls | Mouse quaternion math is non-trivial |
| Camera tweening | @tweenjs/tween.js | Easing API; alternative: manual lerp |
| LaTeX rendering | MathJax 3 | No CSS alternative for complex equations |
| RK4 integrator | **Vanilla JS** | Pure Float64Array math |
| Orbital elements | **Vanilla JS** | Pure vector math |
| Conservation monitor | **Vanilla JS** | Simple arithmetic |
| Delta-v budget | **Vanilla JS** | Accumulator |
| Trail ring buffer | **Vanilla JS** | Float32Array |
| Mission FSM | **Vanilla JS** | Class-based state machine |
| Phase-space canvas | **Vanilla JS** | Native Canvas 2D API |
| SOI handoff logic | **Vanilla JS** | Pure math |

### 6.3 Performance Targets

| Metric | Target | Strategy |
|---|---|---|
| Frame rate at 1000× warp | ≥ 60 fps | 300 steps/frame max; frame-time guard |
| Max N-body bodies | 8 | Switch to patched conics above 8 |
| Trail buffer size | 4,096 points | Ring buffer — zero allocation after init |
| Prediction arc | 512 samples | Pre-allocated Float32Array; rebuilt only on burns |
| JS heap | < 150 MB | Reuse Three.js BufferGeometry; no per-frame allocation |
| First meaningful paint | < 2 s | Lazy-load Three.js; show 2D canvas first |
| rk4Step batch (1000×) | ≤ 2 ms | Profile in Chrome DevTools |
| Three.js render call | ≤ 8 ms | Limit draw calls; merge static geometry |

### 6.4 Browser Compatibility

| Browser | Min version | Notes |
|---|---|---|
| Chrome | 90+ | Primary target |
| Firefox | 89+ | Full support |
| Safari | 15+ | WebGL 1 only; Three.js handles automatically |
| Edge | 90+ | Chromium-based, full support |
| Mobile Chrome | 90+ | Limit max warp to 100× |
| Mobile Safari | 15.4+ | Hide phase-space panel on < 768 px |

**WebGL detection:**

```javascript
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch { return false; }
}
if (!hasWebGL()) initCanvas2DFallback();
else            initThreeJsScene();
```

---

## 7. Integration with Existing Flask/Jinja2 Site Structure

### 7.1 Route Registration

No changes required to `portfolio/routes/space_physics.py`. The existing `render_page()` function (line 72) dynamically resolves any slug under `/space-physics/` to a matching template:

```
GET /space-physics/orbital-mechanics
  URL slug:      orbital-mechanics
  Template path: space_physics/pages/orbital_mechanics.html  (dashes → underscores)
```

The existing dash-to-underscore conversion on line 87 handles this automatically.

### 7.2 Metadata Entry

Add to `PHYSICS_METADATA` dict in `portfolio/routes/space_physics.py`:

```python
"orbital-mechanics": {
    "title": "Orbital Mechanics Sandbox",
    "category": "Classical Mechanics",
    "description": (
        "Pilot a spacecraft through five missions — from achieving a stable orbit "
        "to slingshotting off Jupiter. Real physics, real delta-v budgets."
    ),
    "icon": "🛸",
    "status": "active",
},
```

### 7.3 Template Structure

Create `portfolio/templates/space_physics/pages/orbital_mechanics.html`:

```html
{% extends "space_physics/lab_base.html" %}

{% block title %}Orbital Mechanics Sandbox — Space & Physics{% endblock %}

{% block meta_description %}
Pilot a spacecraft through five orbital mechanics missions.
Learn Hohmann transfers, gravity assists, and interplanetary navigation
using a real-physics WebGL sandbox.
{% endblock %}

{% block lab_content %}
<div id="lab-root" class="orbital-lab-root">

  <!-- Time warp toolbar -->
  <div id="warp-controls" role="toolbar" aria-label="Time warp controls">
    <button id="warpPause"  aria-label="Pause">⏸</button>
    <button id="warp1x"    class="warp-btn active" aria-label="1x speed">1×</button>
    <button id="warp10x"   class="warp-btn"        aria-label="10x speed">10×</button>
    <button id="warp100x"  class="warp-btn"        aria-label="100x speed">100×</button>
    <button id="warp1000x" class="warp-btn"        aria-label="1000x speed">1000×</button>
  </div>

  <!-- Render targets -->
  <canvas id="two-d-fallback" role="img" aria-label="2D simulation fallback"
          style="display:none"></canvas>
  <div    id="three-d-scene"  role="img" aria-label="3D orbital simulation"></div>

  <!-- Overlay panels (populated by JS modules) -->
  <div id="hud-panel"      aria-live="polite"></div>
  <div id="burn-panel"></div>
  <div id="briefing-panel"></div>

  <!-- Phase space (shown only when toggle active) -->
  <canvas id="phase-space-canvas" role="img" aria-label="Phase space diagram"
          style="display:none"></canvas>

</div>
{% endblock %}

{% block lab_scripts %}
<script type="importmap">
{
  "imports": {
    "three":         "https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/"
  }
}
</script>
<script src="https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@21.0.0/dist/tween.umd.js"></script>
<script type="module"
  src="{{ url_for('static', filename='js/space_physics/orbital_mechanics/main.js') }}">
</script>
{% endblock %}
```

If `lab_base.html` does not yet exist, create it extending `space_physics/base.html` with blocks: `lab_content`, `lab_scripts`, `title`, `meta_description`.

### 7.4 Static Asset Layout

```
portfolio/static/js/space_physics/orbital_mechanics/
├── main.js                   Entry point: WebGL detection, scene init, animation loop
├── constants.js              G, AU, EPS, DT_BASE, BODIES table, WARP_STEPS, MISSION_BUDGETS
├── physics/
│   ├── integrator.js         rk4Step(), computeDerivatives(), addScaled()
│   ├── orbital.js            orbitalElements(), visViva(), escapeVel(), predictArc()
│   ├── patched.js            computeSOI(), soiHandoff(), currentParent()
│   └── conservation.js       ConservationMonitor class
├── render/
│   ├── scene.js              THREE.Scene, PerspectiveCamera, WebGLRenderer, lighting
│   ├── trail.js              TrailBuffer, ShaderMaterial fading trail
│   ├── prediction.js         Keplerian arc mesh (rebuilt on burns)
│   └── soi.js                SOI sphere + ring + label sprite
├── missions/
│   ├── MissionBase.js        Abstract: reset(), successCheck(), failureCheck(), hints[]
│   ├── mission1.js           Initial state, circular orbit success logic
│   ├── mission2.js           Hohmann target ring, efficiency score
│   ├── mission3.js           Moon SOI, free-return, reentry corridor
│   ├── mission4.js           Phase angle calculator, launch window slider
│   └── mission5.js           Jupiter flyby, reference frame toggle
└── ui/
    ├── hud.js                DOM refs, updateHUD(state)
    ├── burn.js               Button events, applyBurn(), preview arrow
    ├── briefing.js           Collapsible panel, hint timer, efficiency display
    └── phasespace.js         Canvas 2D r vs v_r phase portrait
```

### 7.5 Constants Module

```javascript
// constants.js
export const G        = 6.674e-11;   // N m^2 kg^-2
export const AU       = 1.496e11;    // m
export const EPS      = 1e4;         // m (softening)
export const DT_BASE  = 10;          // s (RK4 base step — never changes)

export const BODIES = {
  sun:     { mass: 1.989e30, radius: 6.957e8,  mu: 1.327e20,  color: 0xffdd44, soi: Infinity },
  earth:   { mass: 5.972e24, radius: 6.371e6,  mu: 3.986e14,  color: 0x2266ff, soi: 9.25e8  },
  moon:    { mass: 7.342e22, radius: 1.737e6,  mu: 4.905e12,  color: 0xaaaaaa, soi: 6.62e7  },
  mars:    { mass: 6.417e23, radius: 3.390e6,  mu: 4.283e13,  color: 0xff4422, soi: 5.77e8,  sma: 1.524 * 1.496e11 },
  jupiter: { mass: 1.898e27, radius: 6.991e7,  mu: 1.267e17,  color: 0xddaa77, soi: 4.82e10, sma: 5.203 * 1.496e11 },
  saturn:  { mass: 5.683e26, radius: 5.823e7,  mu: 3.793e16,  color: 0xeecc88, soi: 5.48e10, sma: 9.537 * 1.496e11 },
};

export const WARP_STEPS = { 1: 1, 10: 10, 100: 60, 1000: 300 };

export const MISSION_BUDGETS = {
  1: 0.5e3,   // m/s
  2: 6.0e3,
  3: 4.0e3,
  4: 8.0e3,
  5: 3.0e3,
};
```

### 7.6 Flask Static File Versioning

```python
# In app.py or a context processor:
import time

@app.context_processor
def inject_asset_version():
    version = str(int(time.time())) if app.debug else '1.0.0'
    return {'asset_version': version}
```

```html
<script type="module"
  src="{{ url_for('static', filename='js/space_physics/orbital_mechanics/main.js') }}?v={{ asset_version }}">
</script>
```

### 7.7 Security Considerations

- All CDN scripts must include SRI `integrity` hashes (generate at srihash.org).
- No user data is sent to the server. Simulation is entirely client-side.
- No `eval()` or dynamic code execution in any module.
- Existing `_SLUG_RE` allowlist in `space_physics.py` line 63 prevents path traversal. No changes needed.
- Canvas screenshot export (if added) uses `canvas.toBlob()` — safe.

### 7.8 Accessibility

- All `<button>` elements have `aria-label` attributes.
- Canvas elements have `role="img"` and descriptive `aria-label`.
- Keyboard shortcuts (`W`/`S`/`A`/`D`/`Space`) listed in `<details>` inside the briefing panel.
- Color-blind mode toggle: replaces red/green with orange/blue. Preference stored in `localStorage`.
- Minimum 4.5:1 contrast ratio for all HUD text.
- Focus-visible outlines on all interactive elements (CSS `:focus-visible`).

---

## Appendix A: Physical Constants Quick Reference

| Constant | Value | Units |
|---|---|---|
| Gravitational constant G | 6.674e-11 | N m^2 kg^-2 |
| Earth mass | 5.972e24 | kg |
| Earth radius | 6.371e6 | m |
| Earth mu | 3.986e14 | m^3 s^-2 |
| Moon mass | 7.342e22 | kg |
| Moon radius | 1.737e6 | m |
| Moon semi-major axis | 3.844e8 | m |
| Moon mu | 4.905e12 | m^3 s^-2 |
| Moon SOI radius | 6.62e7 | m |
| Mars mu | 4.283e13 | m^3 s^-2 |
| Mars semi-major axis | 1.524 AU | — |
| Mars orbital period | 686.97 days | — |
| Mars SOI radius | 5.77e8 | m |
| Jupiter mu | 1.267e17 | m^3 s^-2 |
| Jupiter SOI radius | 4.82e10 | m |
| Saturn SOI radius | 5.48e10 | m |
| AU | 1.496e11 | m |
| GEO radius | 4.216e7 | m |
| GEO altitude | 35,786 | km |
| LEO circular velocity (400 km alt) | 7.669 | km/s |
| Earth escape velocity (surface) | 11.186 | km/s |
| Earth-Mars synodic period | 779.9 | days |

---

## Appendix B: Mission Delta-V Budget Summary

| Mission | Budget | Optimal dv | Margin | Burns |
|---|---|---|---|---|
| 1 — Circular Orbit | 0.5 km/s | ~0.15 km/s | 233% | 1 |
| 2 — LEO to GEO | 6.0 km/s | 3.92 km/s | 53% | 2 |
| 3 — Moon Flyby | 4.0 km/s | ~3.93 km/s | 2% | 3 |
| 4 — Earth to Mars | 8.0 km/s | 5.59 km/s | 43% | 2 |
| 5 — Jupiter Assist | 3.0 km/s | ~1.5 km/s | 100% | 2-4 |

---

## Appendix C: Simulation Simplifications vs. Reality

| Simplification | Reality | Effect on sim accuracy |
|---|---|---|
| Impulsive burns (instantaneous) | Finite burn duration (minutes) | Delta-v slightly overestimated |
| 2D coplanar orbits (Missions 1-4) | Planes tilted by inclination | Inclination-change burns not required |
| Patched conics (not full N-body) | All bodies attract simultaneously | Small error near SOI boundaries |
| No atmospheric drag | Atmosphere to ~500 km | Orbits below 200 km decay faster in reality |
| No J2 oblateness | Earth is oblate; RAAN precesses | RAAN drift omitted |
| No solar radiation pressure | Photons push spacecraft | Negligible for educational timescales |
| Massless spacecraft | Ship perturbs planet orbits | Negligible — mass ratio < 1e-20 |
| Circular planet orbits (Missions 1-3) | Slightly elliptical | Error < 2% |
