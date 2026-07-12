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
