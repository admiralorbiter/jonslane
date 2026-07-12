# Expanding Universe Cosmology | Technical Specification

This document details the mathematical formulations, coordinate transformations, and visual simulation mechanics implemented in the **Expanding Universe** explorable explanation page (`expanding_universe.html`).

---

## 1. Coordinate Systems & Scale Factor

A homogeneous, isotropic Friedmann-Lemaître-Robertson-Walker (FLRW) universe models expansion as the stretching of space itself.

### Comoving Coordinate ($\chi$)
Comoving coordinates are fixed relative to the cosmic expansion flow. If two galaxies are only affected by uniform expansion, their comoving separation remains constant:
$$\frac{d\chi}{dt} = 0$$

### Proper Distance ($D$)
The spatial distance between two locations measured along a surface of constant cosmic time:
$$D(t) = a(t) \cdot \chi$$
where $a(t)$ is the dimensionless **scale factor** representing the relative size of the universe. This proper distance can be idealized as a chain of local rulers laid between the locations at that cosmic instant, in a spatially flat universe model.

### Transformations in UI (Chapter 3)
*   **Comoving View:** Grid lines are kept at a constant physical spacing on screen. Galaxies remain pinned to intersections.
*   **Proper View:** Grid lines expand and contract dynamically according to $a(t)$, showing proper coordinates stretching on screen.

---

## 2. Expansion Histories (Chapter 4)

We model the scale factor $a(t)$ across three idealized universe components, normalized to $a(t_0) = 1.0$ at present time $t_0 = 2.5\,\text{s}$:

1.  **Radiation Dominated:**
    $$a(t) = \frac{\sqrt{t}}{\sqrt{2.5}}$$
2.  **Matter Dominated:**
    $$a(t) = \frac{t^{2/3}}{2.5^{2/3}}$$
3.  **Cosmological Constant Dominated:**
    $$a(t) = e^{0.4(t - 2.5)}$$

---

## 3. Expansion Rates & Hubble's Law (Chapter 5)

Differentiating the proper distance equation $D(t) = a(t)\chi$ yields the Hubble recession rate:
$$v_{\text{rec}} \equiv \dot{D}(t) = \dot{a}(t)\chi + a(t)\dot{\chi}$$

Assuming pure Hubble flow ($\dot{\chi} = 0$), this simplifies to:
$$v_{\text{rec}} = \dot{a}(t)\chi = \frac{\dot{a}(t)}{a(t)} D(t)$$

We define the **Hubble Parameter $H(t)$**:
$$H(t) \equiv \frac{\dot{a}(t)}{a(t)}$$

Which yields **Hubble's Law**:
$$v_{\text{rec}} = H(t) D(t)$$

### Transition Model (Chapter 5 Dashboard)
To demonstrate a universe that transitions from decelerating to accelerating expansion, we model:
$$a(t) = t^{2/3} + 0.05 t^2$$

The analytical derivatives are:
*   **Expansion velocity $\dot{a}(t)$:**
    $$\dot{a}(t) = \frac{2}{3}t^{-1/3} + 0.10t$$
*   **Hubble Parameter $H(t)$:**
    $$H(t) = \frac{\frac{2}{3}t^{-1/3} + 0.10t}{t^{2/3} + 0.05t^2}$$
*   **Acceleration $\ddot{a}(t)$:**
    $$\ddot{a}(t) = -\frac{2}{9}t^{-4/3} + 0.10$$

### Physical Insight
For $t < 1.36\,\text{s}$, gravity (matter) decelerates the expansion ($\ddot{a} < 0$). For $t > 1.36\,\text{s}$, dark energy dominates and accelerates the expansion ($\ddot{a} > 0$). Throughout this transition, $H(t)$ decreases monotonically, demonstrating that the Hubble parameter can decrease even as the absolute speed of expansion increases.

---

## 4. Hubble Flow vs. Peculiar Motion (Chapter 7)

In local structures, gravitational attraction introduces deviations from the pure Hubble flow.

### Velocity Addition
$$v_{\text{observed}} = v_{\text{Hubble}} + v_{\text{peculiar}} = H(t) D(t) + v_{\text{peculiar}}$$

*Note: This simple additive decomposition is an approximation valid for nearby systems at non-relativistic speeds. At cosmological distances, relative velocities must be computed using general relativistic geodesics and light travel times.*

### Visual Rendering
For the Milky Way and Andromeda galaxy pair:
*   Milky Way is placed at origin $x = 0$.
*   Andromeda is placed at proper distance $D = 32.5\,\text{Mpc}$.
*   **Hubble flow vector:** points radially outward (amber).
*   **Peculiar velocity vector:** points inward/outward (orange).
*   **Net velocity vector:** sum of both (white).
*   If $v_{\text{observed}} < 0$, the system is currently approaching (peculiar motion overcomes Hubble flow). Since this is a purely kinematic model, we do not infer permanent dynamical boundness solely from the sign of the relative velocity.
