# Space & Physics Explorable Explanations | Technical Specification

This document details the mathematical formulations, numerical solvers, reference frame transformations, and canvas coordinate mappings implemented in the **Space & Physics** module.

---

## 1. Physical Formulation & Force Laws

Newton's second law, $F = m a$, is modeled computationally as a coupled system of two first-order Ordinary Differential Equations (ODEs):

$$\frac{dx}{dt} = v$$

$$\frac{dv}{dt} = \frac{F(x, v)}{m}$$

In the simulation codebase, mass is set to $m = 1.0\,\text{kg}$. The active force $F(x, v)$ is chosen from four physical models:

1.  **Free (No Force):**
    $$F = 0$$
    *Behavior:* Particle travels at constant velocity.
2.  **Constant Acceleration:**
    $$F = F_0 = 0.80\,\text{N}$$
    *Behavior:* Velocity changes linearly, position changes quadratically.
3.  **Spring Force (Hooke's Law):**
    $$F = -k x, \quad \text{where } k = 0.04\,\text{N/m}$$
    *Behavior:* Simple harmonic motion (closed circular orbit in phase space).
4.  **Viscous Drag (Damping):**
    $$F = -b v, \quad \text{where } b = 0.30\,\text{kg/s}$$
    *Behavior:* Exponential velocity decay, particle grinds to a halt.

---

## 2. Numerical Integration & Solver Stability

Computers approximate the continuous solutions by discretizing time into steps of size $\Delta t$. We compare three paths:

### Analytical Solution (Exact Reference)
For the spring oscillator starting at $(x_0, v_0)$ at $t=0$:
$$\omega = \sqrt{\frac{k}{m}}$$
$$x(t) = x_0 \cos(\omega t) + \frac{v_0}{\omega} \sin(\omega t)$$
$$v(t) = -x_0 \omega \sin(\omega t) + v_0 \cos(\omega t)$$

### Forward Euler (Explicit)
$$v_{n+1} = v_n + \frac{F(x_n, v_n)}{m} \Delta t$$
$$x_{n+1} = x_n + v_n \Delta t$$
*Stability Analysis:* For a spring system, the Jacobian matrix eigenvalues have a magnitude greater than 1: $|1 - \omega^2 \Delta t^2| > 1$. Energy increases artificially every step, causing the state vector to spiral outward indefinitely.

### Euler-Cromer (Symplectic)
$$v_{n+1} = v_n + \frac{F(x_n, v_n)}{m} \Delta t$$
$$x_{n+1} = x_n + v_{n+1} \Delta t$$
*Stability Analysis:* Euler-Cromer is a symplectic integrator that preserves phase space volume (satisfying Liouville's theorem). While local energy oscillates, global error remains bounded, resulting in a stable, closed circular orbit.

### Stability Boundary Limit
The stability threshold for harmonic motion integrated via Euler-Cromer is:
$$\Delta t_{\text{crit}} = \frac{2}{\omega} = 2.00\,\text{s}$$
*   For $\Delta t < 2.00\,\text{s}$: Orbits remain stable and bounded.
*   For $\Delta t \ge 2.00\,\text{s}$: The solution explodes exponentially. The UI displays an warning banner when $\Delta t \ge 2.00\,\text{s}$ is scrubbed.

---

## 3. Galilean Transformations

To demonstrate coordinate invariance, a trajectory modeled in a stationary frame $S$ is boosted into a moving frame $S'$ traveling at constant relative velocity $u$ (scrubbed by the user):

### Position Transformation
$$x' = x - u t$$

### Velocity Transformation
$$v' = v - u$$

### Acceleration Transformation (Invariance)
$$a' = \frac{dv'}{dt} = \frac{d}{dt}(v - u) = \frac{dv}{dt} - 0 = a$$

In Chapter 7, the stationary frame $S$ and moving frame $S'$ coordinate particles are rendered side-by-side. The acceleration graph overlays both curves to visually prove that $a' = a$.

---

## 4. Canvas Coordinate Mapping & High-DPI Scaling

Canvases are scaled dynamically using the screen's pixel ratio to ensure razor-sharp graphics on Retina and 4K displays:

$$W_{\text{canvas}} = W_{\text{CSS}} \times \text{devicePixelRatio}$$
$$H_{\text{canvas}} = H_{\text{CSS}} \times \text{devicePixelRatio}$$
$$\text{context.scale}(\text{devicePixelRatio}, \text{devicePixelRatio})$$

### Mapping Physics $(x, v)$ to Canvas Coordinates $(px, py)$
For a phase space canvas of width $W$, height $H$, with center $(c_X, c_Y) = (W/2, H/2)$:

*   **Horizontal Position mapping:**
    $$px = c_X + x \times x_{\text{Map}}$$
*   **Vertical Velocity mapping:**
    $$py = c_Y - v \times v_{\text{Map}}$$

In Chapter 6, the scale factors are configured to $x_{\text{Map}} = v_{\text{Map}} = 0.95$ on a $400\,\text{px}$ tall canvas to keep the growing Forward Euler coils fully visible.
