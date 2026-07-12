# Technical Specification: Quantum Mechanics Wavefunction Sandbox Lab

**Project:** JonsLane Space Physics — Interactive Lab Series  
**Document Version:** 1.0  
**Date:** 2026-07-12  
**Status:** Authoritative Design Document  
**Target Stack:** HTML5 + Vanilla CSS + JavaScript (2D Canvas) + optional WebAssembly  
**Minimum Lines of Spec Content:** 450+

---

## Table of Contents

1. [Overview & Pedagogical Goals](#1-overview--pedagogical-goals)
2. [Physics Engine — Full Mathematical Specification](#2-physics-engine--full-mathematical-specification)
   - 2.1 Time-Dependent Schrödinger Equation
   - 2.2 Split-Operator Method
   - 2.3 Discrete Grid Parameters
   - 2.4 FFT-Based Kinetic Energy Propagator
   - 2.5 Potential Energy Propagator
   - 2.6 Absorbing Boundary Conditions
   - 2.7 Normalization
   - 2.8 Initial Gaussian Wavepacket
   - 2.9 Tunneling Probability
   - 2.10 Energy Eigenstates via Imaginary-Time Evolution
   - 2.11 Uncertainty Principle Live Calculation
   - 2.12 Measurement Collapse Simulation
   - 2.13 Superposition and Quantum Beats
3. [Potential Well Drawing System](#3-potential-well-drawing-system)
4. [Interactive Experiments — Chapter Breakdown](#4-interactive-experiments--chapter-breakdown)
5. [Rendering Design](#5-rendering-design)
6. [Performance & Numerical Accuracy](#6-performance--numerical-accuracy)
7. [Dependencies & Technical Requirements](#7-dependencies--technical-requirements)
8. [Integration with Existing Flask/Jinja2 Site Structure](#8-integration-with-existing-flaskjinja2-site-structure)

---

## 1. Overview & Pedagogical Goals

### 1.1 What the User Learns

The Quantum Wavefunction Sandbox teaches the following core concepts of introductory quantum mechanics, in a discovery-first rather than lecture-first sequence:

| Concept | Discovery Method |
|---|---|
| Wavefunction as probability amplitude | Watch psi spread in free space; see |psi|^2 define where the particle "is" |
| Wave-particle duality | Same object shows interference AND localization |
| Uncertainty principle | Live Delta_x * Delta_p readout approaches hbar/2 for minimum-uncertainty packets |
| Tunneling | Draw a barrier; see partial transmission even at E < V |
| Quantization | Energy levels appear naturally from boundary conditions |
| Superposition | Add two eigenstates; probability density oscillates at the Bohr frequency |
| Measurement and collapse | Press 'Measure'; psi becomes a narrow spike; repeat many times |
| Coherent states | Harmonic oscillator coherent state moves classically without spreading |

### 1.2 Why Wavefunction Dynamics Cannot Be Taught Statically

Static diagrams of wavefunctions — the kind found in textbooks — show snapshots of standing waves. They give students a frozen, incorrect mental model that:

- Implies psi is always real-valued (wrong: psi is complex)
- Implies wavefunctions sit still inside their potential wells (wrong: eigenstates oscillate as e^{-iE_n t/hbar}; only |psi|^2 is stationary)
- Cannot convey how a wavepacket spreads over time — the defining consequence of quantum mechanics
- Cannot show tunneling as a real-time process (the evanescent tail penetrating the barrier)
- Cannot show wavefunction collapse as a probabilistic event whose statistics build up over many measurements

None of these can be learned from a still image. They require animation, interactivity, and the user's ability to set up their own experiments.

### 1.3 Discovery-First Design Philosophy

The lab is structured so that the user encounters phenomena **before** the explanation. Each chapter:
1. Gives the user a control (draw a wall, fire a packet, press Measure)
2. Lets them observe an unexpected result
3. Then provides a collapsible "Why does this happen?" panel with the equation

This is modeled on guided discovery learning (GDL), which consistently outperforms passive instruction for abstract mathematical concepts.

### 1.4 What Makes This Lab Unique on the Web

Existing quantum simulators (e.g., PhET's "Quantum Tunneling and Wave Packets") are Flash-era or suffer from:
- No potential drawing — user cannot modify the well interactively
- No phase visualization (most show only |psi|^2, losing the complex nature of psi)
- No live uncertainty readout
- No imaginary-time eigenstate solver
- No measurement collapse demonstration
- No momentum-space panel

This lab provides **all of the above** in a modern, responsive, zero-dependency (CDN-only) web implementation running at 60 fps.

---

## 2. Physics Engine — Full Mathematical Specification

All quantities are in **natural (Hartree atomic) units** unless otherwise noted:
- hbar = 1
- m = 1 (electron mass)
- Energy in Hartree (E_h), length in Bohr radii (a_0)
- Time in hbar/E_h ~= 24.2 as

This choice simplifies every formula below. The UI can display rescaled values for the user.

### 2.1 Time-Dependent Schrodinger Equation (TDSE)

The single-particle 1D TDSE in position space:

```
i * hbar * d(psi)/dt = H * psi = [ -(hbar^2 / 2m) * d^2/dx^2 + V(x) ] * psi(x,t)
```

In atomic units (hbar = 1, m = 1):

```
i * d(psi)/dt = H * psi = [ -(1/2) * d^2/dx^2 + V(x) ] * psi
```

The formal solution is:

```
psi(x, t + dt) = exp(-i * H * dt) * psi(x, t)
```

The operator `exp(-i*H*dt)` is the **time evolution operator** U(dt). It is **unitary** (U_dag * U = 1), which means it preserves norm exactly. The challenge is evaluating it numerically when `T = -(1/2) * d^2/dx^2` and `V = V(x)` do not commute.

### 2.2 Split-Operator (Split-Step Fourier) Method

#### 2.2.1 Why the Operators Don't Commute

Because `[T, V] != 0` in general, we cannot write:

```
exp(-i*(T+V)*dt) = exp(-i*T*dt) * exp(-i*V*dt)
```

This naive splitting introduces an error of order dt^2 per step (first-order method). The **symmetric Trotter-Suzuki decomposition** gives second-order accuracy:

```
exp(-i*(T+V)*dt) = exp(-i*V*dt/2) * exp(-i*T*dt) * exp(-i*V*dt/2)  +  O(dt^3)
```

The error per step is O(dt^3); over a fixed total time T = N_t * dt the accumulated error is O(dt^2), making this a **second-order method**. The method is **unconditionally stable** because each factor is a pure phase (unitary operator), so norms cannot grow.

#### 2.2.2 Why Each Factor Is Diagonal in a Different Basis

- `exp(-i*V*dt/2)` is **diagonal in position space**: V(x) is a multiplication operator, so `(exp(-i*V*dt/2) * psi)(x) = exp(-i*V(x)*dt/2) * psi(x)`. Apply pointwise.
- `exp(-i*T*dt)` is **diagonal in momentum space**: T in Fourier space is `k^2/2` (multiplication), so `(exp(-i*T*dt) * psi_tilde)(k) = exp(-i*k^2*dt/2) * psi_tilde(k)`. Apply pointwise.

The strategy: alternate between real and Fourier space using FFT.

#### 2.2.3 Full Derivation of One Time Step

Starting from `psi_n = psi(x, t_n)`:

**Step A** — Half-step potential kick (position space):

```
psi_A(x_j) = exp(-i * V(x_j) * dt/2) * psi_n(x_j)    for all j
```

**Step B** — Fourier transform to momentum space:

```
phi_A(k_m) = FFT{ psi_A }(k_m)
```

**Step C** — Full-step kinetic kick (momentum space):

```
phi_B(k_m) = exp(-i * k_m^2 * dt/2) * phi_A(k_m)
```

**Step D** — Inverse Fourier transform back to position space:

```
psi_B(x_j) = IFFT{ phi_B }(x_j)
```

**Step E** — Second half-step potential kick (position space):

```
psi_{n+1}(x_j) = exp(-i * V(x_j) * dt/2) * psi_B(x_j)
```

The factor `exp(-i * k_m^2 * dt/2)` comes from the kinetic operator: in momentum space, `p_hat = hbar * k`, so `T_hat = p_hat^2 / (2m) = k^2/2` (in atomic units).

> **WARNING — FFT Ordering:** The DFT of an array of length N returns frequencies in the order `[0, 1, 2, ..., N/2-1, -N/2, ..., -1]`. The kinetic phase factor must use these **signed** frequencies, not the raw indices. Failing to handle this correctly produces a completely wrong time evolution (high-frequency components evolve backward). Use `fftshift` or equivalently compute `k_m = 2*pi*m / (N*dx)` for `m = 0, 1, ..., N/2-1`, and `k_m = 2*pi*(m-N) / (N*dx)` for `m = N/2, ..., N-1`.

#### 2.2.4 Pseudocode — Split-Operator Time Step

```javascript
function splitOperatorStep(psi_re, psi_im, V, kineticPhase, potPhaseHalf, dt) {
    // psi_re[j], psi_im[j]  : real and imaginary parts of psi at grid points
    // V[j]                  : potential at grid points
    // potPhaseHalf[j]       : precomputed exp(-i * V[j] * dt/2)
    // kineticPhase[m]       : precomputed exp(-i * k[m]^2 * dt/2)
    // All arrays length N

    // Step A: half-step potential kick
    for j in 0..N-1:
        re = psi_re[j]
        im = psi_im[j]
        cos_v = potPhaseHalf[j].re    // = cos(-V[j]*dt/2)
        sin_v = potPhaseHalf[j].im    // = sin(-V[j]*dt/2)
        psi_re[j] = re * cos_v - im * sin_v
        psi_im[j] = re * sin_v + im * cos_v

    // Step B: FFT to momentum space
    [phi_re, phi_im] = FFT(psi_re, psi_im)   // complex FFT, length N

    // Step C: full-step kinetic kick
    for m in 0..N-1:
        re = phi_re[m]
        im = phi_im[m]
        cos_k = kineticPhase[m].re    // = cos(-k[m]^2*dt/2)
        sin_k = kineticPhase[m].im    // = sin(-k[m]^2*dt/2)
        phi_re[m] = re * cos_k - im * sin_k
        phi_im[m] = re * sin_k + im * cos_k

    // Step D: IFFT back to position space
    [psi_re, psi_im] = IFFT(phi_re, phi_im)  // must divide by N (or use normalized FFT)

    // Step E: second half-step potential kick
    for j in 0..N-1:
        re = psi_re[j]
        im = psi_im[j]
        cos_v = potPhaseHalf[j].re
        sin_v = potPhaseHalf[j].im
        psi_re[j] = re * cos_v - im * sin_v
        psi_im[j] = re * sin_v + im * cos_v

    return [psi_re, psi_im]
}
```

**Performance note:** Precompute `potPhaseHalf` and `kineticPhase` once at initialization (and whenever V or dt changes). These are the most expensive per-step computations if done naively inside the loop.

#### 2.2.5 Accuracy Summary

| Property | Split-Operator Value |
|---|---|
| Global time error | O(dt^2) |
| Norm conservation | Exact (machine precision) |
| Energy conservation | Approximate (oscillates around true E) |
| Probability current | Exactly conserved across any interface |
| Stability | Unconditional (no CFL condition) |

### 2.3 Discrete Grid Parameters

The simulation lives on a uniform 1D grid:

```
x_j = x_min + j * dx,    j = 0, 1, ..., N-1
```

**Choosing N:** Use `N = 512` for real-time at 60 fps. Use `N = 1024` for higher spatial resolution (30-60 fps depending on device). N must be a power of 2 for the Cooley-Tukey FFT.

**Choosing dx:** The spatial resolution must resolve the de Broglie wavelength:

```
dx <= lambda_min / 8 = pi / (4 * k_max)
```

Where `k_max` is the highest wavenumber in the initial wavepacket. For a Gaussian packet with spread `sigma_k`, take `k_max = k0 + 4*sigma_k`.

> **WARNING — Aliasing:** If the wavepacket acquires momentum components with `|k| > pi/dx` (the Nyquist wavenumber), those components alias and corrupt the simulation. The absorbing boundaries (Section 2.6) prevent this by dampening high-momentum components before they reflect.

**Choosing dt:** The split-operator method is unconditionally stable. However, **accuracy** requires:

```
dt << 1 / E_max
```

where `E_max = V_max + k_max^2 / 2` is the maximum energy in the system. A safe choice is:

```
dt <= 0.1 / E_max
```

For typical parameters (`V_max ~= 10 E_h`, `k_max ~= 5 a0^{-1}`): `E_max ~= 22.5 E_h`, so `dt <= 0.004 hbar/E_h`.

**Typical default parameters:**

| Parameter | Default Value |
|---|---|
| N | 512 |
| x_min | -50 a_0 |
| x_max | +50 a_0 |
| dx | 100/512 ~= 0.195 a_0 |
| dt | 0.005 hbar/E_h |
| Steps per frame | 10 |

Running 10 TDSE steps per animation frame at 60 fps gives a simulated time rate of ~3 hbar/E_h per second of wall time.

### 2.4 FFT-Based Kinetic Energy Propagator

The Fourier-space wavenumber grid is:

```
k_m = (2*pi / (N*dx)) * m           for 0 <= m < N/2
k_m = (2*pi / (N*dx)) * (m - N)     for N/2 <= m < N
```

This gives frequencies from `-pi/dx` to `+pi/dx` (the Nyquist range).

The kinetic energy at mode m is:

```
E_kin(m) = k_m^2 / 2
```

The kinetic propagator (precomputed, stored as complex exponential):

```
U_T(m) = exp(-i * k_m^2 * dt/2)
```

**Implementation — precompute at startup:**
```javascript
function precomputeKineticPhase(N, dx, dt) {
    const kineticPhase = new Array(N);
    for (let m = 0; m < N; m++) {
        const k = (m < N/2)
            ? (2 * Math.PI * m) / (N * dx)
            : (2 * Math.PI * (m - N)) / (N * dx);
        const phi = -0.5 * k * k * dt;   // -k^2 * dt/2 (full kinetic step)
        kineticPhase[m] = { re: Math.cos(phi), im: Math.sin(phi) };
    }
    return kineticPhase;
}
```

> **WARNING — IFFT Normalization:** Most FFT implementations require dividing the IFFT output by N. If you use `fft.js`, the `transform` / `inverseTransform` pair handles this. If you use a custom Cooley-Tukey, ensure the IFFT includes the 1/N factor. Missing this causes the wavefunction amplitude to grow by a factor of N per step.

### 2.5 Potential Energy Propagator

In position space, the potential acts as a multiplication operator. The half-step potential phase (precomputed whenever V changes):

```
U_V(j) = exp(-i * V(x_j) * dt/2)
```

**Implementation:**
```javascript
function precomputePotPhase(V, dt) {
    const potPhase = new Array(V.length);
    for (let j = 0; j < V.length; j++) {
        const phi = -V[j] * dt / 2;
        potPhase[j] = { re: Math.cos(phi), im: Math.sin(phi) };
    }
    return potPhase;
}
```

When the user draws a new potential (Section 3), this function is called immediately to regenerate `potPhase` before the next step.

### 2.6 Absorbing Boundary Conditions (Complex Absorbing Potential)

Without boundary treatment, the wavepacket reflects off the grid edges and re-enters the simulation domain. To absorb outgoing waves, add an imaginary potential in two absorbing layers of width `L_abs` at each end:

```
V_abs(x) = -i * eta(x)
```

where `eta(x) >= 0` is a smooth mask function. The total potential used in the propagator is:

```
V_eff(x) = V(x) - i * eta(x)
```

**Recommended form for eta:**

```
eta(x_j) = eta_max * (j / N_abs)^2              for j < N_abs
eta(x_j) = 0                                     for N_abs <= j <= N-1-N_abs
eta(x_j) = eta_max * ((N-1-j) / N_abs)^2        for j > N-1-N_abs
```

Where:
- `N_abs = round(0.1 * N)` — absorbing layer is 10% of grid at each side
- `eta_max = 0.05 E_h` — absorption strength (tune if reflections visible)

**Effect on the propagator:** The half-step phase factor becomes:

```
U_V_eff(j) = exp(-i*(V(x_j) - i*eta(x_j))*dt/2)
           = exp(-i*V(x_j)*dt/2) * exp(-eta(x_j)*dt/2)
```

The second factor `exp(-eta*dt/2) <= 1` damps the wavefunction in the absorbing region. The norm is no longer conserved (absorbed probability is lost), which is intentional.

> **WARNING — Norm Loss vs. Physical Tunneling:** When an absorbing boundary is active, the norm drop gives the **absorbed probability** (probability that the particle escaped through that boundary). This can be repurposed to calculate tunneling transmission probability (Section 2.9). However, if absorption is too strong (`eta_max` too large), it creates reflections of its own (the opposite problem). The quadratic ramp above is a good compromise; see Manolopoulos (2002) for optimal CAP design.

### 2.7 Normalization

The wavefunction must satisfy the normalization condition:

```
integral |psi(x)|^2 dx = 1
```

On the discrete grid this becomes:

```
||psi||^2 = dx * sum_j |psi(x_j)|^2
           = dx * sum_j [ psi_re(x_j)^2 + psi_im(x_j)^2 ] = 1
```

**Renormalization implementation:**
```javascript
function renormalize(psi_re, psi_im, dx) {
    let norm2 = 0;
    for (let j = 0; j < psi_re.length; j++) {
        norm2 += psi_re[j] * psi_re[j] + psi_im[j] * psi_im[j];
    }
    norm2 *= dx;
    const inv = 1.0 / Math.sqrt(norm2);
    for (let j = 0; j < psi_re.length; j++) {
        psi_re[j] *= inv;
        psi_im[j] *= inv;
    }
}
```

**When to renormalize:**
- **Imaginary-time evolution** (Section 2.10): renormalize after every step, because imaginary time is not unitary.
- **Real-time split-operator**: renormalize every ~100 steps as a floating-point sanity check. The split-operator is theoretically exact-norm, but accumulated rounding error is typically < 1e-10 per step.
- **After measurement collapse** (Section 2.12): always renormalize the collapsed state.
- **Never renormalize mid-chapter during absorbing-boundary simulations** — norm loss is physically meaningful (it measures escaping probability).

### 2.8 Initial Gaussian Wavepacket

The canonical minimum-uncertainty Gaussian wavepacket centered at `x0` with momentum `k0` and position spread `sigma`:

```
psi(x, 0) = (1 / (2*pi*sigma^2))^(1/4) * exp( -(x-x0)^2/(4*sigma^2) + i*k0*(x-x0) )
```

This satisfies:
- `<x> = x0`
- `<p> = hbar*k0 = k0` (atomic units)
- `Delta_x = sigma`
- `Delta_p = 1 / (2*sigma)`
- `Delta_x * Delta_p = hbar/2` — exactly saturates the uncertainty bound

**Time evolution in free space:** The position spread grows as:

```
sigma(t) = sigma * sqrt( 1 + (t / (2*sigma^2))^2 )
```

This **wavepacket spreading** is one of the first things the user observes in Chapter 1.

**Implementation:**
```javascript
function initGaussianWavepacket(x, x0, k0, sigma) {
    const N = x.length;
    const norm = Math.pow(1.0 / (2 * Math.PI * sigma * sigma), 0.25);
    const psi_re = new Float64Array(N);
    const psi_im = new Float64Array(N);
    let sumSq = 0;
    for (let j = 0; j < N; j++) {
        const dx = x[j] - x0;
        const gauss = norm * Math.exp(-dx * dx / (4 * sigma * sigma));
        psi_re[j] = gauss * Math.cos(k0 * dx);
        psi_im[j] = gauss * Math.sin(k0 * dx);
        sumSq += psi_re[j] ** 2 + psi_im[j] ** 2;
    }
    // Discrete renormalization for exact grid normalization
    const scale = 1.0 / Math.sqrt(sumSq * (x[1] - x[0]));
    for (let j = 0; j < N; j++) {
        psi_re[j] *= scale;
        psi_im[j] *= scale;
    }
    return [psi_re, psi_im];
}
```

**User-adjustable parameters (sliders):**
- `x0`: initial position (restricted to non-barrier region)
- `k0`: initial momentum / group velocity
- `sigma`: initial spread (wider -> more localized in momentum; narrower -> more localized in position)

### 2.9 Tunneling Probability

For a wavepacket incident on a potential barrier occupying `[x_a, x_b]`, define the transmitted and reflected probabilities at time t (after the packet has fully separated):

```
T(t) = dx * sum_{j: x_j > x_b} |psi(x_j, t)|^2

R(t) = dx * sum_{j: x_j < x_a} |psi(x_j, t)|^2

T + R = 1    (if no absorbing boundaries in the domain)
```

With absorbing boundaries, instead track norm loss on the right side:

```
T = norm_lost_in_right_absorber / total_initial_norm
  = 1 - ||psi(t_final)||^2 - R_left
```

**For a rectangular barrier** of width d and height V0 with incident energy `E = k0^2/2`:

```
T_exact = [ 1 + (k0^2 - kappa^2)^2 * sinh^2(kappa*d) / (4 * k0^2 * kappa^2) ]^{-1}

kappa = sqrt(2*(V0 - E))      (for E < V0, classically forbidden)
```

Display both the **numerical** T from the simulation and the **analytical** T_exact for comparison. Agreement to better than 1% validates the solver.

### 2.10 Energy Eigenstates via Imaginary-Time Evolution

To find the n-th energy eigenstate, use **imaginary-time evolution (ITE)**:

Replace `t -> -i*tau` in the TDSE. The evolution operator becomes:

```
exp(-H * tau)
```

Under repeated application, the component of any trial state `psi_trial` along eigenstate `phi_n` is damped by `exp(-E_n * tau)`. After sufficient imaginary time, the state exponentially converges to the lowest eigenstate:

```
psi(tau) ~ exp(-E0*tau)*phi_0 + exp(-E1*tau)*phi_1 + ...  ->  phi_0   (as tau -> infinity)
```

**Imaginary-time split-operator step:**

Replace `dt -> -i*dtau` in the propagator:
- Potential factor: `exp(-i*V(x_j)*(-i*dtau)/2) = exp(-V(x_j)*dtau/2)` — **real, no oscillation**
- Kinetic factor: `exp(-i*k_m^2*(-i*dtau)/2) = exp(-k_m^2*dtau/2)` — **real Gaussian in k-space**

This is equivalent to applying a low-pass filter and a smooth real damping. The state always stays real and positive for the ground state.

**Algorithm for finding the ground state:**
```
Initialize psi = random real array (or broad Gaussian)
Renormalize psi

Repeat until convergence:
    Apply half-step V damping:   psi[j] *= exp(-V[j] * dtau / 2)
    FFT psi to k-space:          phi = FFT(psi)
    Apply kinetic damping:       phi[m] *= exp(-k[m]^2 * dtau / 2)
    IFFT phi back:               psi = IFFT(phi)
    Apply half-step V damping:   psi[j] *= exp(-V[j] * dtau / 2)
    Renormalize psi              <-- CRITICAL: must renormalize every step
    Compute energy E0 = <psi|H|psi>
    Check convergence: |E0_new - E0_old| < tolerance
```

**Finding higher eigenstates:** Use Gram-Schmidt orthogonalization. After finding `phi_0, phi_1, ..., phi_{n-1}`, start a new ITE run with orthogonality enforced at each step:

```javascript
// Project out all lower eigenstates after each ITE step:
for (let k = 0; k < n; k++) {
    let overlap = 0;
    for (let j = 0; j < N; j++) overlap += phi_k[j] * psi[j];
    overlap *= dx;
    for (let j = 0; j < N; j++) psi[j] -= overlap * phi_k[j];
}
renormalize(psi_re, psi_im, dx);
```

This reliably finds the first 6-8 eigenstates for smooth potentials.

**Energy expectation value — computed in Fourier space for accuracy:**
```
E = dx * sum_m (k_m^2/2) * |phi_tilde(k_m)|^2
  + dx * sum_j V(x_j) * |psi(x_j)|^2
```

> **WARNING — ITE with Complex Absorbing Potential:** Disable the CAP during imaginary-time evolution. The imaginary part of the CAP causes the eigenstate solver to converge to a non-physical absorbed state rather than a true bound eigenstate.

### 2.11 Uncertainty Principle Live Calculation

From the wavefunction at each frame, compute:

```
<x>   = dx * sum_j  x_j * |psi(x_j)|^2
<x^2> = dx * sum_j  x_j^2 * |psi(x_j)|^2

Delta_x = sqrt(<x^2> - <x>^2)
```

For momentum, use the Fourier representation:

```
<p>   = dx * sum_m  k_m * |phi_tilde(k_m)|^2
<p^2> = dx * sum_m  k_m^2 * |phi_tilde(k_m)|^2

Delta_p = sqrt(<p^2> - <p>^2)
```

Note: the FFT must be recomputed for every frame that shows the uncertainty readout (adds ~N log N operations, negligible at N=512).

**Display format:**
```
Delta_x  = 3.47 a_0
Delta_p  = 0.144 hbar/a_0
Delta_x * Delta_p = 0.500 hbar   [min: 0.500 hbar]
```

Draw a horizontal reference line at `Delta_x * Delta_p = hbar/2 = 0.5` in the scatter display.

### 2.12 Measurement Collapse Simulation

Simulating a position measurement:

1. Compute probability density: `P(x_j) = |psi(x_j)|^2 * dx` (normalized histogram)

2. Sample a random position `x_meas` from this distribution using inverse CDF sampling:
   - Build CDF: `C_j = sum_{k=0}^{j} P(x_k)`
   - Draw `u ~ Uniform[0,1]`
   - Find `j*` such that `C_{j*-1} <= u < C_{j*}`, set `x_meas = x_{j*}`

3. Collapse to a narrow Gaussian centered at `x_meas`:
   ```
   psi_collapsed(x) = (1/(2*pi*sigma_m^2))^(1/4) * exp(-(x - x_meas)^2 / (4*sigma_m^2))
   ```
   Where `sigma_m ~= 2*dx` is the post-measurement spatial resolution. The collapsed state has **no momentum** — a pure position eigenstate approximation.

4. Renormalize `psi_collapsed` and continue evolution.

**Statistical display:** After M measurements, plot a histogram of measured positions `{x_meas_1, ..., x_meas_M}`. Overlay the theoretical `|psi|^2` curve. After ~30 measurements, convergence to `|psi|^2` is visually convincing.

> **WARNING — Collapse and Evolution:** After collapse, the narrow spike immediately begins spreading again (because a narrow Gaussian has wide momentum spread, `Delta_p = 1/(2*sigma_m)`). The user must press "Measure" again before the state spreads significantly if they want to record a definite position. This is intentional pedagogy — it demonstrates that quantum states do not persist after measurement.

### 2.13 Superposition and Quantum Beats

Given two energy eigenstates `phi_n` and `phi_m` with energies `E_n` and `E_m`, form the superposition:

```
psi(x, t) = c_n * exp(-i*E_n*t) * phi_n(x) + c_m * exp(-i*E_m*t) * phi_m(x)
```

Where `|c_n|^2 + |c_m|^2 = 1`. The probability density is:

```
|psi(x,t)|^2 = |c_n|^2 * |phi_n|^2  +  |c_m|^2 * |phi_m|^2
               + 2 * Re[ c_n* * c_m * exp(-i*(E_m-E_n)*t) * phi_n*(x) * phi_m(x) ]
```

The interference term oscillates at the **Bohr frequency**:

```
omega_nm = (E_m - E_n) / hbar = E_m - E_n    (atomic units)
```

The **period of quantum beats** is:

```
T_beat = 2*pi / omega_nm = 2*pi / (E_m - E_n)
```

**Implementation note:** Rather than tracking coefficients analytically, let the TDSE evolve the combined state. Initialize:

```javascript
// Mix eigenstates with user-specified amplitude ratio
const angle = sliderValue * Math.PI / 2;  // 0 -> pure phi_n, pi/2 -> pure phi_m
const c_n = Math.cos(angle);
const c_m = Math.sin(angle);
for (let j = 0; j < N; j++) {
    psi_re[j] = c_n * phi_n_re[j] + c_m * phi_m_re[j];
    psi_im[j] = c_n * phi_n_im[j] + c_m * phi_m_im[j];
}
renormalize(psi_re, psi_im, dx);
```

The TDSE solver then naturally produces the quantum beats without any additional code.

---

## 3. Potential Well Drawing System

### 3.1 Mouse-Draw Interface

The canvas shows the potential V(x) as a filled colored region. The user can left-click-drag to draw custom barrier shapes.

**Coordinate mapping:**

```javascript
function mouseToGrid(mouseX, mouseY, canvas, N, V_max) {
    const j = Math.floor((mouseX / canvas.width) * N);
    const v = V_max - (mouseY / canvas.height) * V_max;
    return { j: Math.max(0, Math.min(N - 1, j)), v: Math.max(0, v) };
}
```

On `mousemove` with button pressed, interpolate between the last and current grid index to prevent gaps when the mouse moves fast:

```javascript
function drawPotentialSegment(j_start, v_start, j_end, v_end) {
    const steps = Math.abs(j_end - j_start) + 1;
    for (let s = 0; s <= steps; s++) {
        const t = steps > 0 ? s / steps : 0;
        const j = Math.round(j_start + t * (j_end - j_start));
        const v = v_start + t * (v_end - v_start);
        V_user[j] = Math.max(0, v);
    }
    applySmoothing();          // see Section 3.3
    precomputePotPhase(V_eff, dt);   // update propagator
}
```

**Right-click drag erases** (sets `V[j] = 0` in the dragged region).

**Controls:**
- Toolbar button "Draw Barrier" / "Erase"
- Scrollwheel over canvas adjusts barrier height under cursor
- "Clear All" button resets V to zero everywhere

### 3.2 Preset Potentials

Each preset fills the V[j] array analytically and calls `applySmoothing()` + `precomputePotPhase()`.

#### 3.2.1 Infinite Square Well

```
V(x) = 0          for |x| < a
V(x) = V_inf      for |x| >= a
```

Use `V_inf = 1000 E_h` to approximate the infinite wall. Exact energy levels:

```
E_n = n^2 * pi^2 / (2*(2a)^2),    n = 1, 2, 3, ...
```

#### 3.2.2 Harmonic Oscillator

```
V(x) = (1/2) * k * (x - x_c)^2 = (1/2) * omega^2 * (x - x_c)^2   (atomic units, m=1)
```

Default: `omega = 0.5`, `x_c = 0`. Exact energy levels:

```
E_n = omega * (n + 1/2),    n = 0, 1, 2, ...
```

**Coherent state:** An initial Gaussian centered at `x_c + A` (amplitude A) with `k0 = 0` is a coherent state. It oscillates classically with period `T = 2*pi/omega` without spreading — an exact quantum mechanical result unique to the harmonic oscillator.

#### 3.2.3 Double Well

```
V(x) = a * (x^2 - b^2)^2
```

where `a` controls barrier height and `b` is the well separation. Default: `a = 0.01`, `b = 10`. The barrier height is `V_barrier = a*b^4`.

#### 3.2.4 Step Potential

```
V(x) = 0      for x < 0
V(x) = V0     for x >= 0
```

Interesting for demonstrating partial reflection even when `E > V0` (quantum reflection).

#### 3.2.5 Delta Function Approximation

```
V[j_c] = V0 / dx      (one grid point only)
V[j]   = 0            (all other j)
```

This approximates `V0 * delta(x - x_c)`. The factor `1/dx` ensures the integral `integral V dx = V0` regardless of grid spacing. **Do not smooth this preset** — smoothing a delta function makes it a narrow Gaussian and loses its singular character.

> **WARNING — Delta Function Grid Dependence:** The delta potential's physics (bound state energy, transmission) does depend on grid resolution. Explicitly note this in the UI tooltip: "Delta-function is grid-resolution dependent. Increase N for more accurate results."

#### 3.2.6 Kronig-Penney (Periodic Potential)

```
V(x) = V0   if (x - x_min) mod a < d
V(x) = 0    otherwise
```

where `a` is the lattice period and `d < a` is the barrier width. This creates energy band gaps. The user can observe Bloch-wave-like wavepacket propagation and forbidden momentum bands.

**Implementation:**
```javascript
for (let j = 0; j < N; j++) {
    const xMod = ((x[j] - x_min) % lattice_period + lattice_period) % lattice_period;
    V[j] = (xMod < barrier_width) ? V0 : 0;
}
```

### 3.3 Smoothing — Gaussian Kernel Convolution

Raw mouse-drawn potentials have sharp corners that create numerical ringing. Apply a Gaussian smoothing kernel of width `sigma_s = 2*dx`:

```
V_smooth(x_j) = sum_{k=-K}^{K} V(x_{j+k}) * g_k  /  sum_{k=-K}^{K} g_k

g_k = exp(-k^2 * dx^2 / (2 * sigma_s^2))

K = ceil(3 * sigma_s / dx)
```

**When not to smooth:**
- Delta function preset (Section 3.2.5)
- Infinite square well walls (smoothing the walls introduces leakage artifacts)

### 3.4 Energy Level Overlay

After computing eigenstates via ITE (Section 2.10), draw horizontal dashed lines at each `E_n` on the potential canvas:

```
For each eigenstate phi_n with energy E_n:
    Find j_left, j_right such that V[j] < E_n  (classically allowed region)
    y_canvas = canvas_height - (E_n - V_min) / (V_max - V_min) * canvas_height
    Draw dashed line from x_canvas[j_left] to x_canvas[j_right] at y = y_canvas
    Label right side: "E_1 = 2.47 E_h"
```

The user can hover over a dashed line to preview that eigenstate, and click it to inject `phi_n` as the current live wavefunction.

---

## 4. Interactive Experiments — Chapter-by-Chapter Breakdown

### Chapter 1: What Is a Wavefunction?

**Setup:** Free space (V = 0 everywhere), Gaussian packet at center with `k0 > 0`.

**Learning objectives:**
- psi is complex; real and imaginary parts oscillate like a corkscrew pattern
- |psi|^2 is real, non-negative, and integrates to 1
- The packet moves at group velocity `v_g = d(omega)/dk = k0` and spreads over time

**User controls:**
- Slider: initial momentum `k0`
- Slider: initial spread `sigma`
- Toggle: show psi_real, psi_imag, |psi|^2, or all three simultaneously
- Pause/Resume, Step-by-step frame advance

**Discovery moment:** Set `sigma` very small -> packet spreads rapidly. Set `sigma` large -> packet moves cleanly without much spread. The uncertainty principle is at work: narrow in position means wide in momentum, causing faster dispersion.

**Sidebar hint:** "Why does the packet spread? A narrow packet requires many k-components. Different k-components travel at different speeds (v = k/m). This is called **dispersion**."

### Chapter 2: The Infinite Box

**Setup:** Tall walls at both ends (infinite square well). Initial wavepacket bouncing between them.

**Learning objectives:**
- Reflections from infinite walls are perfectly elastic
- Standing waves emerge naturally from interference of left- and right-moving reflected waves
- Energy quantization: only certain wavelengths "fit" inside the box

**User controls:**
- Slider: box width `2a`
- Button: "Run ITE" -> find and display energy levels as dashed horizontal lines
- Click on any energy level line -> load that eigenstate into the simulation

**Discovery moment:** Start a packet with non-eigenstate energy -> it never settles into a clean standing wave pattern. Run ITE -> find psi_1. Load psi_1 -> it oscillates in place without its spatial shape changing. This is the definition of a stationary state.

### Chapter 3: Quantum Tunneling

**Setup:** Single rectangular barrier. Packet approaches from the left with `E < V0`.

**Learning objectives:**
- Classically forbidden transmission below the barrier height
- Evanescent (exponentially decaying) tail visible inside the barrier
- Exponential dependence of transmission T on barrier thickness d

**User controls:**
- Sliders: barrier height `V0` and width `d`
- Slider: packet energy `E = k0^2/2`
- Live readout: T_numerical and T_exact (analytical formula from Section 2.9)

**Discovery moment:** Draw a thin barrier. Fire a packet with `E < V0`. See partial transmission. Increase barrier thickness -> watch T drop exponentially. Verify against analytical formula.

**Developer note:** Implement a dedicated right-absorber with separate norm tracking. After the packet passes:
```
T = (initial_norm - current_norm - left_absorbed) / initial_norm
```

### Chapter 4: Energy Eigenstates

**Setup:** User draws any potential. Click "Find Ground State" -> ITE runs in the background.

**Learning objectives:**
- Eigenstates are stationary: only a global phase rotates, |psi|^2 is constant
- Energy quantization arises from boundary conditions
- The n-th eigenstate has exactly n-1 nodes (zeros) in the interior

**User controls:**
- Button "Find Ground State" -> run ITE until convergence (display progress bar)
- Button "Find Next State" -> orthogonalize against found states and run ITE again
- Energy level sidebar showing E_0, E_1, E_2, ... with state labels
- Click any energy level -> inject that eigenstate into the live TDSE simulation

**Discovery moment:** Load E_2 (second excited state) -> |psi|^2 has three lobes and does not move. Perturb the potential (shift it slightly) -> watch the state mix with neighboring eigenstates and oscillate. Remove the perturbation -> the eigenstate is recovered.

### Chapter 5: Superposition & Quantum Beats

**Setup:** Any bound potential with two known eigenstates phi_n, phi_m already computed.

**Learning objectives:**
- Any linear combination of eigenstates is a valid quantum state
- The probability density oscillates at the Bohr frequency `omega = (E_m - E_n)/hbar`
- Measurement collapses the superposition to one eigenstate randomly

**User controls:**
- Slider: mixing angle theta (c_n = cos(theta), c_m = sin(theta))
- Dropdown: which eigenstates to combine (E1+E2, E1+E3, E2+E3, etc.)
- Live readout: beat period `T_beat = 2*pi / (E_m - E_n)`
- Phase space display showing the trajectory

**Discovery moment:** Set `theta = pi/4` (equal mix of E_1 and E_2). Watch the probability density oscillate back and forth like a classical particle bouncing in the well. Press "Measure Position" -> the superposition collapses to a definite (random) position. Press Reset and Measure again -> different position each time.

### Chapter 6: The Harmonic Oscillator

**Setup:** `V = (1/2) * omega^2 * x^2` preset loaded.

**Learning objectives:**
- Energy levels are equally spaced: `E_n = omega*(n + 1/2)`, unlike the infinite square well
- Ground state wavefunction is a Gaussian (minimum uncertainty state)
- Coherent states move exactly like a classical harmonic oscillator without spreading
- Ladder operators a_hat and a_hat_dag connect adjacent energy levels (conceptual)

**User controls:**
- Slider: oscillator frequency `omega`
- Slider: initial displacement from equilibrium A (sets coherent state amplitude)
- Button: "Load Coherent State" -> initializes Gaussian at x = A with k0 = 0
- Toggle: overlay classical trajectory `x(t) = A*cos(omega*t)`

**Discovery moment:** Initialize a displaced Gaussian with `k0 = 0`. Watch it oscillate exactly like a mass on a spring, but without any spreading whatsoever. This is the coherent state — the most "classical" quantum state possible, and the quantum description of laser light.

### Chapter 7: Measurement & Collapse

**Setup:** Any non-trivial wavefunction from a previous chapter.

**Learning objectives:**
- Quantum measurement is fundamentally probabilistic — not due to ignorance
- A single measurement gives a definite outcome drawn from |psi|^2
- Repeated measurements on identically prepared states reconstruct |psi|^2
- After collapse, the particle has a definite position but completely uncertain momentum

**User controls:**
- Button: "Measure Position" -> collapses to a sampled position, displays `x_meas`
- Button: "Reset to Original psi" -> reloads the pre-measurement state for the next trial
- Mode: "Rapid Fire" -> measure, reset, and measure 100 times automatically -> plots histogram

**Discovery moment:** Use Rapid Fire -> 100 measurements. The histogram converges to the original |psi|^2 shape. The user has **reconstructed the wavefunction from statistics**. This is the essence of quantum state tomography.

### Chapter 8: Double Well & Tunneling Splitting

**Setup:** Symmetric double-well potential `V(x) = a*(x^2 - b^2)^2`.

**Learning objectives:**
- Without tunneling through the barrier: two apparently degenerate ground states (one per well)
- With tunneling: degeneracy is broken into symmetric (bonding) and antisymmetric (antibonding) eigenstates
- The energy splitting `Delta_E = E_2 - E_1` determines the tunneling oscillation period
- This is the quantum mechanical basis of covalent chemical bonds and the ammonia maser

**User controls:**
- Slider: barrier height parameter `a`
- Slider: well separation parameter `b`
- Button: "Find E_1, E_2" -> run ITE for first two eigenstates using Gram-Schmidt
- Energy display: shows `Delta_E = E_2 - E_1` and `T_tunnel = 2*pi / Delta_E`

**Discovery moment:** Load equal superposition of E_1 (symmetric) and E_2 (antisymmetric). Watch probability oscillate from left well to right well and back — **quantum tunneling oscillation**. Increase the barrier height -> watch the period grow (slower tunneling because `Delta_E` shrinks). Decrease barrier -> faster tunneling. This is exactly the physics of the ammonia (NH3) molecule.

---

## 5. Rendering Design

### 5.1 Canvas Layout

The main simulation area uses two `<canvas>` elements:

```
+-----------------------------------------------+  +-------------------+
|         Main Wavefunction Canvas               |  | Momentum Space    |
|         (width: ~70% of panel, height: 400px)  |  | Panel (~30%)      |
|                                                 |  +-------------------+
|  psi_re (blue curve)                           |
|  psi_im (red curve)                            |  +-------------------+
|  |psi|^2 (white filled area)                  |  | Uncertainty       |
|  V(x)  (amber solid fill from bottom)          |  | Readout HUD       |
|  Phase hue band (thin strip below curves)       |  +-------------------+
|  Energy level dashed lines                     |
+-----------------------------------------------+
```

### 5.2 Wavefunction Curves

**psi_real:** Drawn as a polyline connecting `(x_canvas[j], y_center - A * psi_re[j])`. Color: `#4A90D9` (bright blue). Linewidth: 2px.

**psi_imag:** Same formula, same baseline. Color: `#E04848` (coral red). Linewidth: 2px.

**|psi|^2:** Filled area under the probability density curve from the baseline:

```javascript
ctx.beginPath();
ctx.moveTo(x_canvas[0], y_baseline);
for (let j = 0; j < N; j++) {
    const prob = psi_re[j] ** 2 + psi_im[j] ** 2;
    ctx.lineTo(x_canvas[j], y_baseline - prob * probScale);
}
ctx.lineTo(x_canvas[N - 1], y_baseline);
ctx.closePath();
ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
ctx.fill();
ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = 1.5;
ctx.stroke();
```

`probScale` is chosen so that a normalized packet with `sigma = 5*dx` fills roughly 60% of the canvas height.

### 5.3 Phase Color Visualization

Compute the argument of psi at each grid point:

```
theta_j = atan2(psi_im[j], psi_re[j])    in (-pi, pi]
```

Map to hue angle:

```javascript
function phaseToHSL(theta) {
    const hue = ((theta / Math.PI) * 180 + 360) % 360;  // 0-360 degrees
    return `hsl(${hue.toFixed(1)}, 100%, 50%)`;
}
```

Draw the phase as a thin horizontal band (height ~8px) positioned just below the wavefunction curves. Fill each grid segment with its phase color, with opacity proportional to `|psi|^2` to suppress spurious colors at nodes:

```javascript
for (let j = 0; j < N - 1; j++) {
    const prob = psi_re[j] ** 2 + psi_im[j] ** 2;
    const alpha = Math.min(1.0, prob * probScale * 3.0);   // fade near nodes
    const theta = Math.atan2(psi_im[j], psi_re[j]);
    const hue = ((theta / Math.PI) * 180 + 360) % 360;
    ctx.fillStyle = `hsla(${hue.toFixed(1)}, 100%, 55%, ${alpha.toFixed(3)})`;
    ctx.fillRect(x_canvas[j], phaseStrip_y, x_canvas[j+1] - x_canvas[j], 8);
}
```

> **WARNING — Phase Singularity:** At nodes where psi ~= 0, the phase is undefined. Always apply the opacity fade. Without it, the phase band shows random rainbow noise at every node, which is visually confusing and pedagogically incorrect.

### 5.4 Potential V(x) Rendering

The potential is drawn as a filled region from the canvas bottom:

```javascript
ctx.beginPath();
ctx.moveTo(0, canvas.height);
for (let j = 0; j < N; j++) {
    const yV = canvas.height - (V[j] / V_max_display) * canvas.height;
    ctx.lineTo(x_canvas[j], yV);
}
ctx.lineTo(canvas.width, canvas.height);
ctx.closePath();
ctx.fillStyle = 'rgba(255, 170, 0, 0.35)';
ctx.fill();
ctx.strokeStyle = '#FFAA00';
ctx.lineWidth = 2;
ctx.stroke();
```

`V_max_display` is dynamically set to `max(V) * 1.1` and clamped to never show walls taller than 90% of the canvas.

### 5.5 Energy Eigenvalue Lines

For each found eigenstate n with energy E_n:
- Canvas Y position: `yE = canvas.height * (1 - E_n / V_max_display)`
- Dashed horizontal line spanning the classically allowed region:

```javascript
const EIGENSTATE_COLORS = ['#7EE8A2', '#F6AE2D', '#F26419', '#86BBD8', '#2F4858', '#33658A'];
ctx.setLineDash([8, 4]);
ctx.strokeStyle = EIGENSTATE_COLORS[n % EIGENSTATE_COLORS.length];
ctx.lineWidth = 1.5;
ctx.beginPath();
ctx.moveTo(x_canvas[j_left], yE);
ctx.lineTo(x_canvas[j_right], yE);
ctx.stroke();
ctx.setLineDash([]);
// Label
ctx.fillStyle = EIGENSTATE_COLORS[n % EIGENSTATE_COLORS.length];
ctx.font = '11px monospace';
ctx.fillText(`E${n+1} = ${E_n.toFixed(3)} Eh`, x_canvas[j_right] + 4, yE + 4);
```

### 5.6 Momentum Space Panel

This secondary `<canvas>` shows `|phi_tilde(k)|^2` — the probability density in momentum space.

At each frame (or every 2nd frame if performance is tight):
1. Compute FFT: `[phi_re, phi_im] = FFT(psi_re, psi_im)`
2. Compute `prob_k[m] = phi_re[m]^2 + phi_im[m]^2`
3. Apply fftshift: reorder array so k=0 is in center (swap first and second halves)
4. Draw as filled area plot with the same style as |psi|^2

**Axis labels:** `k` from `-pi/dx` to `+pi/dx`, with tick marks at `k = 0` and `k = k0`.

**Pedagogy:** The complementarity is visually obvious — a narrow position-space packet (small sigma) produces a wide momentum-space distribution, and vice versa.

### 5.7 Uncertainty Readout HUD

An HTML overlay div (not canvas) positioned in the corner, updated every frame via DOM manipulation:

```html
<div id="uncertainty-hud" class="hud-panel" aria-live="polite">
    <div class="hud-row">
        <span class="hud-label">Δx</span>
        <span class="hud-value" id="hud-dx">— a₀</span>
    </div>
    <div class="hud-row">
        <span class="hud-label">Δp</span>
        <span class="hud-value" id="hud-dp">— ℏ/a₀</span>
    </div>
    <div class="hud-row hud-product">
        <span class="hud-label">ΔxΔp</span>
        <span class="hud-value" id="hud-product">— ℏ</span>
        <span class="hud-min">[min: 0.500 ℏ]</span>
    </div>
</div>
```

Color the product value: CSS class `near-minimum` (green) if `DxDp < 0.52`, `elevated` (yellow) if `0.52 <= DxDp < 1.0`, `high` (red) if `DxDp >= 1.0`.

---

## 6. Performance & Numerical Accuracy

### 6.1 Why Split-Operator vs. FTCS Finite Difference

The most obvious alternative is the **Forward-Time Centered-Space (FTCS)** finite-difference scheme. This approach fails for quantum mechanics:

| Property | FTCS Finite Difference | Split-Operator (this spec) |
|---|---|---|
| Stability | Conditionally stable: requires `dt < dx^2` | **Unconditionally stable** (any dt, accuracy only) |
| Norm conservation | Violated — norm grows exponentially | Exact to machine precision |
| Accuracy | O(dt, dx^2) — first order in time | O(dt^2, dx^2) — second order in time |
| Unitarity | Not unitary | Exactly unitary |
| Per-step cost | O(N) | O(N log N) |
| High-V instability | `dt < dx^2 / V_max` (severe restriction) | No restriction |

For FTCS with `N=512`, `dx=0.195`, and `V_max=1000 E_h` (infinite well walls): the stability condition becomes `dt < dx^2 / V_max ~= 3.8e-5` — requiring ~2,600 steps per animation frame. Split-operator needs only 10.

**The Crank-Nicolson scheme** is stable and norm-conserving but requires solving a tridiagonal linear system at every step. For `N <= 1024`, split-operator is faster because highly optimized FFT libraries run faster than a serial tridiagonal solver in JavaScript.

### 6.2 Optimal Grid Size and Steps per Frame

| Grid N | FFT cost per step | Steps/frame @60fps | Effective sim. rate |
|---|---|---|---|
| 256 | ~0.2ms | 20 | Fast, low resolution |
| **512** | **~0.8ms** | **10** | **Best default** |
| 1024 | ~1.8ms | 5 | Good res., may drop frames on mobile |
| 2048 | ~4ms | 2 | Research quality, not realtime on most devices |

**Default: N = 512.** Provide a "High Resolution (N=1024)" toggle in settings. On mobile, auto-detect and fall back to N=256 (see Section 6.4).

### 6.3 FFT Implementation

**Recommended:** Use the `fft.js` library by indutny, CDN-served:

```html
<script src="https://cdn.jsdelivr.net/npm/fft.js@4.0.4/lib/fft.js"
        crossorigin="anonymous"></script>
```

**Usage pattern (interleaved complex format):**
```javascript
const fftInstance = new FFT(N);   // N must be power of 2
const complexOut = fftInstance.createComplexArray();   // length 2N
const complexIn  = fftInstance.createComplexArray();

// Pack input: interleaved [re0, im0, re1, im1, ...]
for (let j = 0; j < N; j++) {
    complexIn[2*j]     = psi_re[j];
    complexIn[2*j + 1] = psi_im[j];
}

// Forward FFT (output: complexOut)
fftInstance.transform(complexOut, complexIn);

// Apply kinetic phase in k-space
for (let m = 0; m < N; m++) {
    const re = complexOut[2*m],  im = complexOut[2*m+1];
    const cr = kineticPhase[m].re, ci = kineticPhase[m].im;
    complexOut[2*m]     = re*cr - im*ci;
    complexOut[2*m + 1] = re*ci + im*cr;
}

// Inverse FFT (result normalized by 1/N automatically)
fftInstance.inverseTransform(complexIn, complexOut);

// Unpack
for (let j = 0; j < N; j++) {
    psi_re[j] = complexIn[2*j];
    psi_im[j] = complexIn[2*j + 1];
}
```

**Fallback: Self-contained Cooley-Tukey FFT (no CDN needed):**
```javascript
function fft(re, im, invert) {
    // in-place FFT on re[], im[] of length N (power of 2)
    const n = re.length;
    // Bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    // Butterfly computation
    for (let len = 2; len <= n; len <<= 1) {
        const ang = 2 * Math.PI / len * (invert ? -1 : 1);
        const wRe = Math.cos(ang), wIm = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let curRe = 1.0, curIm = 0.0;
            for (let j = 0; j < len / 2; j++) {
                const uRe = re[i + j],          uIm = im[i + j];
                const vRe = re[i + j + len/2] * curRe - im[i + j + len/2] * curIm;
                const vIm = re[i + j + len/2] * curIm + im[i + j + len/2] * curRe;
                re[i + j]         = uRe + vRe;  im[i + j]         = uIm + vIm;
                re[i + j + len/2] = uRe - vRe;  im[i + j + len/2] = uIm - vIm;
                const newCurRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = newCurRe;
            }
        }
    }
    if (invert) {
        for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
}
```

> **WARNING — FFT Sign Convention:** The forward FFT above uses `exp(-2*pi*i*j*m/N)` (physics convention). Some libraries use the opposite sign (`exp(+2*pi*i*j*m/N)`). If the wavepacket moves in the **wrong direction** (against the sign of `k0`), flip the sign in the kinetic phase computation: change `phi = -0.5 * k * k * dt` to `phi = +0.5 * k * k * dt`. Do not flip both — only one needs to change.

### 6.4 Auto-Benchmark and Adaptive Performance

```javascript
async function autoBenchmark(solver) {
    // Run 200 steps with N=512 and time it
    const t0 = performance.now();
    for (let s = 0; s < 200; s++) solver.step(1);
    const elapsed = performance.now() - t0;   // milliseconds for 200 steps
    const msPerStep = elapsed / 200;

    if (msPerStep > 1.5) {
        // Slow device: drop to N=256, 5 steps/frame
        solver.reconfigure({ N: 256, stepsPerFrame: 5 });
        console.log('Performance mode: N=256');
    } else if (msPerStep < 0.3) {
        // Fast device: offer N=1024
        document.getElementById('highResToggle').disabled = false;
        console.log('High-res mode available: N=1024');
    }
    // Default: N=512, 10 steps/frame
}
```

### 6.5 WebAssembly Acceleration Path

If JavaScript performance is insufficient, move the core solver to WebAssembly. The functions to port are:

1. `splitOperatorStep` — called 10 times per frame, dominates budget
2. The in-place Cooley-Tukey FFT — called twice per split step (2x per step)
3. `renormalize` — cheap but called often in ITE mode

**Recommended toolchain:** Compile AssemblyScript (TypeScript-like syntax -> WASM) using `asc`:

```typescript
// solver.ts  (AssemblyScript)
export function splitStep(
    psi_re: Float32Array, psi_im: Float32Array,
    pot_cos: Float32Array, pot_sin: Float32Array,
    kin_cos: Float32Array, kin_sin: Float32Array,
    N: i32
): void {
    // Half V, FFT, full kinetic, IFFT, half V -- all inline
    // Share typed arrays via WASM memory (zero-copy)
}
```

Use `Float32Array` (single precision) for the WASM path — relative error ~1e-7 per step, acceptable for visualization. This typically gives 3-5x speedup over equivalent JavaScript, potentially enabling N=1024 at 60fps on mid-range devices.

**Loading pattern:**
```javascript
let wasmSolver = null;
WebAssembly.instantiateStreaming(fetch('/static/js/labs/quantum_wavefunction/solver.wasm'))
    .then(({ instance }) => {
        wasmSolver = instance.exports;
        console.log('WASM solver loaded');
    })
    .catch(() => console.log('WASM unavailable, using JS solver'));
```

---

## 7. Dependencies & Technical Requirements

### 7.1 Runtime Dependencies

| Library | Purpose | CDN URL | Version |
|---|---|---|---|
| `fft.js` | FFT for split-operator solver | `https://cdn.jsdelivr.net/npm/fft.js@4.0.4/lib/fft.js` | 4.0.4 |

**No other dependencies are needed.** Justification:

- **No physics library:** No existing JS library implements the TDSE with split-operator. All physics is custom.
- **No UI framework:** Canvas animation is inherently imperative. React/Vue add complexity without benefit and introduce a build-step requirement.
- **No math library:** All required math (complex multiply, trig, FFT) is implemented above.
- **No charting library:** Canvas 2D API is sufficient and faster than Chart.js or D3 for this use case (per-frame redraws at 60fps).
- **No CSS framework:** The lab is embedded in the existing Jinja2 site's CSS; Tailwind or Bootstrap would conflict.

If the CDN is unavailable (offline deployment, air-gapped environments), the self-contained Cooley-Tukey FFT from Section 6.3 is a complete drop-in replacement. It is approximately 2x slower than `fft.js` for N=512 but still achieves the performance budget.

### 7.2 Browser Compatibility

| Browser | Minimum Version | Notes |
|---|---|---|
| Chrome | 90+ | Full support, optimal performance |
| Firefox | 88+ | Full support |
| Safari | 15+ | Full support (no OffscreenCanvas needed) |
| Edge (Chromium) | 90+ | Full support |
| Mobile Chrome | 90+ | Auto-reduce N to 256 via benchmark |
| Mobile Safari | 15.4+ | Auto-reduce N to 256, optionally hide momentum panel |

**Required Web APIs (all universally supported since 2021+):**
- `HTMLCanvasElement` and `CanvasRenderingContext2D`
- `requestAnimationFrame`
- `Float64Array`, `Float32Array`
- `Math.atan2`, `Math.exp`, `Math.cos`, `Math.sin`
- `performance.now()` (for benchmarking)

**Optional (WASM path only):**
- `WebAssembly.instantiateStreaming` — Chrome 61+, Firefox 58+, Safari 15+

### 7.3 No Framework Rationale (Extended)

The lab is intentionally zero-build-step:
- Drop the HTML template + JS files into the Flask static folder
- No `npm install`, no `webpack`, no transpilation
- Works equally as a standalone `.html` file for testing offline
- Load time: `fft.js` is 8KB gzipped; total lab JS is ~30KB — loads in <100ms on any connection

---

## 8. Integration with Existing Flask/Jinja2 Site Structure

### 8.1 Recommended File Layout

```
jonslane/
├── app.py                         (Flask application, add route here)
├── templates/
│   ├── base.html                  (existing base template)
│   └── space_physics/
│       └── lab_quantum_wavefunction.html    <-- NEW Jinja2 template
├── static/
│   ├── css/
│   │   └── labs.css               <-- Extend with quantum lab tokens
│   └── js/
│       └── labs/
│           └── quantum_wavefunction/
│               ├── solver.js      <-- Physics engine (split-operator, ITE, measurement)
│               ├── renderer.js    <-- Canvas drawing (all rendering code)
│               ├── experiments.js <-- Chapter logic, UI event handlers
│               └── fft_local.js   <-- Cooley-Tukey fallback (offline safety)
└── docs/
    └── space_physics/
        └── lab_quantum_wavefunction.md    <-- THIS DOCUMENT
```

### 8.2 Flask Route

Add to `app.py` or the appropriate Blueprint:

```python
from flask import Blueprint, render_template

space_physics_bp = Blueprint('space_physics', __name__, url_prefix='/space-physics')

@space_physics_bp.route('/labs/quantum-wavefunction')
def lab_quantum_wavefunction():
    return render_template(
        'space_physics/lab_quantum_wavefunction.html',
        title='Quantum Wavefunction Sandbox',
        meta_description='Interactive quantum mechanics simulation. '
                         'Explore wavefunctions, tunneling, eigenstates, '
                         'and measurement collapse in your browser.',
        lab_id='quantum_wavefunction',
        chapter_count=8
    )
```

### 8.3 Jinja2 Template

```html
{% extends "base.html" %}

{% block title %}{{ title }} — JonsLane Space Physics{% endblock %}

{% block meta %}
<meta name="description" content="{{ meta_description }}">
<meta property="og:title" content="{{ title }}">
<meta property="og:description" content="{{ meta_description }}">
{% endblock %}

{% block head %}
<!-- fft.js for split-operator solver -->
<script src="https://cdn.jsdelivr.net/npm/fft.js@4.0.4/lib/fft.js"
        crossorigin="anonymous"
        onerror="window.FFT_CDN_FAILED=true"></script>
<!-- Local fallback loaded by experiments.js if CDN failed -->
<link rel="stylesheet" href="{{ url_for('static', filename='css/labs.css') }}">
{% endblock %}

{% block content %}
<main class="lab-container" id="lab-{{ lab_id }}">

    <header class="lab-header">
        <h1>Quantum Wavefunction Sandbox</h1>
        <p class="lab-subtitle">Explore quantum mechanics interactively — draw potentials,
           fire particles, observe tunneling, and collapse wavefunctions.</p>
    </header>

    <!-- Chapter navigation -->
    <nav class="chapter-nav" aria-label="Lab chapters">
        {% for ch in range(1, chapter_count + 1) %}
        <button class="chapter-btn{% if loop.first %} active{% endif %}"
                data-chapter="{{ ch }}"
                id="chapter-btn-{{ ch }}"
                type="button">
            Ch. {{ ch }}
        </button>
        {% endfor %}
    </nav>

    <!-- Chapter description panel (populated by experiments.js) -->
    <section class="chapter-panel" id="chapter-panel" aria-live="polite">
    </section>

    <!-- Main simulation layout -->
    <div class="sim-layout">
        <div class="main-canvas-wrapper">
            <canvas id="main-canvas" width="800" height="400"
                    aria-label="Quantum wavefunction simulation canvas"
                    tabindex="0"></canvas>
        </div>
        <div class="side-panels">
            <canvas id="momentum-canvas" width="300" height="180"
                    aria-label="Momentum space probability density"></canvas>
            <div class="uncertainty-hud" id="uncertainty-hud" aria-live="polite">
                <div class="hud-row">
                    <span class="hud-label">Δx</span>
                    <span class="hud-value" id="hud-dx">—</span>
                </div>
                <div class="hud-row">
                    <span class="hud-label">Δp</span>
                    <span class="hud-value" id="hud-dp">—</span>
                </div>
                <div class="hud-row hud-product">
                    <span class="hud-label">ΔxΔp</span>
                    <span class="hud-value" id="hud-product">—</span>
                    <span class="hud-min">min: 0.500 ℏ</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Chapter-specific controls (populated by experiments.js) -->
    <div class="controls-panel" id="controls-panel" role="region"
         aria-label="Simulation controls">
    </div>

    <!-- Global controls always visible -->
    <div class="global-controls">
        <button id="btn-play-pause" type="button">⏸ Pause</button>
        <button id="btn-step" type="button">⏭ Step</button>
        <button id="btn-reset" type="button">↺ Reset</button>
        <label class="toggle-label">
            <input type="checkbox" id="toggle-hi-res"> High-res (N=1024)
        </label>
        <label class="toggle-label">
            <input type="checkbox" id="toggle-phase" checked> Phase colors
        </label>
    </div>

</main>

<!-- Lab scripts — deferred to avoid blocking page render -->
<script src="{{ url_for('static', filename='js/labs/quantum_wavefunction/fft_local.js') }}"
        defer></script>
<script src="{{ url_for('static', filename='js/labs/quantum_wavefunction/solver.js') }}"
        defer></script>
<script src="{{ url_for('static', filename='js/labs/quantum_wavefunction/renderer.js') }}"
        defer></script>
<script src="{{ url_for('static', filename='js/labs/quantum_wavefunction/experiments.js') }}"
        defer></script>
{% endblock %}
```

### 8.4 Module Architecture

Each JS file exposes a namespace object to avoid global scope pollution and maintain clear API boundaries:

**`solver.js`** — `window.QuantumSolver`:
```javascript
window.QuantumSolver = (() => {
    let N, dx, dt, x, V_eff, psi_re, psi_im, kineticPhase, potPhaseHalf;
    return {
        init(config),          // Set grid parameters, initialize psi, precompute phases
        step(nSteps),          // Run nSteps split-operator steps
        stepITE(nSteps),       // Run nSteps imaginary-time steps (for eigenstate finding)
        getState(),            // Return { psi_re, psi_im, V: V_eff, x, norm }
        setV(newV),            // Update potential array and recompute pot phases
        setPsi(re, im),        // Set wavefunction (for superposition, collapse, etc.)
        measure(),             // Collapse psi, return { x_measured, psi_collapsed }
        getEigenstates(),      // Return array of found { energy, psi_re, psi_im }
        computeUncertainty()   // Return { dx: Delta_x, dp: Delta_p, product: DxDp }
    };
})();
```

**`renderer.js`** — `window.QuantumRenderer`:
```javascript
window.QuantumRenderer = (() => {
    return {
        init(mainCanvas, momentumCanvas),
        render(state, options),   // state from QuantumSolver.getState(), options = { showPhase, showImag, ... }
        renderMomentum(state),    // Draw |phi_tilde(k)|^2 on momentum canvas
        updateHUD(uncertainty)    // Update uncertainty DOM elements
    };
})();
```

**`experiments.js`** — entry point, orchestrates the animation loop:
```javascript
document.addEventListener('DOMContentLoaded', () => {
    // 1. Check CDN FFT or use local fallback
    // 2. Init QuantumSolver with default config
    // 3. Init QuantumRenderer
    // 4. Run autoBenchmark
    // 5. Load Chapter 1
    // 6. Start requestAnimationFrame loop
});
```

### 8.5 CSS Additions to labs.css

```css
/* === Quantum Wavefunction Lab Design Tokens === */
:root {
    --qm-psi-re:      #4A90D9;
    --qm-psi-im:      #E04848;
    --qm-prob-fill:   rgba(255, 255, 255, 0.22);
    --qm-prob-stroke: rgba(255, 255, 255, 0.85);
    --qm-potential:   rgba(255, 170, 0, 0.35);
    --qm-barrier:     #FFAA00;
    --qm-e0:          #7EE8A2;
    --qm-e1:          #F6AE2D;
    --qm-e2:          #F26419;
    --qm-e3:          #86BBD8;
    --qm-e4:          #2F4858;
    --qm-hud-bg:      rgba(10, 10, 20, 0.75);
    --qm-hud-border:  rgba(100, 150, 255, 0.3);
}

.lab-container { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }
.sim-layout    { display: flex; gap: 1rem; align-items: flex-start; }
.main-canvas-wrapper { flex: 1; }
#main-canvas   { width: 100%; border-radius: 8px; cursor: crosshair; }
.side-panels   { width: 300px; display: flex; flex-direction: column; gap: 0.75rem; }
#momentum-canvas { width: 100%; border-radius: 6px; }
.uncertainty-hud {
    background: var(--qm-hud-bg);
    border: 1px solid var(--qm-hud-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
}
.hud-row     { display: flex; justify-content: space-between; padding: 2px 0; }
.hud-value.near-minimum { color: #7EE8A2; }
.hud-value.elevated     { color: #F6AE2D; }
.hud-value.high         { color: #E04848; }
.chapter-nav { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
.chapter-btn { padding: 0.4rem 0.9rem; border-radius: 20px; font-size: 0.8rem;
               border: 1px solid rgba(255,255,255,0.2); background: transparent;
               color: inherit; cursor: pointer; transition: background 0.2s; }
.chapter-btn.active  { background: rgba(74, 144, 217, 0.3); border-color: var(--qm-psi-re); }
.chapter-btn:hover   { background: rgba(255,255,255,0.08); }
.global-controls { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;
                   margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); }
```

### 8.6 SEO and Accessibility Checklist

- `<title>`: `Quantum Wavefunction Sandbox | Space Physics Labs | JonsLane`
- `<meta name="description">`: Injected from Flask template context variable
- `<h1>`: Single, descriptive: "Quantum Wavefunction Sandbox"
- All `<canvas>` elements: have `aria-label` attributes describing their content
- All interactive controls: associated `<label>` elements with `for` attributes
- All buttons: descriptive `type="button"` and meaningful text
- Uncertainty HUD: `aria-live="polite"` for screen reader updates
- Chapter panel: `aria-live="polite"` for dynamic content changes
- Chapter buttons: keyboard-navigable (native `<button>` elements)
- Color: phase visualization uses hue only for aesthetics; all quantitative information is also shown numerically (not color-only)

---

## Appendix A: Mathematical Subtleties — Consolidated Checklist

The following is a complete list of every location in this spec where an incorrect implementation produces **wrong physics silently** (no JavaScript error, just bad results):

| # | Section | Subtlety | Consequence if Skipped |
|---|---|---|---|
| 1 | 2.2.3 | FFT k-values must use signed frequencies (k < 0 for m >= N/2) | Wavepacket moves opposite to k0 (backward) |
| 2 | 2.4 | IFFT must divide by N (1/N normalization factor) | Amplitude grows by factor N per step — instant explosion |
| 3 | 2.6 | CAP norm loss is physical; do not renormalize during tunneling | Tunneling probability T becomes unmeasurable |
| 4 | 2.6 | eta_max too large creates reflections from absorbing layer | Absorbing layer acts as a mirror — opposite of intended |
| 5 | 2.10 | CAP must be disabled (set eta=0) during imaginary-time evolution | ITE converges to non-physical absorbed state, not a bound eigenstate |
| 6 | 2.10 | Gram-Schmidt orthogonalization must be applied at every ITE step | Higher eigenstates are not truly orthogonal to lower ones |
| 7 | 2.10 | Renormalization must occur after every ITE step | ITE is non-unitary; without renormalization psi -> 0 |
| 8 | 3.2.5 | Delta function must scale as V0/dx (not V0) | Delta potential strength is grid-dependent (may not bind) |
| 9 | 3.3 | Do not apply Gaussian smoothing to delta function preset | Delta function loses its integral value |
| 10 | 3.3 | Gaussian smoothing of infinite walls introduces boundary leakage | Wavefunction slowly passes through "infinite" walls |
| 11 | 5.3 | Phase color must fade (opacity -> 0) at nodes where psi ~= 0 | Random rainbow noise at every zero-crossing of psi |
| 12 | 6.3 | FFT sign convention must match between forward and inverse | Wavepacket moves in wrong direction if signs are inconsistent |
| 13 | 2.3 | Initial k0 must satisfy |k0| < pi/dx (Nyquist condition) | Aliasing corrupts momentum representation instantly |
| 14 | 2.12 | After measurement collapse, always renormalize before resuming | Post-collapse psi has incorrect norm (not 1) |

---

## Appendix B: Recommended Development Order

To minimize debugging complexity, build in this order (each stage is independently testable):

1. **Stage 1 (Days 1-3):** Grid initialization, Gaussian wavepacket formula, free-space split-operator, basic canvas rendering of psi_re and |psi|^2. Verify: packet moves at k0, spreads as sigma(t).

2. **Stage 2 (Days 4-5):** Add absorbing boundaries. Verify: no reflections from grid edges. Add norm readout to confirm norm is conserved (real-time) or smoothly decaying (with CAP).

3. **Stage 3 (Days 6-8):** Implement preset potentials (square well, step, harmonic oscillator). Add rectangular barrier. Implement tunneling probability readout. Verify T against T_exact formula.

4. **Stage 4 (Days 9-10):** Add mouse-draw potential interface with smoothing. Verify that drawing a barrier and firing a packet gives the same tunneling result as the preset barrier.

5. **Stage 5 (Days 11-14):** Implement imaginary-time evolution. Verify ground state energy against known analytical values (square well: E0 = pi^2/8a^2; HO: E0 = omega/2). Add Gram-Schmidt for higher eigenstates. Add energy level dashed lines.

6. **Stage 6 (Days 15-17):** Superposition mode. Verify quantum beat period matches T_beat = 2*pi/(E2-E1). Add uncertainty HUD — verify that Gaussian packet gives DxDp = 0.5.

7. **Stage 7 (Days 18-19):** Measurement collapse (CDF sampling). Verify that 100 rapid-fire measurements reproduce |psi|^2. Add phase visualization.

8. **Stage 8 (Days 20-21):** Double well chapter. Verify tunneling splitting grows with barrier height. Momentum space panel.

9. **Stage 9 (Days 22-24):** Performance benchmark and auto-scaling, mobile responsiveness, keyboard accessibility, Flask/Jinja2 integration.

10. **Stage 10 (Days 25-28):** Chapter text, discovery prompts, collapsible explanation panels, final visual polish, cross-browser testing.

---

*End of Technical Specification — Version 1.0*  
*Document length: ~560+ lines of specification content*  
*All equations are in Hartree atomic units (hbar=1, m=1) unless noted*
