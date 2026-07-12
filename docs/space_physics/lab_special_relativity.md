# Special Relativity: Interactive Lab — Technical Specification

**Module:** Space & Physics → Special Relativity
**File:** `lab_special_relativity.js` (canvas engine) + Jinja2 template
**Spec Version:** 1.0
**Date:** 2026-07-12
**Status:** Pre-implementation reference

---

## Table of Contents

1. [Overview & Pedagogical Goals](#1-overview--pedagogical-goals)
2. [Physics Engine — Full Mathematical Specification](#2-physics-engine--full-mathematical-specification)
   - 2.1 Lorentz Transformations
   - 2.2 Relativistic Velocity Addition
   - 2.3 Length Contraction
   - 2.4 Time Dilation
   - 2.5 Relativistic Doppler Effect
   - 2.6 Relativistic Momentum and Kinetic Energy
   - 2.7 Four-Velocity and Spacetime Interval Invariance
   - 2.8 Light Cone Geometry
   - 2.9 Relativity of Simultaneity
   - 2.10 Twin Paradox: Proper Time Integral
3. [Interactive Experiments — Chapter-by-Chapter Breakdown](#3-interactive-experiments--chapter-by-chapter-breakdown)
4. [Rendering Design](#4-rendering-design)
5. [UI/UX Design](#5-uiux-design)
6. [Dependencies & Technical Requirements](#6-dependencies--technical-requirements)
7. [Integration with Flask/Jinja2 Site Structure](#7-integration-with-flaskjinja2-site-structure)

---

## 1. Overview & Pedagogical Goals

### 1.1 What the User Learns

By working through this lab the user will:

- **Understand that the speed of light is the same for all inertial observers**, regardless of their relative motion — this is the postulate that breaks Galilean mechanics.
- **Feel** (via direct manipulation) that simultaneity is **not absolute** — two events that happen at the same time in one frame can happen at different times in another, with the time gap growing predictably with relative speed.
- **Measure** length contraction with a pixel ruler tool so the effect is tangible, not just an equation on a page.
- **Watch clocks diverge** in real time rather than being told they diverge.
- **See** the relativistic Doppler effect shift starlight colour across the visible spectrum.
- **Calculate** a twin-paradox proper-time discrepancy by flying a spaceship at user-chosen speeds.
- **Build intuition** for Minkowski spacetime diagrams: what a worldline, a light cone, and a simultaneity line actually mean geometrically.
- **Confront** why the speed of light is a hard limit — not because something blocks you, but because the energy cost of acceleration diverges as $v \to c$.

### 1.2 Discovery-First Design

The lab is structured as a sequence of **manipulable surprises**. Each chapter presents the user with a *direct* interactive control (a speed slider, a force button, a frame toggle) and asks them to predict what they'll see before revealing the result. Key principles:

1. **No equations first.** Each chapter opens with a simulation the user can poke. The equation panel starts hidden behind a "Show the math" disclosure.
2. **Make the effect exaggerated.** At $\beta = 0.1$ you can barely see length contraction. The slider runs to $\beta = 0.9999$ and the chapter default is chosen so the effect is vivid.
3. **Dual-frame rendering** is always one click away. The "Their Frame / Your Frame" toggle performs a full Lorentz boost of every rendered object, so the user can compare the same scene from two vantage points without any abstraction.
4. **Numerical verification.** Every quantity shown has a numerical readout (`β`, `γ`, `Δt`, `L`, `λ`, etc.) that the user can match against the formula if they choose.

### 1.3 Why Simultaneity and Length Contraction Are the Hardest Concepts

**Simultaneity** fails because everyday intuition says time is universal — a single, global "now." Textbooks explain this with words and Minkowski diagrams, but the diagram itself is abstract. This lab attacks it differently: the user sees two **explosions** at different positions go off at the same time in the rest frame (the explosions light up simultaneously on screen), then *drags* a speed slider and watches the time gap between them **open continuously** as the frame moves. The causal chain is: I moved the slider → the gap appeared → therefore speed creates temporal displacement. That embodied causality is more memorable than any derivation.

**Length contraction** is hard because there is no everyday object that contracts as it moves. The hidden subtlety is the **simultaneity of the measurement endpoints** — you must read both ends of the ruler *at the same time* in your frame. This lab shows both endpoints being measured at simultaneous coordinate times in the moving frame (a blue flash marks both ends at the same moment), and the user can verify with the pixel ruler that the flashed distance is shorter than the object's rest length. The spec includes a dedicated "measurement protocol" visualisation to make the simultaneous-endpoint procedure explicit.

---

## 2. Physics Engine — Full Mathematical Specification

Throughout this section the **rest frame** is called $S$, the **moving frame** (moving at velocity $v$ in the $+x$ direction relative to $S$) is called $S'$. The Lorentz factor is:

$$\boxed{\gamma = \frac{1}{\sqrt{1 - \beta^2}}, \quad \beta = \frac{v}{c}}$$

All internal calculations use **natural units** where $c = 1$ (i.e., velocity is stored as $\beta$, a dimensionless fraction of $c$). Canvas pixel lengths are mapped from these units by a configurable scale constant $\mathcal{S}$ (pixels per light-second, set per chapter).

---

### 2.1 Lorentz Transformations

#### 2.1.1 Forward Transform: $S \to S'$

Given an event $(x, t)$ in $S$, its coordinates in $S'$ are:

$$\boxed{x' = \gamma\,(x - vt)}$$
$$\boxed{t' = \gamma\!\left(t - \frac{v x}{c^2}\right)}$$

In natural units ($c = 1$):

$$x' = \gamma\,(x - \beta t)$$
$$t' = \gamma\,(t - \beta x)$$

#### 2.1.2 Inverse Transform: $S' \to S$

$$\boxed{x = \gamma\,(x' + vt')}$$
$$\boxed{t = \gamma\!\left(t' + \frac{v x'}{c^2}\right)}$$

In natural units:

$$x = \gamma\,(x' + \beta t')$$
$$t = \gamma\,(t' + \beta x')$$

#### 2.1.3 Transverse Coordinates

The transverse coordinates are **not** affected by the boost (boost is along $x$):

$$y' = y, \quad z' = z$$

This is why a circular object moving along $x$ contracts only in the direction of motion, producing a flattened ellipse on screen.

#### 2.1.4 JavaScript Implementation

```js
// engine/lorentz.js
function lorentzForward(x, t, beta) {
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  return {
    xPrime: gamma * (x - beta * t),
    tPrime: gamma * (t - beta * x),
    gamma
  };
}

function lorentzInverse(xp, tp, beta) {
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  return {
    x: gamma * (xp + beta * tp),
    t: gamma * (tp + beta * xp),
    gamma
  };
}
```

**Numerical safety:** When $\beta \ge 0.9999999$, clamp to $\beta_{\max} = 0.9999999$ to avoid division by zero or NaN from floating-point underflow in $\sqrt{1-\beta^2}$.

---

### 2.2 Relativistic Velocity Addition

> ⚠️ **Counterintuitive.** This is the formula that replaces simple vector addition. It ensures that no composition of sub-luminal velocities produces a super-luminal result.

If an object moves at velocity $u'$ in frame $S'$, and $S'$ moves at velocity $v$ relative to $S$, then the object's velocity in $S$ is:

$$\boxed{u = \frac{u' + v}{1 + \dfrac{u' v}{c^2}}}$$

In natural units ($c = 1$):

$$u = \frac{u' + \beta}{1 + u'\,\beta}$$

**Proof of the speed-of-light limit:** If $u' = c$ (i.e., $u' = 1$ in natural units), then:

$$u = \frac{1 + \beta}{1 + \beta} = 1 = c$$

A light pulse is measured at $c$ in **all** frames.

**Chapter 1 usage:** Both observers send a light pulse ($u' = 1$) while moving at $\beta$ relative to each other. The formula is evaluated live and both measured speeds are displayed as $c$.

**Chapter 8 (speed limit) usage:** User applies a constant proper acceleration $\alpha$. The coordinate velocity in the lab frame as a function of coordinate time $t$ is:

$$v(t) = \frac{\alpha t}{\sqrt{1 + \left(\dfrac{\alpha t}{c}\right)^2}}$$

This asymptotes to $c$ but never reaches it.

---

### 2.3 Length Contraction

#### 2.3.1 Derivation

Consider a ruler of rest length $L_0$ at rest in frame $S'$. Its left end is at $x'_L = 0$ and its right end is at $x'_R = L_0$, for all $t'$.

In frame $S$, a simultaneous measurement ($t = t_0$, i.e., $\Delta t = 0$) of both ends requires applying the inverse Lorentz transform to events $(x'_L, t'_L)$ and $(x'_R, t'_R)$ chosen such that both map to the **same** $t$ in $S$.

Using $x = \gamma(x' + \beta t')$, and setting $t'_L, t'_R$ to achieve $\Delta t = 0$:

After algebra (see Taylor & Wheeler §3.4), the measured length in $S$ is:

$$\boxed{L = \frac{L_0}{\gamma} = L_0 \sqrt{1 - \beta^2}}$$

The ruler is **shorter** in the frame in which it is moving.

#### 2.3.2 Canvas Implementation

Every object rendered in the scene has a rest-frame bounding box width $W_0$ (in natural units). When the user moves the frame at $\beta$:

```js
function contractedWidth(W0, beta) {
  return W0 * Math.sqrt(1 - beta * beta);
}
```

Only the **x-dimension** (direction of motion) is contracted. The $y$-dimension (height) is unchanged.

#### 2.3.3 Measurement Protocol Visualisation (Chapter 3)

To make the simultaneous-endpoint measurement explicit, the renderer:

1. Draws the moving ruler as a contracted rectangle of width $W_0/\gamma$ pixels.
2. At $t = t_{\text{meas}}$, fires a blue flash at both endpoints *simultaneously* in the observing frame.
3. Renders a dashed line between the two flashes with a numerical pixel readout.
4. Shows the rest-length $W_0$ as a ghost rectangle for comparison.

---

### 2.4 Time Dilation

#### 2.4.1 Derivation

Consider a clock at rest in $S'$, located at $x' = 0$. Two ticks occur at events:

$$A = (x'=0,\; t'=0) \quad \text{and} \quad B = (x'=0,\; t'=\Delta\tau)$$

where $\Delta\tau$ is the **proper time** between ticks (the rest-frame interval).

Applying the inverse Lorentz transform to both events gives their times in $S$:

$$t_A = \gamma\,(0 + \beta \cdot 0) = 0$$
$$t_B = \gamma\,(\Delta\tau + \beta \cdot 0) = \gamma\,\Delta\tau$$

Therefore, the coordinate time elapsed in $S$ is:

$$\boxed{\Delta t = \gamma\,\Delta\tau}$$

The moving clock ticks **slower** as seen from $S$. Since $\gamma \ge 1$, coordinate time is always $\ge$ proper time.

#### 2.4.2 Clock Implementation

Each on-screen clock has an internal proper-time accumulator `tau`. On each animation frame of wall-clock duration `dtWall` (seconds), the proper time advances by:

```js
// dt_wall is real animation frame delta in seconds (renormalised to sim units)
clock.tau += dtWall / clock.gamma;    // moving clock's proper time
refClock.tau += dtWall;               // rest clock advances at full rate
```

The clock face is drawn with hands at angle $\theta = 2\pi \cdot (\tau \mod T) / T$ where $T$ is the clock period. Both clock faces are rendered side by side. The user can see `tau_moving` falling behind `tau_rest` in real time.

> ⚠️ **Counterintuitive.** The user's first instinct is that the "slower" clock is somehow broken or cheating. The UI must reinforce: *"Nothing is wrong with the moving clock. It is correctly measuring the passage of time along its own worldline, which is geometrically shorter through spacetime."*

---

### 2.5 Relativistic Doppler Effect

#### 2.5.1 Derivation

The relativistic Doppler formula for a source moving **toward** the observer (approaching) gives a received frequency $f_{\text{obs}}$ from emitted frequency $f_0$:

$$\boxed{f_{\text{obs}} = f_0 \sqrt{\frac{1 + \beta}{1 - \beta}}}$$

For a source **receding**:

$$\boxed{f_{\text{obs}} = f_0 \sqrt{\frac{1 - \beta}{1 + \beta}}}$$

These can be unified: let $\beta > 0$ for approach, $\beta < 0$ for recession:

$$f_{\text{obs}} = f_0 \sqrt{\frac{1 + \beta}{1 - \beta}}$$

**Derivation sketch:** The period between successive wavefronts emitted at source velocity $v$ is stretched (receding) or compressed (approaching) both by the classical Doppler factor $(1 \pm \beta)$ **and** by time dilation of the source clock. The combined effect gives the relativistic formula above. Unlike the classical Doppler formula, this is fully symmetric: the same formula applies whether the source or the observer is moving, consistent with the principle of relativity.

#### 2.5.2 Wavelength Form

Since $f = c/\lambda$:

$$\lambda_{\text{obs}} = \lambda_0 \sqrt{\frac{1 - \beta}{1 + \beta}} \quad \text{(approaching, blueshift)}$$
$$\lambda_{\text{obs}} = \lambda_0 \sqrt{\frac{1 + \beta}{1 - \beta}} \quad \text{(receding, redshift)}$$

#### 2.5.3 Mapping Wavelength to RGB (Visible Spectrum)

The visible spectrum spans approximately $380\,\text{nm}$ (violet) to $700\,\text{nm}$ (red). The chapter uses a reference star with emitted wavelength $\lambda_0 = 550\,\text{nm}$ (green-yellow, solar peak).

The following piecewise linear function maps a wavelength $\lambda$ (in nm) to linear RGB values in $[0, 1]$:

```
lambda < 380:   R=0.60, G=0.00, B=0.50  (near-UV glow)
380 to 440:     R=(440-lambda)/60,  G=0.00,           B=1.00
440 to 490:     R=0.00,             G=(lambda-440)/50, B=1.00
490 to 510:     R=0.00,             G=1.00,            B=(510-lambda)/20
510 to 580:     R=(lambda-510)/70,  G=1.00,            B=0.00
580 to 645:     R=1.00,             G=(645-lambda)/65, B=0.00
645 to 700:     R=1.00,             G=0.00,            B=0.00
lambda > 700:   R=0.50, G=0.00, B=0.00  (infrared glow)
```

Apply an intensity rolloff at spectrum edges to simulate human eye sensitivity:

```js
let factor;
if (lambda >= 380 && lambda < 420) factor = 0.3 + 0.7 * (lambda - 380) / 40;
else if (lambda >= 420 && lambda <= 680) factor = 1.0;
else if (lambda > 680 && lambda <= 700) factor = 0.3 + 0.7 * (700 - lambda) / 20;
else factor = 0.1;

r = Math.round(255 * Math.pow(r * factor, 0.8));
g = Math.round(255 * Math.pow(g * factor, 0.8));
b = Math.round(255 * Math.pow(b * factor, 0.8));
```

The `0.8` exponent corrects for monitor gamma (a partial sRGB linearisation adequate for visual purposes without a full ICC pipeline).

**JavaScript function:**

```js
function wavelengthToRGB(lambda_nm) {
  let r, g, b;
  if      (lambda_nm < 380)             { r=0.6; g=0.0; b=0.5; }
  else if (lambda_nm < 440)             { r=(440-lambda_nm)/60; g=0; b=1; }
  else if (lambda_nm < 490)             { r=0; g=(lambda_nm-440)/50; b=1; }
  else if (lambda_nm < 510)             { r=0; g=1; b=(510-lambda_nm)/20; }
  else if (lambda_nm < 580)             { r=(lambda_nm-510)/70; g=1; b=0; }
  else if (lambda_nm < 645)             { r=1; g=(645-lambda_nm)/65; b=0; }
  else if (lambda_nm <= 700)            { r=1; g=0; b=0; }
  else                                  { r=0.5; g=0; b=0; }

  let factor = (lambda_nm<380||lambda_nm>700) ? 0.1
             : (lambda_nm<420) ? 0.3+0.7*(lambda_nm-380)/40
             : (lambda_nm>680) ? 0.3+0.7*(700-lambda_nm)/20
             : 1.0;

  return {
    r: Math.round(255 * Math.pow(r * factor, 0.8)),
    g: Math.round(255 * Math.pow(g * factor, 0.8)),
    b: Math.round(255 * Math.pow(b * factor, 0.8))
  };
}
```

#### 2.5.4 The Transverse Doppler Effect (Bonus)

At $90°$ to the direction of motion, classical Doppler predicts zero shift. Relativistically:

$$f_{\text{transverse}} = \frac{f_0}{\gamma}$$

This is pure time-dilation Doppler with no classical analogue. Flagged in the UI with a special annotation.

---

### 2.6 Relativistic Momentum and Kinetic Energy

#### 2.6.1 Relativistic Momentum

$$\boxed{\mathbf{p} = \gamma m \mathbf{v} = \frac{m\mathbf{v}}{\sqrt{1-\beta^2}}}$$

As $v \to c$, $\gamma \to \infty$ and $p \to \infty$. An infinite impulse would be required to reach $c$.

#### 2.6.2 Total Energy

$$\boxed{E = \gamma m c^2}$$

At rest ($v = 0$, $\gamma = 1$): $E_0 = mc^2$ — the famous rest energy.

#### 2.6.3 Relativistic Kinetic Energy

$$\boxed{K = (\gamma - 1) m c^2}$$

For small $\beta$: Taylor-expand $\gamma \approx 1 + \tfrac{1}{2}\beta^2 + \tfrac{3}{8}\beta^4 + \cdots$, so $K \approx \tfrac{1}{2}mv^2$ — the Newtonian limit is recovered.

As $\beta \to 1$:
$$K \sim \frac{mc^2}{\sqrt{1-\beta^2}} \to \infty$$

**Chapter 8 energy readout** displays this live. With $m = 1\,\text{kg}$, $c = 1$ (natural units):

```js
function kineticEnergy(beta) {
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  return (gamma - 1); // in units of mc^2
}
```

**Energy-momentum invariant:**

$$\boxed{E^2 - (pc)^2 = (mc^2)^2}$$

This is a Lorentz scalar — the same in every inertial frame. Displayed as a running numerical check in Chapter 8.

> ⚠️ **Counterintuitive.** Students often think "just push harder." The UI must show that the acceleration produced per unit of applied force keeps getting **smaller** as speed increases. A secondary graph plots $a_{\text{coord}}$ vs $\beta$, showing it plummets toward zero.

---

### 2.7 Four-Velocity and Spacetime Interval Invariance

#### 2.7.1 Spacetime Interval

Given two events $A$ and $B$ with coordinate separations $(\Delta x, \Delta t)$ in frame $S$:

$$\boxed{s^2 = c^2 \Delta t^2 - \Delta x^2}$$

(Using the $+{-}{-}{-}$ metric signature.) This quantity is **invariant** under Lorentz transformations:

$$s^2 = c^2 {\Delta t}^2 - \Delta x^2 = c^2 {\Delta t'}^2 - \Delta x'^2$$

Three cases:

| $s^2$ | Name | Physical Meaning |
|--------|------|-----------------|
| $s^2 > 0$ | **Timelike** | A massive particle can travel between $A$ and $B$; some frame exists where they occur at the same place |
| $s^2 = 0$ | **Lightlike (null)** | Only light can connect $A$ and $B$ |
| $s^2 < 0$ | **Spacelike** | No causal connection possible; some frame exists where $A$ and $B$ are simultaneous |

**Implementation:** Chapter 7 computes and displays $s^2$ live for any two user-placed events on the Minkowski diagram, with colour coding (emerald green = timelike, amber = null/lightlike, magenta = spacelike).

#### 2.7.2 Proper Time from Spacetime Interval

For timelike separations, $s = c\,\Delta\tau$ where $\Delta\tau$ is the **proper time** measured by a clock travelling between the events:

$$\Delta\tau = \frac{1}{c}\sqrt{c^2 \Delta t^2 - \Delta x^2} = \Delta t \sqrt{1 - \beta^2} = \frac{\Delta t}{\gamma}$$

#### 2.7.3 Four-Velocity

The four-velocity $U^\mu$ of a particle with worldline $x^\mu(\tau)$:

$$U^\mu = \frac{dx^\mu}{d\tau} = \left(\gamma c,\; \gamma v_x,\; \gamma v_y,\; \gamma v_z\right)$$

Its Minkowski norm is invariant:

$$U^\mu U_\mu = \gamma^2 c^2 - \gamma^2 v^2 = \gamma^2 c^2(1 - \beta^2) = c^2$$

The four-velocity always has magnitude $c$. Every particle "moves through spacetime" at $c$; the split between spatial motion and temporal motion depends on the frame.

> ⚠️ **Advanced section flag.** Sections 2.7 onwards are labelled "Advanced" in the UI. Users who have not unlocked Chapter 7 will see these equations greyed out. Unlocking happens automatically after completing Chapter 4.

---

### 2.8 Light Cone Geometry

#### 2.8.1 Definition

The light cone of an event $O$ at origin $(0, 0)$ in a 1+1 Minkowski diagram is the set of events reachable by a light signal sent from or to $O$:

$$ct = \pm x \implies x = \pm ct$$

In the diagram's $x$-$ct$ coordinate system (vertical axis $ct$, horizontal axis $x$), the light cone is two diagonal lines at $45°$.

#### 2.8.2 Regions

| Region | Condition | Label |
|--------|-----------|-------|
| Future light cone | $ct > 0$ and $c^2t^2 > x^2$ | "Future" — events $O$ can causally influence |
| Past light cone | $ct < 0$ and $c^2t^2 > x^2$ | "Past" — events that can causally influence $O$ |
| Elsewhere (spacelike) | $c^2t^2 < x^2$ | Cannot communicate with $O$; no invariant ordering |

#### 2.8.3 Rendering

```js
function drawLightCone(ctx, originPx, originPy, scale, canvasH) {
  // scale: pixels per light-second (= pixels per ct unit)
  ctx.strokeStyle = '#FFD700'; // gold
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);

  // Future cone — two lines going up-left and up-right
  ctx.beginPath();
  ctx.moveTo(originPx, originPy);
  ctx.lineTo(originPx - canvasH, originPy - canvasH); // 45 deg upper-left
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(originPx, originPy);
  ctx.lineTo(originPx + canvasH, originPy - canvasH); // 45 deg upper-right
  ctx.stroke();

  // Past cone — mirrored downward
  ctx.strokeStyle = '#B8860B'; // dark gold
  ctx.beginPath();
  ctx.moveTo(originPx, originPy);
  ctx.lineTo(originPx - canvasH, originPy + canvasH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(originPx, originPy);
  ctx.lineTo(originPx + canvasH, originPy + canvasH);
  ctx.stroke();
  ctx.setLineDash([]);
}
```

Fill the three regions with semi-transparent colours:
- Future: `rgba(0, 200, 100, 0.06)`
- Past: `rgba(200, 100, 0, 0.06)`
- Elsewhere: `rgba(200, 50, 50, 0.04)`

---

### 2.9 Relativity of Simultaneity

#### 2.9.1 Mathematical Statement

> ⚠️ **Most counterintuitive result.** Flagged prominently in the UI with a warning banner: *"What is about to happen will break your intuition. That's the point."*

Two events $A = (x_A, t_A)$ and $B = (x_B, t_B)$ are simultaneous in $S$ if $t_A = t_B$.

Their times in $S'$ (moving at $\beta$) are:

$$t'_A = \gamma\!\left(t_A - \frac{\beta x_A}{c}\right), \quad t'_B = \gamma\!\left(t_B - \frac{\beta x_B}{c}\right)$$

The time gap in $S'$:

$$\Delta t' = t'_B - t'_A = \gamma\!\left((t_B - t_A) - \frac{\beta(x_B - x_A)}{c}\right)$$

If $t_A = t_B$ (simultaneous in $S$):

$$\boxed{\Delta t' = -\frac{\gamma\,\beta\,\Delta x}{c}}$$

where $\Delta x = x_B - x_A$ is the spatial separation.

**Key insight:** Events that are spatially separated ($\Delta x \ne 0$) **cannot** be simultaneously simultaneous in all frames. The time gap grows linearly with $\beta$ and linearly with $\Delta x$.

#### 2.9.2 Worked Numerical Example (Chapter 2 defaults)

Default configuration:
- Event $A$: explosion at $x_A = -5\,\text{ls}$, $t_A = 0$
- Event $B$: explosion at $x_B = +5\,\text{ls}$, $t_B = 0$
- $\Delta x = 10\,\text{ls}$, simultaneous in $S$

At $\beta = 0.6$, $\gamma = 1/\sqrt{1-0.36} = 1/\sqrt{0.64} = 1.25$:

$$\Delta t' = -\frac{1.25 \times 0.6 \times 10}{1} = -7.5\,\text{s}$$

So in $S'$, event $B$ occurs $7.5\,\text{s}$ **before** event $A$. Both explosions happen; only their temporal ordering is frame-dependent.

> ⚠️ **Pedagogical flag:** The ordering of spacelike events is not only non-absolute but **reversible** — in a frame moving in the opposite direction, event $A$ happens before $B$. This is safe because spacelike events cannot be causally connected, so no paradox arises.

---

### 2.10 Twin Paradox: Proper Time Integral

#### 2.10.1 Why There Is No Real Paradox

The apparent paradox: Alice stays on Earth; Bob flies away at $\beta_1$ then returns at $\beta_2$. Isn't the situation symmetric? **No**, because Bob undergoes acceleration at the turnaround point. Acceleration breaks the symmetry: only Bob's worldline is non-geodesic.

The proper time along a worldline is:

$$\boxed{\tau = \int_0^T \frac{dt}{\gamma(t)} = \int_0^T \sqrt{1 - \beta(t)^2}\, dt}$$

For the symmetric case ($\beta_1 = \beta_2 = \beta$, outbound leg duration $T/2$, return leg duration $T/2$):

$$\tau_{\text{Bob}} = T\sqrt{1-\beta^2} = \frac{T}{\gamma}$$
$$\tau_{\text{Alice}} = T$$

Bob is younger by $\Delta\tau = T\!\left(1 - \dfrac{1}{\gamma}\right)$.

#### 2.10.2 Numerical Integration for Chapter 6

Bob's velocity profile $\beta(t)$ is piecewise: outbound at $\beta_1$, turnaround (instantaneous), return at $\beta_2$. Proper time is accumulated numerically each simulation step:

```js
// Called each animation frame
function updateProperTime(state, dtCoord) {
  // dtCoord: coordinate time elapsed this frame (simulation units)
  const dTau = dtCoord * Math.sqrt(1 - state.beta * state.beta);
  state.tau += dTau;
}
```

For the advanced version (smooth turnaround with finite acceleration $\alpha$), the velocity profile during the turnaround phase is:

$$\beta(t) = \tanh\!\left(\frac{\alpha\,t}{c}\right)$$

and the proper time integral during that phase is computed analytically:

$$\tau_{\text{turn}} = \frac{c}{\alpha}\ln\!\left(\cosh\!\frac{\alpha T_{\text{turn}}}{c}\right)$$

---

## 3. Interactive Experiments — Chapter-by-Chapter Breakdown

### Chapter 1: The Speed of Light Is Constant

**Learning Goal:** The Michelson-Morley result made viscerally real — no matter how fast you move, you always measure light at $c$.

**Setup:**
- Two observers, Alice (stationary) and Bob (moving at $\beta$ to the right), are rendered on a 2D canvas.
- A light pulse is emitted from the midpoint between them.
- Each observer has a speed-o-meter readout showing the measured speed of the approaching pulse.

**Interaction:**
- Speed slider: $\beta \in [0, 0.99]$.
- "Fire Pulse" button triggers the animation.
- Both readouts always show $c$ (displayed as `1.000 c`).

**Physics calculation:**
In Alice's frame, pulse moves at $c = 1$. Bob moves at $\beta$ toward the pulse. Galilean prediction gives $1 + \beta$. Relativistic formula gives:

$$u_{\text{Bob}} = \frac{1 + (-\beta)}{1 + 1 \cdot (-\beta)} \cdot (-1) = \frac{-(1-\beta)}{1-\beta} = -1 \quad \Rightarrow \quad |u| = 1 = c$$

The readout on Bob's instrument always clamps to exactly $c$ regardless of $\beta$. A secondary display shows the Galilean (wrong) prediction in grey, growing as $\beta$ increases, so the user can see the discrepancy.

**Canvas layout:** 800 × 300 px. Alice on left, Bob on right, moving frame indicator (dotted lines) around Bob's reference bubble.

---

### Chapter 2: Simultaneity Breaks

**Learning Goal:** Two events that happen at the same time are *only* the same time for some observers.

**Setup:**
- Horizontal track with two explosion markers at $x_A = -5$ and $x_B = +5$ (light-seconds, mapped to canvas pixels).
- In the rest frame, both explode at $t = 0$ — shown as simultaneous orange flashes.
- A moving observer (spaceship icon) travels right at speed $\beta$.

**Interaction:**
- Speed dial: $\beta \in [0, 0.99]$.
- As user drags the dial, the time gap $\Delta t' = -\gamma\beta\Delta x/c$ is recalculated and displayed live.
- The explosions are rendered in the moving frame: one fires before the other, with the earlier one highlighted and a countdown timer shown.
- A "freeze at $\Delta t'$" button lets the user see one explosion without the other.

**Numerical readout panel:**
```
beta = 0.600
gamma = 1.250
Delta_x = 10.0 ls
Delta_t (rest frame) = 0.0 s
Delta_t' (moving frame) = -7.500 s
"B explodes 7.5 seconds BEFORE A in the moving frame"
```

> ⚠️ **UI flag:** The sign of $\Delta t'$ reverses when the frame direction flips. Add an arrow labelled "Frame moving →". When $\beta < 0$, the ordering reverses, shown with a colour swap.

**Canvas layout:** 800 × 400 px split: top half shows rest frame, bottom half shows moving frame, both scrolling in real time with a timeline axis.

---

### Chapter 3: Length Contraction

**Learning Goal:** Objects are shorter in frames in which they are moving.

**Setup:**
- A colourful ruler (rainbow gradient, tick marks at every 0.5 ls) of rest length $L_0 = 10\,\text{ls}$ slides across the canvas at speed $\beta$.
- An interactive pixel ruler tool (user drags endpoints, readout in light-seconds).

**Interaction:**
- Speed slider: $\beta \in [0, 0.999]$.
- "Measure Now" button: fires blue flashes at both ends simultaneously in the observer frame and holds them for 2 s.
- The pixel ruler can be dragged to measure the gap between the flashes.
- A "rest length ghost" (dashed outline at full $L_0$) is always shown for comparison.

**Physics:**
Rendered width in pixels:

$$W_{\text{px}} = W_0 \cdot \frac{1}{\gamma} \cdot \mathcal{S}$$

where $\mathcal{S}$ is the pixel-per-light-second scale.

**Numerical readout:**
```
beta = 0.866
gamma = 2.000
L_0 = 10.0 ls
L = L_0/gamma = 5.0 ls
Contraction = 50.0%
```

**Special instruction rendered in canvas:**
"Both ends measured simultaneously in YOUR frame (see blue flashes). In the ruler's frame, those measurements were NOT simultaneous."

---

### Chapter 4: Time Dilation

**Learning Goal:** Moving clocks run slow.

**Setup:**
- Two large analog clocks, side by side.
- Left clock: "Earth Clock" — proper time, advances at rate 1.
- Right clock: "Rocket Clock" — proper time, advances at rate $1/\gamma$.
- Both start at 12:00:00.

**Interaction:**
- Speed dial: $\beta \in [0, 0.999]$.
- Play/pause button.
- "Boost" button: animates the rocket clock accelerating from $\beta = 0$ to the dialled value over 1 second.
- Time readouts in `HH:MM:SS.mmm` format showing divergence to millisecond precision.

**Clock face rendering** (see Section 4.3 for full spec).

**At $\beta = 0.866$ ($\gamma = 2$):** The rocket clock runs at half rate. After 60 real seconds of simulation, Earth clock reads 60 s; rocket clock reads 30 s. Difference displayed as: "Moving clock is 30.0 s behind."

> ⚠️ **UI flag:** Add a tooltip on hover: *"The rocket clock is not malfunctioning. It is correctly counting the spacetime distance along its path, which is shorter than the straight-line Earth path."*

---

### Chapter 5: Relativistic Doppler

**Learning Goal:** Motion toward a light source blueshifts it; motion away redshifts it. The formula is not the same as classical Doppler.

**Setup:**
- A star at the left edge of the canvas radiates light at $\lambda_0 = 550\,\text{nm}$ (green).
- A spaceship (user-controlled) moves left or right along the x-axis.
- The star is rendered as a glowing disc whose colour updates in real time.
- A second display shows the classical Doppler prediction (as a grey ghost disc) to highlight the discrepancy.

**Interaction:**
- Speed dial: $-0.99 \le \beta \le +0.99$ (negative = moving toward star, positive = moving away).
- The "Spectrum Bar" at the bottom of the canvas shows the full visible spectrum with a marker at $\lambda_{\text{obs}}$.
- "Transverse Doppler" button sets $\beta = 0.7$ and direction perpendicular; shows redshift with no classical analogue.

**Colour update:**
```js
const lambdaObs = lambda0 * Math.sqrt((1 - beta) / (1 + beta)); // approaching
const { r, g, b } = wavelengthToRGB(lambdaObs);
star.fillStyle = `rgb(${r},${g},${b})`;
```

**Numerical readout:**
```
beta = -0.700 (approaching)
gamma = 1.400
lambda_0 = 550 nm (green)
lambda_obs = 550 * sqrt(1.7/0.3) = 550 * 2.380 = 316 nm (ultraviolet-blue)
f_obs/f_0 = 2.380x
Classical prediction: lambda_classical = 550 * (1-0.7) = 165 nm (incorrect)
```

---

### Chapter 6: The Twin Paradox Race

**Learning Goal:** Proper time is path-dependent. The twin who travels returns younger.

**Setup:**
- Split-screen: Earth view (left) and Rocket view (right).
- Earth clock at top-left; Bob's rocket clock at top-right.
- Journey has three phases: outbound ($\beta_1$), turnaround (instantaneous in simplified version), return ($\beta_2$).
- A progress bar shows the current journey phase.

**Interaction:**
- Sliders: $\beta_1 \in [0, 0.99]$ and $\beta_2 \in [0, 0.99]$ (set independently for asymmetric journey).
- "Journey Duration" input: total Earth-frame time $T$ (range: 1 to 100 sim-years).
- "Launch!" button starts the animation.
- "Freeze at turnaround" button pauses at the halfway point to show the instantaneous frame switch and the jump in simultaneity.

**Proper time calculation:**

$$\tau_{\text{Bob}} = \frac{T}{2}\sqrt{1-\beta_1^2} + \frac{T}{2}\sqrt{1-\beta_2^2}$$

**Result screen:** Both proper times, difference $\Delta\tau$, and a visualisation of both worldlines on a Minkowski diagram (straight line for Alice, bent V-shape for Bob).

**At $\beta_1 = \beta_2 = 0.9$ ($\gamma \approx 2.294$), $T = 20$ years:**

$$\tau_{\text{Bob}} = 2 \times 10 \times \sqrt{0.19} = 20 \times 0.4359 = 8.72\,\text{years}$$
$$\tau_{\text{Alice}} = 20\,\text{years}$$
$$\Delta\tau = 11.28\,\text{years}$$

"Bob is 11.28 years younger than Alice when he returns."

---

### Chapter 7: Spacetime Diagram (Minkowski)

**Learning Goal:** Understand worldlines, light cones, and simultaneity hypersurfaces geometrically. Observe how the spacetime interval $s^2$ is invariant under all Lorentz boosts.

**Setup:**
- Full-canvas Minkowski diagram: $x$-axis horizontal, $ct$-axis vertical.
- Light cone (45-degree lines) always shown.
- Sparse ticks at coordinate values $\pm 4$ and $\pm 2$ on both axes.
- Pre-loaded events on load:
  - Event A: $(0,0)$ "Rocket launch" (stays fixed at the origin under boosts)
  - Event B: $(0,4)$ "Engine cutoff" (timelike relative to A, $s^2 = +16.00$)
  - Event C: $(2,2)$ "Light signal arrives" (lightlike relative to A, $s^2 = 0.00$)
  - Event D: $(4,1)$ "Distant explosion" (spacelike relative to A, $s^2 = -15.00$)
- Events A and B are auto-selected on initial load.
- Background curves: timelike and spacelike invariant hyperbolas ($s^2 = \pm 1, \pm 4, \pm 9$) color-coded using HSL emerald green/magenta tokens. Both upper/lower and left/right branches are drawn.

**Interaction:**
- **Proximity Selection:** Click or touch within 14px of any event dot to select or deselect it.
- **Adding Events:** Click or touch on empty canvas space (or click "+ Add Event" button) to place a new event at that coordinate (up to 6 total).
- **Boost Frame Slider:** Rapidly transforms diagram coordinates by rapidity $\phi = \text{arctanh}(\beta)$. Prime axes tilt toward light lines, and events slide along highlighted hyperbola trace curves.
- **Trace Highlights:** Selected events have their individual Rapidity path curves rendered as bright Path2D cached curves (with an early-exit guard for light-cone and origin events).
- **Dashed Connector Lines:** Drawn between the two selected events, color-coded by causal type (emerald green for timelike, magenta for spacelike, amber for lightlike). A centered, clear-backed midpoint text label displays $s^2$.
- **Restructured HUD:** Restructured layout placing invariant $s^2$ at the top in large bold amber with an "↑ Invariant under all boosts" description and color-coded type pill badge. Coordinate values $\Delta x$ and $\Delta t$ are muted and labeled "(frame-dependent)". Trigger a pulse animation on $s^2$ change.
- **Clear Sandbox:** Resets the board back to the pre-loaded 4-event state (A, B, C, D).

**Lorentz boost as hyperbolic rotation:**

The Lorentz boost is a hyperbolic rotation by rapidity $\phi = \text{arctanh}(\beta)$:

$$ct' = ct\cosh\phi - x\sinh\phi$$
$$x' = -ct\sinh\phi + x\cosh\phi$$

The primed axes tilt toward the $45°$ light lines as $\beta \to 1$. The diagram updates in real time as the boost slider moves.

**Simultaneity hypersurface rendering:**

Lines of constant $t'$ in the $S$ diagram are:

$$t = \beta x + \frac{t'_0}{\gamma}$$

Draw these as dashed lines with slope $\beta$ (in $x$-$t$ units), one per grid unit of $t'$.

---

### Chapter 8: The Speed Limit

**Learning Goal:** You can apply force forever and never reach $c$. Energy diverges.

**Setup:**
- A spaceship accelerates along a horizontal track.
- The user clicks "Apply Thrust" which applies a constant **proper** acceleration $\alpha = 9.8\,\text{m/s}^2$ (one Earth gravity).
- The coordinate velocity, momentum, and kinetic energy are displayed live.
- A velocity asymptote indicator shows $c$ as a red dashed line the ship never crosses.

**Physics (constant proper acceleration):**

Coordinate velocity:
$$v(t) = \frac{\alpha t}{\sqrt{1 + \left(\dfrac{\alpha t}{c}\right)^2}}$$

Coordinate acceleration (falls to zero):
$$a(t) = \frac{dv}{dt} = \frac{\alpha}{\left(1 + \left(\dfrac{\alpha t}{c}\right)^2\right)^{3/2}}$$

Kinetic energy:
$$K(t) = (\gamma(t) - 1)mc^2, \quad \gamma(t) = \sqrt{1 + \left(\frac{\alpha t}{c}\right)^2}$$

**Graphs shown (three stacked subplots):**

1. $v$ vs $t$ — the asymptotic approach to $c$
2. $a$ vs $t$ — falling coordinate acceleration despite constant thrust
3. $K$ vs $t$ — diverging energy (log scale)

**Numerical comparison panel:**
```
At t = 1 year of constant 1g thrust:
  Newtonian speed:    v_Newton = alpha*t = 3.07e8 m/s (> c, IMPOSSIBLE)
  Relativistic speed: v_rel    = 0.770 c
  gamma = 1.574
  K_Newton = 0.5*m*v^2 = 4.71e16 J
  K_rel    = (gamma-1)*m*c^2 = 5.15e16 J  (8.9% more energy, same speed)
```

> ⚠️ **Counterintuitive.** Students expect constant thrust → constant acceleration. Show the broken expectation explicitly: plot the Newtonian trajectory (grey) alongside the relativistic one. The grey line goes off-canvas past $c$. The relativistic line hugs the asymptote.

---

## 4. Rendering Design

### 4.1 Minkowski Spacetime Diagram

**Axis conventions:**
- Horizontal axis: $x$ (position), increasing rightward.
- Vertical axis: $ct$ (time x speed of light), increasing upward.
- Origin at canvas centre.
- Grid lines every 1 light-second (one unit), drawn in `rgba(255,255,255,0.08)`.
- Bold gridlines every 5 units in `rgba(255,255,255,0.18)`.

**Axis labels** are drawn at the canvas edge with the Canvas `fillText` API, rotated with `ctx.save() / ctx.rotate(-Math.PI/2) / ctx.restore()` for the vertical axis.

**Worldline rendering:**

A worldline is a series of $(x, ct)$ point objects stored in an array. On each frame, the renderer connects them with `ctx.lineTo`:

```js
function drawWorldline(ctx, points, color, width=2) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.moveTo(toCanvasX(points[0].x), toCanvasY(points[0].ct));
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(toCanvasX(points[i].x), toCanvasY(points[i].ct));
  }
  ctx.stroke();
}
```

**Simultaneity hypersurfaces** are drawn as dashed lines with slope $\beta$ in $x$-$t$ space (see Section 2.9).

**Light cone** is rendered per Section 2.8.3.

**Boosted axes for $S'$:** The $x'$-axis has slope $\beta$ in the $S$ diagram; the $ct'$-axis has slope $1/\beta$ in the $S$ diagram. Both are drawn in contrasting colour (cyan for $x'$-axis, magenta for $ct'$-axis).

---

### 4.2 Relativistic Doppler Colour Mapping

Full implementation given in Section 2.5.3. The star glow is rendered as a radial gradient:

```js
const {r, g, b} = wavelengthToRGB(lambdaObs);
const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60);
grad.addColorStop(0, `rgba(${r},${g},${b},1.0)`);
grad.addColorStop(0.5, `rgba(${r},${g},${b},0.5)`);
grad.addColorStop(1, `rgba(${r},${g},${b},0.0)`);
ctx.fillStyle = grad;
ctx.beginPath();
ctx.arc(sx, sy, 60, 0, Math.PI*2);
ctx.fill();
```

The spectrum bar at the bottom of Chapter 5's canvas is rendered by iterating $\lambda$ from 380 to 700 in 1 nm steps and drawing 1-pixel-wide vertical bars:

```js
for (let lambda = 380; lambda <= 700; lambda++) {
  const {r, g, b} = wavelengthToRGB(lambda);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(spectrumX + (lambda-380)*scaleX, spectrumY, scaleX, spectrumH);
}
```

A triangle marker slides to $\lambda_{\text{obs}}$.

---

### 4.3 Clock Face Rendering

The clock face is drawn procedurally each frame. Proper time `tau` drives the hands.

```js
function drawClock(ctx, cx, cy, radius, tau, label, dimmed=false) {
  const alpha = dimmed ? 0.5 : 1.0;

  // Face
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI*2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();
  ctx.strokeStyle = '#8080ff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Tick marks
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI/2;
    const inner = (i % 3 === 0) ? radius * 0.8 : radius * 0.88;
    ctx.beginPath();
    ctx.moveTo(cx + inner*Math.cos(angle), cy + inner*Math.sin(angle));
    ctx.lineTo(cx + radius*0.96*Math.cos(angle), cy + radius*0.96*Math.sin(angle));
    ctx.strokeStyle = '#c0c0ff';
    ctx.lineWidth = (i % 3 === 0) ? 2.5 : 1.5;
    ctx.stroke();
  }

  // Hour hand  (tau / 43200 * 2*pi)
  const hAngle = (tau / 43200) * Math.PI * 2 - Math.PI/2;
  drawHand(ctx, cx, cy, radius*0.55, hAngle, '#ffffff', 4);

  // Minute hand (tau / 3600 * 2*pi)
  const mAngle = (tau / 3600) * Math.PI * 2 - Math.PI/2;
  drawHand(ctx, cx, cy, radius*0.80, mAngle, '#c0c0ff', 2.5);

  // Second hand (tau / 60 * 2*pi)
  const sAngle = (tau / 60) * Math.PI * 2 - Math.PI/2;
  drawHand(ctx, cx, cy, radius*0.88, sAngle, '#ff4444', 1.5);

  // Label
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 13px 'Inter', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + radius + 20);
}
```

---

### 4.4 Ruler Tool

The pixel ruler is an interactive overlay drawn on a separate canvas layer (positioned absolutely above the main canvas):

- On `mousedown`: record `startPx`.
- On `mousemove` (if dragging): draw a line from `startPx` to `currentPx`. Display pixel length. Convert to light-seconds using current scale $\mathcal{S}$: `ls = pixelLength / S`.
- On `mouseup`: freeze the measurement. Display `L = X.XX ls`.

The ruler line is drawn with `ctx.setLineDash([4, 4])` in bright yellow. Endpoint circles are drawn with radius 5 px. The numerical label is rendered in a small rounded-rect tooltip box.

---

### 4.5 Lorentz-Boosted Scene Transform

When the user clicks "Their Frame" (the moving frame), all object positions are Lorentz-transformed. This is a full scene transform:

```js
function boostScene(objects, beta, t_snapshot) {
  // t_snapshot: the coordinate time at which to "freeze" and boost
  return objects.map(obj => {
    const { xPrime, tPrime } = lorentzForward(obj.x, t_snapshot, beta);
    const gamma = 1 / Math.sqrt(1 - beta * beta);
    return {
      ...obj,
      x: xPrime,
      t: tPrime,
      width: obj.width / gamma, // contract x-dimension
    };
  });
}
```

The boost is animated with a 300 ms CSS `transition` on a `transform: scaleX()` applied to the canvas wrapper, then the canvas redraws with the new coordinates. This gives the user a visual "squish" feel as the frame switches.

---

### 4.6 Relativistic Aberration

When moving at speed $\beta$, the apparent angle $\theta'$ of a light source at angle $\theta$ (in the rest frame) transforms as:

$$\cos\theta' = \frac{\cos\theta - \beta}{1 - \beta\cos\theta}$$

For Chapter 5, the starfield is a set of static star positions $\{(\theta_i, r_i)\}$. When the spaceship moves at $\beta$, each star's angular position is updated using the aberration formula. Stars ahead (in the direction of motion) appear compressed toward the forward direction; stars behind appear pushed toward the rear:

```js
function aberratedAngle(theta, beta) {
  const cosTheta = Math.cos(theta);
  const cosThetaPrime = (cosTheta - beta) / (1 - beta * cosTheta);
  return Math.acos(Math.max(-1, Math.min(1, cosThetaPrime)));
}
```

The `Math.max/min` clamps handle numerical edge cases near $\theta = 0°$ and $\theta = 180°$.

At $\beta = 0.99$, the aberration effect is dramatic: the entire forward hemisphere of stars is compressed into a narrow cone of half-angle approximately $8°$.

---

## 5. UI/UX Design

### 5.1 Speed Dial

The speed dial maps the physical input range $\beta \in [0, 0.99]$ to a **nonlinear** dial position $\theta \in [0°, 270°]$ (three-quarter circle). The mapping uses a hyperbolic tangent warp:

$$\beta(\theta) = \tanh\!\left(\frac{\theta}{\theta_{\max}} \cdot k\right)$$

where $k = \text{arctanh}(0.99) \approx 2.647$ and $\theta_{\max} = 270°$. This gives:
- The bottom 50% of the dial range covers $\beta \in [0, 0.76]$ (comfortable, low-speed range).
- The top 50% covers $\beta \in [0.76, 0.99]$ — compressed for precise near-$c$ control.
- The last 10% of the dial range spans $\beta \in [0.95, 0.99]$ — the region where $\gamma$ changes most rapidly.

**Rendering:** The dial is a Canvas element, 200 × 200 px. The arc is drawn with `ctx.arc`, the knob is a draggable circle. The dial angle is mapped from mouse drag angle relative to the centre.

**Inverse mapping (for programmatic updates):**

$$\theta(\beta) = \frac{\theta_{\max}}{k} \cdot \text{arctanh}(\beta)$$

---

### 5.2 Beta/Gamma Live Readout Panel

Always visible in the top-right corner of the experiment canvas:

```
+---------------------------+
|  beta  = 0.8660           |
|  gamma = 2.0000           |
|  v     = 2.598e8 m/s      |
|  gamma-1 = 1.0000         |
|  1/gamma = 0.5000         |
+---------------------------+
```

- $\beta$ and $\gamma$ update at 60 fps.
- $v = \beta \cdot c$ displayed in m/s (with $c = 2.998 \times 10^8\,\text{m/s}$).
- $\gamma - 1$ (the "excess factor") is displayed because it often appears directly in KE and Doppler formulas.
- $1/\gamma$ (time dilation factor) displayed for direct comparison with clock rates.

The panel uses `monospace` font for stable layout despite digit changes.

---

### 5.3 Frame Toggle Button

A prominent button in the toolbar:

```
[ Your Frame (S) ]  <->  [ Their Frame (S') ]
```

Clicking performs:
1. Stores current $\beta_{\text{current}}$.
2. Applies `boostScene(allObjects, beta_current, t_now)`.
3. Flips $\beta$ to $-\beta$ (since from $S'$, $S$ moves in the opposite direction).
4. Updates the readout panel to show primed coordinates.
5. Labels the canvas with the active frame name.

A visual indicator (glowing border: blue for $S$, orange for $S'$) makes the current frame unambiguous at a glance.

---

### 5.4 Proper Time vs Coordinate Time Comparison Panel

Displayed in Chapters 4 and 6:

```
+-----------------------------------------------+
|               TIME COMPARISON                 |
|  -------------------------------------------  |
|  Coordinate time (t):  72.000 s  ----------   |
|  Proper time Bob (tau): 36.000 s  ------       |
|  -------------------------------------------  |
|  Time saved by motion: 36.000 s               |
|  Bob is 36.0 s younger                        |
+-----------------------------------------------+
```

The bar visualisation on the right uses `fillRect` with proportional widths. The coordinate time bar is always full width; the proper time bar is $1/\gamma$ of full width.

---

### 5.5 Chapter Navigation

Each chapter is a discrete `section` element with `data-chapter="N"`. The JavaScript engine reads the active chapter and loads the appropriate scene configuration:

```js
const CHAPTERS = {
  1: { title: "Speed of Light",     initFn: initChapter1, defaultBeta: 0.6 },
  2: { title: "Simultaneity",       initFn: initChapter2, defaultBeta: 0.5 },
  3: { title: "Length Contraction", initFn: initChapter3, defaultBeta: 0.7 },
  4: { title: "Time Dilation",      initFn: initChapter4, defaultBeta: 0.5 },
  5: { title: "Doppler",            initFn: initChapter5, defaultBeta: 0.0 },
  6: { title: "Twin Paradox",       initFn: initChapter6, defaultBeta: 0.8 },
  7: { title: "Spacetime Diagram",  initFn: initChapter7, defaultBeta: 0.0 },
  8: { title: "Speed Limit",        initFn: initChapter8, defaultBeta: 0.0 },
};
```

Progress is tracked in `localStorage` under key `spacelab_sr_progress`. Completing a chapter (reaching its "aha moment" interaction) sets a badge and unlocks the next chapter.

---

### 5.6 "Show the Math" Disclosure

Each chapter has a collapsible `<details>` element below the canvas:

```html
<details class="math-panel">
  <summary>Show the math &#9654;</summary>
  <div class="math-content">
    <!-- LaTeX rendered via KaTeX (loaded from CDN as single exception) -->
  </div>
</details>
```

KaTeX is the **only** external dependency allowed (for rendering LaTeX). It is loaded from the jsDelivr CDN and cached. The math panel does not block the simulation — the canvas runs identically whether the panel is open or closed.

---

### 5.7 Colour Scheme & Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-deep` | `#06060f` | Canvas background |
| `--bg-surface` | `#0d0d1f` | Panel background |
| `--accent-primary` | `#4fc3f7` | Frame $S$ elements, buttons |
| `--accent-secondary` | `#ff9800` | Frame $S'$ elements |
| `--accent-light` | `#FFD700` | Light cone lines |
| `--accent-danger` | `#ef5350` | Speed limit, warnings |
| `--text-primary` | `#e8eaf6` | Body text |
| `--text-muted` | `#7986cb` | Secondary readouts |
| `--font-body` | `'Inter', sans-serif` | UI text |
| `--font-mono` | `'JetBrains Mono', monospace` | Numerical readouts |

Typography loaded via Google Fonts:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

---

## 6. Dependencies & Technical Requirements

### 6.1 Why Vanilla Canvas 2D — No Libraries

The lab uses exclusively the **HTML5 Canvas 2D API** and vanilla JavaScript. Justifications:

1. **Zero bundle weight.** Physics simulations have tight animation loop budgets (target: 60 fps, 16.7 ms/frame). Loading Three.js, D3, or a physics library adds 200–600 KB of JavaScript parse time that delays first interaction.

2. **Full control over the coordinate system.** Relativistic rendering requires Lorentz-boosting every single point in the scene. A 2D canvas transform (`ctx.setTransform`) does not apply a Lorentz boost (which is a hyperbolic rotation, not an affine transform). All point transforms must be done explicitly in JavaScript. A library abstraction layer would fight this.

3. **Deterministic frame timing.** `requestAnimationFrame` gives a monotonic timestamp. The physics engine accumulates proper time and coordinate time using this timestamp directly. Library animation loops may introduce jitter.

4. **Educational transparency.** The codebase is inspectable. A student who opens DevTools can find `lorentzForward`, read the Lorentz transform, and modify $\gamma$ to see what breaks. This is intentional.

**The single allowed exception:** KaTeX (via CDN, deferred load) for rendering LaTeX in the "Show the math" panels. KaTeX is render-only, does not touch the canvas, and has no impact on simulation performance.

### 6.2 Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Steady-state frame rate | 60 fps | At $\beta \le 0.999$ |
| First canvas paint | < 200 ms | From DOMContentLoaded |
| JS bundle size | < 80 KB | Un-minified; ~40 KB minified |
| Memory usage | < 50 MB | Worldline history capped at 2000 points |
| Touch responsiveness | < 50 ms | Speed dial drag latency |

**Worldline history pruning:** Minkowski diagram worldlines cap at 2000 stored points. When the array exceeds this, the oldest 200 points are pruned in a single splice:

```js
if (worldline.length > 2000) worldline.splice(0, 200);
```

**Dirty-flag rendering:** The readout panel (Section 5.2) is an HTML `<div>` updated with `innerText` only when the value has changed by more than `0.0001`. This avoids excessive DOM writes.

**Web Worker option (optional optimisation):** The Lorentz transform calculations for the Minkowski diagram (computing 2000-point worldlines) can be offloaded to a `Worker`. The worker receives `{points, beta}` via `postMessage`, returns transformed coordinates. Not required for the initial implementation but documented here for future optimisation.

### 6.3 Browser Compatibility

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 90+ | Primary target |
| Firefox | 88+ | Full support |
| Safari | 14+ | Canvas performance slightly lower |
| Edge | 90+ | Chromium-based, same as Chrome |
| Mobile Safari (iOS) | 14+ | Touch events for dial |
| Chrome Android | 90+ | Touch events for dial |

**Feature detection:**

```js
function checkSupport() {
  const canvas = document.createElement('canvas');
  if (!canvas.getContext) {
    showError("Your browser does not support HTML5 Canvas. Please update your browser.");
    return false;
  }
  if (!window.requestAnimationFrame) {
    showError("Your browser is too old. Please use a modern browser.");
    return false;
  }
  return true;
}
```

**High-DPI scaling:** All canvases apply the device pixel ratio:

```js
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}
```

---

## 7. Integration with Flask/Jinja2 Site Structure

### 7.1 Route

Add a new route in `portfolio/routes/space_physics.py` (alongside the existing Galilean relativity and other lab routes):

```python
@space_physics_bp.route('/labs/special-relativity')
def special_relativity():
    return render_template(
        'space_physics/lab_special_relativity.html',
        title='Special Relativity: Interactive Lab',
        meta_description=(
            'Explore time dilation, length contraction, and the twin paradox '
            'through interactive 2D canvas simulations of Einstein\'s special relativity.'
        ),
        chapter=request.args.get('chapter', 1, type=int),
    )
```

The `chapter` query parameter allows deep-linking (e.g., `/labs/special-relativity?chapter=5` opens Chapter 5 — Doppler). The JavaScript reads this on load:

```js
const startChapter = parseInt(
  new URLSearchParams(window.location.search).get('chapter') || '1'
);
```

### 7.2 Template Structure

**File:** `portfolio/templates/space_physics/lab_special_relativity.html`

```jinja2
{% extends 'base.html' %}

{% block title %}{{ title }} | Space & Physics{% endblock %}

{% block meta %}
<meta name="description" content="{{ meta_description }}">
<meta property="og:title" content="{{ title }}">
<meta property="og:description" content="{{ meta_description }}">
<meta property="og:type" content="website">
{% endblock %}

{% block head_extra %}
<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700
      &family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<!-- KaTeX for LaTeX rendering -->
<link rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer
  src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer
  src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.querySelector('.math-content'), {
    delimiters: [
      {left:'$$',right:'$$',display:true},
      {left:'$',right:'$',display:false}
    ]
  })">
</script>
<!-- Lab CSS -->
<link rel="stylesheet"
  href="{{ url_for('static', filename='css/lab_special_relativity.css') }}">
{% endblock %}

{% block content %}
<main class="sr-lab" id="sr-lab-main">
  <header class="sr-lab__header">
    <h1>Special Relativity: Interactive Lab</h1>
    <p class="sr-lab__subtitle">
      Eight experiments. One insight: space and time are one fabric.
    </p>
  </header>

  <!-- Chapter navigation tabs -->
  <nav class="sr-lab__chapters" aria-label="Experiment chapters">
    {% for n in range(1, 9) %}
    <button class="chapter-tab" data-chapter="{{ n }}" id="chapter-tab-{{ n }}">
      Ch.{{ n }}
    </button>
    {% endfor %}
  </nav>

  <!-- Main canvas region -->
  <section class="sr-lab__stage" id="sr-stage">
    <canvas id="sr-canvas" width="800" height="500"
            aria-label="Special Relativity simulation"></canvas>
    <canvas id="sr-overlay" width="800" height="500"
            aria-label="Measurement overlay"></canvas>
  </section>

  <!-- Controls injected per chapter by JS -->
  <aside class="sr-lab__controls" id="sr-controls"></aside>

  <!-- Live readout panel -->
  <aside class="sr-lab__readout" id="sr-readout" aria-live="polite">
    <div class="readout-row">
      <span class="readout-label">&#946;</span>
      <span class="readout-value" id="rd-beta">0.000</span>
    </div>
    <div class="readout-row">
      <span class="readout-label">&#947;</span>
      <span class="readout-value" id="rd-gamma">1.000</span>
    </div>
    <div class="readout-row">
      <span class="readout-label">v</span>
      <span class="readout-value" id="rd-v">0 m/s</span>
    </div>
  </aside>

  <!-- Math disclosure panel -->
  <details class="math-panel" id="math-panel">
    <summary>Show the math &#9654;</summary>
    <div class="math-content" id="math-content">
      <!-- KaTeX-rendered LaTeX injected by JS per chapter -->
    </div>
  </details>
</main>

<!-- Lab JavaScript (ES6 module) -->
<script type="module"
  src="{{ url_for('static', filename='js/space_physics/lab_special_relativity.js') }}">
</script>
{% endblock %}
```

### 7.3 Static File Layout

```
portfolio/static/
├── css/
│   └── lab_special_relativity.css
└── js/
    └── space_physics/
        └── lab_special_relativity.js    <- main entry point (ES6 module)
            Imports:
            ├── engine/lorentz.js        <- lorentzForward, lorentzInverse
            ├── engine/doppler.js        <- wavelengthToRGB, dopplerShift
            ├── engine/proper_time.js    <- updateProperTime, twinParadox
            ├── chapters/chapter1.js     <- initChapter1, tickChapter1
            ├── chapters/chapter2.js     ...
            ├── chapters/chapter3.js
            ├── chapters/chapter4.js
            ├── chapters/chapter5.js
            ├── chapters/chapter6.js
            ├── chapters/chapter7.js
            ├── chapters/chapter8.js
            ├── render/clock.js          <- drawClock, drawHand
            ├── render/minkowski.js      <- drawWorldline, drawLightCone, drawGrid
            ├── render/ruler.js          <- RulerTool class
            └── ui/dial.js               <- SpeedDial class
```

The JavaScript is organised as ES6 modules. `lab_special_relativity.js` uses dynamic imports to load only the active chapter's module:

```js
const { init, tick } = await import(`./chapters/chapter${activeChapter}.js`);
```

This keeps initial load weight minimal — the user downloads only the chapter they are viewing.

### 7.4 Navigation Integration

The lab appears in the Space & Physics section's chapter list. Add a card to the space physics index template:

```jinja2
<a href="{{ url_for('space_physics.special_relativity') }}"
   class="lab-card lab-card--sr">
  <div class="lab-card__icon">&#9889;</div>
  <h3>Special Relativity</h3>
  <p>Time dilation, length contraction, and the twin paradox — all interactive.</p>
  <span class="lab-card__badge">8 experiments</span>
</a>
```

### 7.5 SEO & Accessibility

- `<h1>` is unique per page: "Special Relativity: Interactive Lab".
- All interactive `<canvas>` elements have `aria-label` attributes (see template above).
- The `aria-live="polite"` on the readout panel announces value changes to screen readers.
- Chapter tabs are `<button>` elements (not `<div>`) for full keyboard navigability.
- All controls are keyboard-accessible: the speed slider is a native `<input type="range">` (wrapped in a custom-styled container), not a canvas-drawn control. The speed **dial** (Section 5.1) is canvas-drawn and includes a companion `<input type="range">` that is visually hidden but keyboard-accessible via the `aria-controls` pattern.

---

## Appendix A: Physical Constants Used

| Constant | Symbol | Value | Notes |
|----------|--------|-------|-------|
| Speed of light | $c$ | $2.998 \times 10^8\,\text{m/s}$ | Used for display conversions only |
| Internal $c$ | $c$ | $1$ (natural units) | All engine calculations |
| Default star wavelength | $\lambda_0$ | $550\,\text{nm}$ | Solar green |
| Default proper acceleration | $\alpha$ | $9.8\,\text{m/s}^2$ | Chapter 8 thrust |
| Chapter 2 spatial separation | $\Delta x$ | $10\,\text{ls}$ | Default for simultaneity demo |

---

## Appendix B: Mathematical Notation Quick Reference

| Symbol | Meaning |
|--------|---------|
| $\beta$ | $v/c$ — velocity as fraction of light speed |
| $\gamma$ | Lorentz factor $1/\sqrt{1-\beta^2}$ |
| $\tau$ | Proper time (frame-independent, measures clock ticks) |
| $t$ | Coordinate time in frame $S$ |
| $t'$ | Coordinate time in frame $S'$ |
| $s^2$ | Spacetime interval $c^2\Delta t^2 - \Delta x^2$ |
| $\phi$ | Rapidity $= \text{arctanh}(\beta)$ |
| $\Delta x$ | Coordinate spatial separation |
| $L_0$ | Rest length of an object |
| $L$ | Contracted length $= L_0/\gamma$ |
| $f_0$ | Emitted frequency |
| $f_{\text{obs}}$ | Observed (Doppler-shifted) frequency |
| $\lambda_0$ | Emitted wavelength |
| $\lambda_{\text{obs}}$ | Observed wavelength |
| $K$ | Relativistic kinetic energy $= (\gamma-1)mc^2$ |
| $E$ | Total energy $= \gamma mc^2$ |
| $p$ | Relativistic momentum $= \gamma mv$ |
| $U^\mu$ | Four-velocity |
| $\mathcal{S}$ | Canvas scale: pixels per light-second |

---

## Appendix C: Counterintuitive Effects — UI Treatment Summary

The following effects require special UI treatment (warning banners, tooltips, and explicit "prediction vs. reality" comparisons):

| Effect | Why Counterintuitive | UI Treatment |
|--------|---------------------|--------------|
| Light speed invariance | Galilean intuition: speeds add | Side-by-side Galilean vs. relativistic speedometer |
| Simultaneity failure | Universal "now" is deeply ingrained | "Before dragging, predict: which explosion is first?" prompt |
| Length contraction | No everyday analogue | Ghost rest-length rectangle always shown |
| Time dilation | Moving clocks look "broken" | Tooltip: "Nothing is wrong with the clock" |
| Transverse Doppler | Zero classical Doppler at $90°$ | Marked "No classical equivalent" |
| Ordering reversal | Spacelike events can reverse temporal order | Colour-coded before/after panel with causality note |
| Acceleration drop | "Just push harder" expectation | Newtonian ghost trajectory shown going past $c$ |
| Energy divergence | Infinite energy seems like fiction | Log-scale energy graph with power-of-10 labels |

---

*End of Specification — `lab_special_relativity.md` v1.0*
