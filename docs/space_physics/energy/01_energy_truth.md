# Energy Pathway: Physics Truth and Model Context

**Pathway:** Space & Physics → Energy
**Status:** Working Source of Truth
**Scope:** Introductory Classical Mechanics with Bridges to Later Physics

---

## 1. Purpose

This document defines the physics that the Energy pathway is allowed to claim, the assumptions under which those claims are valid, and the connections to later modules.

The first implementation should model a point particle of constant mass moving in one spatial dimension at nonrelativistic speeds. Later sections may generalize the framework, but the introductory simulation should remain explicit about its model.

## 2. System First

Energy statements are incomplete until the system is defined.

For every scenario, identify:

- **System:** the objects and interactions included in the accounting.
- **Surroundings:** everything outside the selected system.
- **Boundary:** the conceptual division across which energy may be transferred.
- **State:** the variables needed to describe the system at one instant.
- **Evolution law:** the rule that determines how the state changes.

For the baseline simulation:

| Item | Baseline choice |
|---|---|
| System | One particle plus any interactions represented by a potential |
| State | Position $x$ and velocity $v$ |
| Parameters | Mass $m$, force-law parameters, potential parameters |
| Evolution | $\frac{dx}{dt} = v$, $\frac{dv}{dt} = \frac{F(x,v,t)}{m}$ |
| Regime | Classical, nonrelativistic, one-dimensional |

A spring potential belongs to the mass-spring interaction or the selected mass-spring system. Gravitational potential energy belongs to an interacting system such as object-Earth, not literally to the object alone.

## 3. Energy as a Conserved Accounting Quantity

Energy is a scalar quantity. It is not a force, a direction, a trajectory, or a material fluid. The useful physical claim is that, for a suitably defined isolated system, the total energy remains constant even while the forms used in the accounting change.

A restricted mechanical model commonly tracks:

$$E_{\text{mech}} = K + U$$

This is not automatically the complete energy of the world. Mechanical energy may decrease while thermal, internal, chemical, radiative, or other energy increases.

## 4. Kinetic Energy

For a classical point particle of constant mass $m$ moving at speed $v$:

$$K = \frac{1}{2}mv^2$$

Properties:

- $K \ge 0$ in this model.
- Kinetic energy depends on speed, not the sign of velocity.
- Kinetic energy is frame-dependent.
- The formula is the nonrelativistic approximation and is not valid near the speed of light.

For multiple particles:

$$K_{\text{total}} = \sum_i \frac{1}{2}m_i v_i^2$$

## 5. Work

The work done by a force along a path is

$$W = \int_C \mathbf{F}\cdot d\mathbf{r}$$

In one dimension:

$$W = \int_{x_i}^{x_f} F(x)\,dx$$

Work is a transfer process, not a stored substance. It describes energy transferred by a force acting through a displacement.

### Work-energy theorem

For a constant-mass classical particle:

$$W_{\text{net}} = \Delta K$$

This theorem follows from Newton's second law and connects force-based and energy-based descriptions of the same motion.

## 6. Potential Energy

A potential-energy function can be introduced for a conservative interaction.

For a conservative force:

$$\Delta U = -W_{\text{cons}}$$

In one dimension:

$$F(x) = -\frac{dU}{dx}$$

The negative sign means the force points toward decreasing potential energy.

### The zero is conventional

Only differences in potential energy affect the classical motion. Replacing

$$U(x) \to U(x) + C$$

with any constant $C$ does not change the force because the derivative of the constant is zero.

A simulation may let the user move the zero-energy reference line. The motion and all energy differences must remain unchanged.

## 7. Conservative Forces

A force is conservative when its work between two positions is independent of the path taken. Equivalent statements in an appropriate simply connected domain include:

- Work around every closed path is zero.
- A scalar potential function exists.
- The force is the negative gradient of the potential.

Common introductory conservative interactions:

- Uniform gravity near Earth's surface.
- Newtonian gravity.
- An ideal Hooke's-law spring.
- Electrostatic interactions in time-independent configurations.

Friction and drag are normally treated as nonconservative within a purely mechanical accounting because their work changes $K + U$ and increases internal or thermal energy elsewhere in the selected larger system.

## 8. Mechanical-Energy Balance

Define

$$E_{\text{mech}} = K + U$$

If the only forces doing work are conservative and the potential has no explicit time dependence:

$$\frac{dE_{\text{mech}}}{dt} = 0$$

With nonconservative work:

$$\Delta E_{\text{mech}} = W_{\text{nc}}$$

For a larger closed system that includes the objects heated by friction, a useful schematic accounting is

$$\Delta K + \Delta U + \Delta E_{\text{internal}} = 0$$

The exact partition depends on the system boundary. The simulation should therefore say **mechanical energy was transferred into internal/thermal energy**, not **energy was destroyed**.

## 9. Power

Power is the rate of energy transfer:

$$P = \frac{dW}{dt}$$

For a force acting on a particle:

$$P = \mathbf{F}\cdot\mathbf{v}$$

In one dimension, $P = Fv$.

Power can be positive, negative, or zero:

- Positive: the force increases the particle's kinetic energy at that instant.
- Negative: the force decreases it.
- Zero: the force is perpendicular to velocity or either force or velocity is zero.

## 10. Canonical Potentials

### 10.1 Free particle

$$U(x)=C, \qquad F=0$$

The velocity and kinetic energy remain constant.

### 10.2 Uniform gravity near Earth

With vertical coordinate $y$ increasing upward:

$$U(y)=mgy + C$$

$$F_y=-mg$$

This is an approximation valid when the height range is small compared with Earth's radius and $g$ can be treated as constant.

### 10.3 Ideal spring

$$U(x)=\frac{1}{2}kx^2 + C$$

$$F(x)=-kx$$

For an undamped oscillator:

$$E = \frac{1}{2}mv^2 + \frac{1}{2}kx^2 = \text{constant}$$

At maximum displacement, $v=0$ and the energy is entirely potential. At equilibrium, $x=0$ and the speed and kinetic energy are maximal.

### 10.4 Newtonian gravitational potential

For masses $M$ and $m$ separated by distance $r$:

$$U(r)=-\frac{GMm}{r}$$

with the conventional choice $U \to 0$ as $r \to \infty$.

The negative value is not an error. It indicates that positive energy must be supplied to separate a bound pair to infinite distance under that reference convention.

## 11. Reading a Potential-Energy Diagram

Given total mechanical energy $E$:

$$K(x)=E-U(x)$$

Because classical kinetic energy cannot be negative:

$$E-U(x)\ge 0$$

Therefore:

- **Allowed region:** $E \ge U(x)$.
- **Forbidden classical region:** $E < U(x)$.
- **Turning point:** $E = U(x)$, so $v=0$ at that instant.

A turning point does **not** imply zero acceleration. The acceleration depends on the slope of the potential:

$$a = \frac{F}{m}=-\frac{1}{m}\frac{dU}{dx}$$

The speed can be reconstructed from the energy:

$$v(x)=\pm\sqrt{\frac{2[E-U(x)]}{m}}$$

The $\pm$ is essential: energy determines speed but does not by itself identify the direction of motion.

## 12. Equilibrium and Stability

An equilibrium position satisfies

$$\frac{dU}{dx}=0$$

For a smooth one-dimensional potential:

- Stable equilibrium: local minimum, usually $\frac{d^2U}{dx^2} > 0$.
- Unstable equilibrium: local maximum, usually $\frac{d^2U}{dx^2} < 0$.
- Higher-order or neutral cases require further analysis when the second derivative is zero.

Near a stable minimum $x_0$, many smooth potentials can be approximated by

$$U(x) \approx U(x_0)+\frac{1}{2}k_{\text{eff}}(x-x_0)^2$$

which explains why harmonic oscillation appears throughout physics.

## 13. Time-Dependent Potentials and External Driving

If the potential depends explicitly on time, $U(x,t)$, then mechanical energy need not remain constant even when the force is written as $F=-\frac{\partial U}{\partial x}$.

For

$$E=\frac{1}{2}mv^2+U(x,t)$$

one obtains

$$\frac{dE}{dt}=\frac{\partial U}{\partial t}$$

when the equation of motion is $m \frac{dv}{dt} = -\frac{\partial U}{\partial x}$.

The changing external parameter transfers energy into or out of the modeled system.

## 14. Energy and Numerical Simulation

A numerical trajectory is not automatically physically faithful merely because it looks smooth.

For a conservative benchmark model, monitor

$$\epsilon_E(t)=\frac{E(t)-E(0)}{\max(|E(0)|,E_{\text{scale}})}$$

Expected qualitative behavior:

- Forward Euler on an undamped harmonic oscillator artificially increases energy and spirals outward.
- Euler-Cromer or another symplectic method generally keeps the energy error bounded for suitable step sizes.
- RK4 often has small short-term error but is not symplectic; long integrations can show systematic energy drift.
- A smaller time step (smaller $\Delta t$) should reduce truncation error within the method's stable regime.

Energy conservation is therefore both a physics concept and a test of the computational model.

## 15. Connections to Existing and Future Modules

### Existing particle and solver page

Energy explains why the spring trajectory closes in phase space and why damping spirals inward. It also provides a measurable diagnostic for solver stability.

### Orbital mechanics

Orbital classification can be expressed through total specific energy:

$$\varepsilon = \frac{v^2}{2}-\frac{\mu}{r}$$

- $\varepsilon < 0$: bound elliptical orbit.
- $\varepsilon = 0$: parabolic escape threshold.
- $\varepsilon > 0$: hyperbolic escape.

Maneuver burns transfer energy and momentum to the spacecraft. The location and direction of a burn determine how efficiently it changes the orbit.

### Oscillations and waves

Energy alternates between kinetic and potential storage in each oscillator and can flow through coupled oscillators. This provides a bridge to wave propagation, normal modes, and Fourier analysis.

### Thermodynamics

Friction does not violate energy conservation. It redirects organized mechanical energy into less macroscopically organized internal energy. A later thermodynamics pathway must add entropy and energy quality; conservation alone does not determine the direction of natural processes.

### Special relativity

The classical kinetic-energy expression must be replaced by

$$K=(\gamma-1)mc^2$$

Energy and momentum form a relativistic four-vector, and different inertial observers generally assign different energies to the same system while agreeing on invariant relationships.

### Quantum mechanics

A potential-energy curve enters the Hamiltonian, but a quantum particle is not assigned one classical trajectory with $K=E-U$ at every instant. Regions with $E<U$ are classically forbidden yet may contain nonzero wavefunction amplitude. Tunneling does not mean the particle loses energy while crossing the barrier in a time-independent potential.

### Cosmology

Cosmological dynamics depend on matter, radiation, curvature, and dark-energy densities. Global energy conservation in an expanding curved spacetime is subtler than conservation in a time-independent Newtonian system and should not be casually inferred from the introductory mechanical model.

## 16. Claims the Introductory Page Should Avoid

Do not claim that:

- Energy is a physical fluid or material substance.
- Potential energy belongs unambiguously to one isolated object.
- Mechanical energy is always conserved.
- Friction destroys energy.
- Zero potential energy is an observable physical location.
- A turning point has zero force or acceleration.
- Energy alone determines the full state or direction of motion.
- Classical forbidden regions are impossible in quantum mechanics.
- The Newtonian energy formulas remain exact at relativistic speeds.

## 17. Minimal Truth Checklist

Before publishing an energy interaction, verify that it:

- Defines the system and surroundings.
- States the model assumptions.
- Separates stored energy from energy transfer.
- Distinguishes mechanical energy from total energy.
- Treats potential-energy zero as conventional.
- Associates potential energy with an interaction or system.
- Shows where nonconservative work goes.
- Uses energy as a scalar.
- States the limits of classical formulas.
- Includes at least one quantitative conservation or balance check.
