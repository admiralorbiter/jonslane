# Technical Specification: Gravity Wave Sculptor

**Module:** Space & Physics → Gravity Wave Sculptor  
**File:** `docs/space_physics/lab_gravity_sculptor.md` (spec) + Jinja2 template (`gravity_sculptor.html`)  
**Status:** Pre-implementation reference  

---

## 1. Overview & Pedagogical Goals

The **Gravity Wave Sculptor** is a 2D/3D physics sandbox where players control the mass, spin, and charge of a central black hole to steer particle streams (representing dust, stellar winds, or light rays) into target collection pockets.

### What the User Learns:
* **Spacetime Curvature**: Massive bodies warp the coordinate lines of spacetime, and objects follow straight paths (geodesics) through this curved space.
* **Gravitational Lensing**: Light bends near massive objects, creating double images, Einstein Rings, and Einstein Crosses.
* **Frame-Dragging (Lense-Thirring Effect)**: A spinning black hole drags space itself around with it, forcing orbiting objects to orbit in the direction of spin.
* **Event Horizon & Ergosphere**: The boundary of no escape ($r_g$) and the region where static observers cannot exist ($r_e$).

---

## 2. Physics Engine & Mathematical Formulation

### 2.1 Gravitational Lensing Approximation
For light passing near a massive central body at impact parameter $b$, the deflection angle $\Delta \theta$ is given by general relativity as:

$$\Delta \theta = \frac{4GM}{c^2 b}$$

In the simulation, light ray coordinates are updated using a simplified step-wise deflection solver:
$$\mathbf{a}_{\text{deflect}} = -\frac{4GM}{c^2 r^3} \mathbf{r}$$

This enables real-time visual tracing of hundreds of light rays passing near the black hole.

### 2.2 Particle Motion in Kerr Metric (Spin)
For massive particles (dust/spacecraft), the equations of motion are modified to incorporate frame-dragging. We approximate the Lense-Thirring frame-dragging angular velocity $\omega_{\text{drag}}$:

$$\omega_{\text{drag}} = \frac{2GJ}{c^2 r^3} = \frac{2G M a}{c^2 r^3}$$

Where $J$ is the angular momentum of the black hole, and $a = J/M$ is the spin parameter ($0 \le a \le 1$).
The velocity of a particle orbiting the black hole is shifted by the angular velocity of the dragged space:

$$v_{\theta} = v_{\theta, \text{orbital}} + r \omega_{\text{drag}}$$

### 2.3 Schwarzschild Radius & Ergosphere boundaries
* **Event Horizon ($r_H$)**:
  $$r_H = \frac{GM}{c^2} \left(1 + \sqrt{1 - a^2}\right)$$
* **Ergosphere Limit ($r_E$) at the equator**:
  $$r_E = \frac{2GM}{c^2}$$

Any particle crossing $r_H$ is swallowed (removed from simulation). Particles in the ergosphere ($r_H < r < r_E$) are forced to rotate in the direction of the black hole's spin.

---

## 3. Rendering & Visual Effects

* **Deformable Spacetime Grid**: A 3D wireframe grid representing $z = 0$. The grid coordinates $(x, y, z)$ are displaced downward based on mass:
  $$z = -\frac{A \cdot M}{\sqrt{x^2 + y^2 + \epsilon}}$$
  This creates an interactive gravity well that warps dynamically as the player drags the mass slider.
* **Accretion Disk Shader**: A glowing gas disk with Doppler-shifting colors. The side rotating toward the observer is blueshifted (brighter, shifted to blue), and the side rotating away is redshifted (fainter, shifted to red).
* **Einstein Ring Shader**: A post-processing shader that warps background stars around the event horizon using the lensing deflection formula.

---

## 4. Game Mechanics & Missions

### Controls:
* **Mass Slider**: Increase $M$ to increase gravity well depth and deflection.
* **Spin Slider ($a$)**: Adjust the direction and speed of frame dragging.
* **Launch Vector**: Click and drag to fire light beams or dust particles.

### Levels:
1. **Einstein Ring Alignment**: Adjust the mass of the black hole so that a background galaxy lenses perfectly into a circular Einstein Ring surrounding the event horizon.
2. **Ergosphere Slingshot**: Launch a probe into the ergosphere and use frame-dragging to boost its exit velocity beyond its entry speed (the Penrose Process).
3. **Accretion Capture**: Guide 10 loose gas clouds into stable circular orbits within the accretion disk without letting them fall past the event horizon.
