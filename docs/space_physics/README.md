# Space & Physics Explorable Explanations | Overview

This directory contains the documentation and technical specifications for the **Space & Physics** interactive educational modules.

---

## 1. Project Purpose

The Space & Physics module provides high-fidelity, interactive "explorable explanations" (inspired by the work of Brett Victor) to help learners develop intuitive mental models of fundamental physics concepts. 

Instead of presenting formulas statically, concepts unfold dynamically as the user scrolls, merging inline interactive simulations, mathematical equations, and real-time graphs directly with the narrative prose.

---

## 2. Page & Chapter Structure

### Module 1: 1D Particle Dynamics & Kinematics (`particle_1d.html`)
The first explorable lesson explores the state vector, evolution laws, and reference frames through seven progressive chapters:

*   **Chapter 1: The Concept of Position**
    *   *Focus:* Visualizing coordinate tracks.
    *   *Interaction:* Dragging the particle along a horizontal track to update the scalar value of $x$ in real-time.
*   **Chapter 2: Diverging Futures**
    *   *Focus:* Proving why position is not enough to predict the future.
    *   *Interaction:* An auto-looping animation of two particles launched from the same starting position with opposite velocities.
*   **Chapter 3: Velocity & State Vector**
    *   *Focus:* Understanding the state vector $[x, v]^T$ and tracking its history.
    *   *Interaction:* Click-and-drag velocity vectors and scrubbable coordinates with real-time synchronized position graphs.
*   **Chapter 4: Evolution Laws**
    *   *Focus:* Coupled differential equations and force dynamics.
    *   *Interaction:* Radio selections to swap force laws (Free, Constant Acceleration, Spring Force, Viscous Drag) with live-updated LaTeX equations and vector arrow displays.
*   **Chapter 5: Phase Space**
    *   *Focus:* Mapping the 2D coordinate system of position vs. velocity.
    *   *Interaction:* Interactive timeline scrubbing by clicking and dragging directly on the phase space orbits. Includes a conceptual quiz with ghost particle trajectory feedback.
*   **Chapter 6: Different Solvers, Different Futures**
    *   *Focus:* Numerical error, step size $\Delta t$, and solver divergence.
    *   *Interaction:* Dragging the $\Delta t$ step size to watch Forward Euler (unstable) spiral outward compared to Euler-Cromer ( symplectic, stable) and the exact analytical solution.
*   **Chapter 7: Galilean Relativity**
    *   *Focus:* Frame reference shifts ($x' = x - ut$).
    *   *Interaction:* Dragging the frame velocity $u$ to compare stationary observer frames vs. moving observer frames, demonstrating that while trajectories shift, acceleration curves remain invariant ($a' = a$).

### Module 2: Galilean Relativity & Reference Frames (`galilean_relativity.html`)
Explores observers in moving frames, coordinate shifts, and invariance of laws:
*   **Chapter 1: Who's Watching?** (Reference frame alignment)
*   **Chapter 2: The Ball in the Train** (Visualizing trajectories in ground vs. train frames)
*   **Chapter 3: State Vector Transformations** (Scrubbing coordinate transformation formulas)
*   **Chapter 4: Symmetry & Equivalence** (Oscillator coordinate system swaps with anchor visualization)
*   **Chapter 5: The Asteroid Chase** (Chasing closing velocities relative to space frames)
*   **Chapter 6: Relativistic Divergence** (Galilean vs. Lorentz velocity additions racer tracks)

### Module 3: Expanding Space Cosmology (`expanding_universe.html`)
Covers comoving and physical coordinate kinematics, expansion histories, and rates:
*   **Chapter 1: The Wrong Picture** (Explosion model vs. uniform space grid stretching)
*   **Chapter 2: A Universe of Markers** (Origin selection and coordinate vectors)
*   **Chapter 3: Two Kinds of Coordinates** (Comoving $\chi$ vs. physical proper distance $D$)
*   **Chapter 4: The Scale Factor** (Matter, radiation, and dark energy scale profiles)
*   **Chapter 5: Expansion as a Rate** (4-stacked graphs of scale derivatives: $a$, $\dot{a}$, $H$, $\ddot{a}$)
*   **Chapter 6: No Preferred Center** (Re-centering observers with live-updating Hubble diagrams)
*   **Chapter 7: Hubble Flow vs. Peculiar Motion** (Andromeda velocity vector boundary game)
*   **Chapter 8: Model Scope & Limitations** (Consensus, model-dependent, and open questions)

### Advanced Physics Sandbox Labs

These are immersive, fullscreen simulator applications that teach astrophysics, special relativity, and quantum dynamics through progressive checklists and interactive controls:

*   **Orbital Mechanics Spec ([lab_orbital_mechanics.md](file:///c:/Users/admir/Github/jonslane/docs/space_physics/lab_orbital_mechanics.md))**
    *   *Lab:* *I Need to Get Out of This Place* (`play.html`)
    *   *Features:* Patched conics RK4 gravity, maneuver nodes, 2D Navball orientation HUD, engine particle plumes, atmospheric limb shaders, and full-screen bloom.
*   **Special Relativity Spec ([lab_special_relativity.md](file:///c:/Users/admir/Github/jonslane/docs/space_physics/lab_special_relativity.md))**
    *   *Features:* Minkowski spacetime diagrams, Lorentz boosts, length contraction, time dilation, and relativistic Doppler color-shifts.
*   **Quantum Wavefunction Spec ([lab_quantum_wavefunction.md](file:///c:/Users/admir/Github/jonslane/docs/space_physics/lab_quantum_wavefunction.md))**
    *   *Features:* 1D Time-Dependent Schrödinger Equation solver using split-step Fourier transforms, quantum tunneling barriers, measurement collapse, and uncertainty readouts.

---

## 3. UI/UX Paradigm

*   **Unified Scrollytelling:** Traditional split-screen dashboards are avoided. Visualizers are kept local to the text describing them.
*   **Monospaced Scrubbables:** Interactive numbers embedded in text can be clicked and dragged horizontally to adjust parameters. The numbers are rendered in tabular, monospaced fonts to prevent text jitter and layout shifts during updates.
*   **High-Contrast Color System:** Canvases use explicit high-brightness color constants to ensure readability on dark backgrounds:
    *   `COLOR_CYAN = "#00f2fe"` (Primary active particle, stable solvers, lab frames)
    *   `COLOR_MAGENTA = "#ff00dd"` (Secondary particles, unstable solvers, moving frames)
    *   `COLOR_AMBER = "#f59e0b"` (Force vectors, warning limits)
    *   `COLOR_WHITE = "#ffffff"` (Analytical solutions, axis labels)
    *   `COLOR_ORANGE = "#f97316"` (Concept check ghost particles)
