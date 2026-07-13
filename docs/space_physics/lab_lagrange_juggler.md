# Technical Specification: Lagrange Point Juggler

**Module:** Space & Physics → Lagrange Point Juggler  
**File:** `docs/space_physics/lab_lagrange_juggler.md` (spec) + Jinja2 template (`lagrange_juggler.html`)  
**Status:** Pre-implementation reference  

---

## 1. Overview & Pedagogical Goals

The **Lagrange Point Juggler** is an interactive, action-oriented orbital mechanics sandbox where players pilot a satellite in a rotating binary system (e.g. Earth-Moon or Sun-Jupiter). The goal is to perform station-keeping maneuvers at Lagrange points, intercept passing space debris, and manage fuel limits.

### What the User Learns:
* **The rotating reference frame** simplifies three-body motion by making the two primary masses appear stationary.
* **Lagrange points** ($L_1$ to $L_5$) are equilibrium points where gravitational pull balances centripetal force.
* **Stability differences**: $L_1$, $L_2$, and $L_3$ are unstable saddle points requiring active station-keeping; $L_4$ and $L_5$ are stable potential wells where Trojan debris naturally aggregates.
* **Coriolis & Centrifugal forces** are fictitious forces that emerge naturally from a rotating coordinate framework.

---

## 2. Physics Engine & Mathematical Formulation

### 2.1 Circular Restricted Three-Body Problem (CRTBP)
We assume two massive bodies (Primaries $M_1$ and $M_2$) move in circular orbits around their common barycenter. The third body (spacecraft, mass $m \ll M_2$) moves in the same plane.

We define normalized units:
* The sum of primary masses is $1$: $M_1 + M_2 = 1$.
* The distance between them is $1$: $R = 1$.
* The gravitational constant is $1$: $G = 1$.
* The orbital period of the primaries is $2\pi$, giving an angular velocity of $\omega = 1$.

Let the mass ratio be:
$$\mu = \frac{M_2}{M_1 + M_2}$$
The mass of $M_1$ is $1 - \mu$, and the mass of $M_2$ is $\mu$.

### 2.2 Equations of Motion in the Rotating Frame
In a reference frame rotating with the primaries, $M_1$ is located at $(-\mu, 0)$ and $M_2$ is located at $(1 - \mu, 0)$. Both remain stationary.

The equations of motion for the spacecraft at position $(x, y)$ are:

$$\ddot{x} - 2\dot{y} = \frac{\partial\Omega}{\partial x}$$
$$\ddot{y} + 2\dot{x} = \frac{\partial\Omega}{\partial y}$$

Where $\Omega(x, y)$ is the effective potential (gravitational + centrifugal potential energy):

$$\Omega(x, y) = \frac{1}{2}(x^2 + y^2) + \frac{1-\mu}{r_1} + \frac{\mu}{r_2}$$

And the distances $r_1$ (to $M_1$) and $r_2$ (to $M_2$) are:
$$r_1 = \sqrt{(x + \mu)^2 + y^2}$$
$$r_2 = \sqrt{(x - 1 + \mu)^2 + y^2}$$

The terms $2\dot{y}$ and $-2\dot{x}$ represent the **Coriolis acceleration** components.

### 2.3 Numerical Integrator: RK4 with Coriolis Injection
The system of first-order ODEs is:
$$\frac{d}{dt} \begin{bmatrix} x \\ y \\ v_x \\ v_y \end{bmatrix} = \begin{bmatrix} v_x \\ v_y \\ 2v_y + x - \frac{(1-\mu)(x+\mu)}{r_1^3} - \frac{\mu(x-1+\mu)}{r_2^3} \\ -2v_x + y - \frac{(1-\mu)y}{r_1^3} - \frac{\mu y}{r_2^3} \end{bmatrix}$$

This state vector is integrated using an **RK4 (Runge-Kutta 4th order)** solver with a step size of $\Delta t = 0.01$ to maintain accuracy under rotating coordinates.

### 2.4 Jacobi Constant (Conservation Check)
The energy quantity conserved in the rotating frame is the **Jacobi Constant** $C$:
$$C = 2\Omega(x, y) - (v_x^2 + v_y^2)$$

If the player does not fire their thrusters, $C$ must remain constant down to $10^{-6}$ precision. Any drift indicates numerical integration error.

---

## 3. Rendering & Visual Overlays

* **Effective Potential Heatmap**: The background displays a real-time topographic height map of $\Omega(x, y)$. Hills (high potential) represent gravity wells around the planets, while saddles highlight $L_1$, $L_2$, and $L_3$.
* **Equipoint Contours (Zero Velocity Curves)**: Overlay contour curves where $2\Omega(x,y) = C$. The spacecraft is energetically forbidden from crossing these boundaries, providing a visual guide of where the ship can drift.
* **Lagrange Point Targets**: Render flashing indicators at the calculated coordinates of the 5 points:
  * **$L_1$, $L_2$, $L_3$**: Rendered as orange warning indicators (unstable saddle points).
  * **$L_4$, $L_5$**: Rendered as green cradle circles (stable potential wells).

---

## 4. Game Mechanics & Missions

### Controls:
* `W/A/S/D`: Apply RCS thrust vectors (100% manual control).
* `Space`: Deploy a tether or collection net to grab space debris.
* `T`: Toggle reference frame between **Inertial Frame** (primaries orbit, trails are spirals) and **Rotating Frame** (primaries stationary, Lagrange points static).

### Levels:
1. **LEO to L1 Station-Keeping**: Launch from a circular orbit around Earth, match velocity at the $L_1$ saddle point, and hold position within a 5 km circle for 30 seconds using minimal fuel.
2. **JWST Deployment (Halo Orbit at L2)**: Navigate to $L_2$ and establish a stable, closed **Halo Orbit** around the point by balancing the Coriolis drift.
3. **Trojan Harvester**: Fly to the stable $L_4$ region. Collect 10 drifting asteroids that have naturally settled into the potential well.
