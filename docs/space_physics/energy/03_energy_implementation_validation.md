# Energy Pathway: Computational Implementation and Validation

**Pathway:** Space & Physics → Energy
**Status:** Engineering Reference

---

## 1. Baseline Computational Model

Use a constant-mass particle in one dimension:

$$\dot{x}=v$$

$$\dot{v}=\frac{F(x,v,t)}{m}$$

For a time-independent conservative potential:

$$F(x)=-\frac{dU}{dx}$$

Mechanical energy:

$$E = \frac{1}{2}mv^2 + U(x)$$

## 2. Canonical Force and Potential Presets

```text
free:
    U(x) = 0
    F(x) = 0

uniform_gravity:
    U(y) = m*g*y
    F(y) = -m*g

spring:
    U(x) = 0.5*k*x^2
    F(x) = -k*x

newtonian_gravity_radial:
    U(r) = -G*M*m/r
    F_r(r) = -G*M*m/r^2

damped_spring:
    U(x) = 0.5*k*x^2
    F(x,v) = -k*x - b*v
```

For the damped spring, $K+U$ is not constant. Track dissipated mechanical energy with

$$\frac{dE_{\text{thermal}}}{dt}=b v^2$$

for ideal linear drag $F_{\text{drag}}=-bv$. Then the modeled larger-system total

$$E_{\text{total}}=K+U+E_{\text{thermal}}$$

should remain constant up to numerical error.

## 3. Recommended State Object

```javascript
const state = {
  t: 0,
  x: 0,
  v: 0,
  mass: 1,
  thermalEnergy: 0,
  externalWork: 0,
  potentialId: "spring",
  parameters: {
    k: 1,
    g: 9.81,
    damping: 0
  }
};
```

Derived values should be calculated from this state rather than stored independently:

```javascript
function derive(state, model) {
  const U = model.potential(state.x, state.t, state);
  const F = model.force(state.x, state.v, state.t, state);
  const K = 0.5 * state.mass * state.v * state.v;
  const mechanical = K + U;
  const total = mechanical + state.thermalEnergy;
  const power = F * state.v;

  return { U, F, K, mechanical, total, power };
}
```

This avoids visual disagreement caused by independently updated readouts.

## 4. Potential Interface

```javascript
const potentialModel = {
  id: "spring",
  label: "Ideal spring",
  assumptions: ["constant mass", "one dimension", "Hooke's law"],
  potential(x, t, state) {
    return 0.5 * state.parameters.k * x * x;
  },
  force(x, v, t, state) {
    return -state.parameters.k * x;
  },
  analyticEnergy(state) {
    return 0.5 * state.mass * state.v * state.v
      + 0.5 * state.parameters.k * state.x * state.x;
  }
};
```

For custom drawn potentials, compute force from a smoothed differentiable representation. Avoid taking a raw finite difference of jagged mouse input without smoothing; the resulting force can become visually and numerically unstable.

## 5. Integrators

Minimum supported comparison:

### Forward Euler

$$x_{n+1}=x_n+v_n\Delta t$$

$$v_{n+1}=v_n+a_n\Delta t$$

This is intentionally useful as a failure case for the oscillator. To prevent visual clutter on the comparison graph, the active UI should display at most two solver trajectories side-by-side (e.g., Forward Euler vs. Velocity Verlet), while other methods remain as secondary, optional toggles.

### Euler-Cromer

$$v_{n+1}=v_n+a_n\Delta t$$

$$x_{n+1}=x_n+v_{n+1}\Delta t$$

For the ideal harmonic oscillator, the method is conditionally stable and typically shows bounded energy oscillation for a suitable time step.

### Velocity Verlet

Recommended for the production conservative-motion mode:

$$x_{n+1}=x_n+v_n\Delta t+\frac12a_n\Delta t^2$$

$$a_{n+1}=a(x_{n+1})$$

$$v_{n+1}=v_n+\frac12(a_n+a_{n+1})\Delta t$$

Velocity Verlet is time-reversible for time-independent conservative forces and is well suited to energy-sensitive mechanical simulations.

### RK4

Useful as a general reference method, especially when force depends on velocity or time, but it should not be described as automatically superior for long-term conservative dynamics merely because it has higher local order.

## 6. Analytical Validation Cases

## Test A: Free particle

Initial state: $x(0)=x_0$, $v(0)=v_0$.

Expected:

$$x(t)=x_0+v_0t$$

$$v(t)=v_0$$

$$K(t)=\frac12mv_0^2$$

Acceptance:

- Position error converges toward zero as $\Delta t$ decreases.
- Kinetic energy remains constant to method tolerance.

## Test B: Uniform gravity

Expected:

$$y(t)=y_0+v_0t-\frac12gt^2$$

$$v(t)=v_0-gt$$

$$E = \frac{1}{2}mv^2 + mgy$$

Acceptance:

- Numerical trajectory matches the analytical solution.
- Total mechanical energy remains within tolerance before any boundary collision.

## Test C: Ideal spring

Let

$$\omega=\sqrt{k/m}$$

Expected:

$$x(t)=x_0\cos(\omega t)+\frac{v_0}{\omega}\sin(\omega t)$$

$$v(t)=-x_0\omega\sin(\omega t)+v_0\cos(\omega t)$$

Expected energy:

$$E = \frac{1}{2}mv^2 + \frac{1}{2}kx^2$$

Acceptance:

- Period approaches $2\pi\sqrt{m/k}$.
- Turning points agree with the analytical amplitude.
- Energy-error behavior matches the selected integrator's expected character.

## Test D: Damped spring

Equation:

$$m\ddot{x}+b\dot{x}+kx=0$$

For the underdamped case $b^2 < 4mk$, the envelope decays exponentially.

Acceptance:

- $K+U$ decreases monotonically only in the continuous ideal; small numerical wiggles may occur and must stay below tolerance.
- $K+U+E_{\text{thermal}}$ remains approximately constant.
- $\frac{dE_{\text{thermal}}}{dt}$ is nonnegative for $b \ge 0$.

## Test E: Potential zero shift

Run identical initial states with

$$U_2(x)=U_1(x)+C$$

Acceptance:

- Forces are identical.
- Trajectories are identical.
- $K$ is identical.
- $U$ and $E$ differ by $C$.
- Energy differences and turning points are unchanged.

## Test F: Turning point

Choose a spring state with $x=A$, $v=0$.

Acceptance:

- $K=0$.
- $U=E$.
- $F=-kA$ is nonzero when $A \ne 0$.
- The particle reverses direction after the instant of rest.

## 7. Energy Error Metrics

### Absolute error

$$\Delta E(t)=E(t)-E(0)$$

### Relative error

$$\epsilon_E(t)=\frac{E(t)-E(0)}{\max(|E(0)|,E_{\text{scale}})}$$

Use a nonzero $E_{\text{scale}}$ so a system with initial energy near zero does not produce a meaningless ratio.

### Drift estimate

Fit a line to energy error over a selected interval. Report the slope only in an expert/debug view; beginners need the visible consequence rather than a statistical diagnostic.

## 8. Dimensional Validation

Use SI internally for the introductory page unless a clearly labeled normalized mode is selected.

| Quantity | Unit |
|---|---|
| Position | m |
| Time | s |
| Velocity | m/s |
| Acceleration | m/s^2 |
| Force | N = kg m/s^2 |
| Work/Energy | J = kg m^2/s^2 |
| Power | W = J/s |
| Spring constant | N/m |
| Damping coefficient | kg/s |

Every model function should document expected input and output units.

## 9. Edge Cases

Handle explicitly:

- $m \le 0$: reject as invalid in the classical particle model.
- $k < 0$: allow only in an expert unstable-potential example, clearly labeled.
- Very large $\Delta t$: pause and explain instability instead of drawing unbounded values indefinitely.
- Nonfinite values: stop the simulation and restore the last valid state.
- Custom potential discontinuities: smooth or use a force model designed for discontinuities.
- Particle placed in a classically forbidden state: explain $E < U$ rather than silently generating imaginary speed.
- Boundary collisions: define whether collision energy is elastic, transferred to internal energy, or removed by an absorbing boundary.

## 10. Automated Tests

Recommended unit tests:

```text
potential derivative:
    numerical -dU/dx approximately equals force(x)

zero shift:
    force_U_plus_C equals force_U

free motion:
    v remains constant

spring energy:
    velocity_verlet relative energy error below tolerance

forward euler demonstration:
    oscillator energy grows over repeated steps

damping balance:
    mechanical + thermal approximately constant

turning point:
    v = 0 does not imply F = 0

units and serialization:
    saved state reloads without changing derived energy
```

## 11. Rendering Acceptance Criteria

- The particle, force arrow, velocity arrow, energy bars, and curve marker use one shared state snapshot.
- The total-energy line is visually distinguishable from $K$ and $U$.
- Negative potential values render correctly.
- A shifted zero changes the graph labels but not the motion.
- At turning points the velocity arrow disappears while the force arrow may remain.
- Friction mode never implies that the disappearing mechanical bar is unaccounted for.
- Pausing freezes every representation at the same simulation time.
- Scrubbing backward either recomputes deterministically or clearly identifies replayed recorded states.

## 12. Shared Physics Utilities & Code Reuse

To avoid duplication of integration and rendering math across the Space & Physics pages (e.g., between `particle_1d.html` and the upcoming `energy.html` page), common algorithms should be extracted into shared helper files inside `portfolio/static/js/space_physics/`:

1. **`solvers.js`**: Standardized, modular implementation of numerical solvers (Forward Euler, Euler-Cromer, Velocity Verlet, RK4) that take state objects and force functions.
2. **`canvas_helpers.js`**: Common utilities for high-DPI scaling configuration, viewport/pixel mapping, coordinate grids, and vector arrow drawing functions.

## 13. Performance Guidance

For one-dimensional mechanics, correctness is more important than aggressive optimization.

- Keep physics updates on a fixed simulation step.
- Decouple simulation time from rendering refresh rate.
- Use an accumulator if multiple physics steps are needed per animation frame.
- Limit the maximum steps per frame to prevent a stalled browser from causing a runaway catch-up loop.
- Precompute static potential samples unless the user is actively editing the potential.
- Recalculate plotted energy histories at a lower frequency than the primary motion when needed, while retaining the same timestamped state data.

## 14. Definition of Done for the First Page

The first Energy Exchange page is complete when:

- All displayed equations match the implemented model.
- Free, gravity, and spring presets pass analytical validation.
- The potential-zero invariance test passes.
- The learner can see continuous exchange between $K$ and $U$.
- Total energy stays within the declared numerical tolerance.
- The page names its system and assumptions.
- The page distinguishes energy storage from work transfer.
- The page includes keyboard access, pause, step, and text alternatives.
- The page links forward to potential landscapes and backward to state/evolution.
