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
