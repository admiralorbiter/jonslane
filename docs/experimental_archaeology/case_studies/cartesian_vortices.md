# Case Study 4: Cartesian Vortex Cosmology

**Fluid Vortices as Planetary Drives — Can a Contact Mechanism Generate Keplerian Orbits?**

---

## Status: Planned

This document is a design stub. It will be expanded into a full specification
before implementation begins.

---

## Overview

Descartes rejected Newton's action-at-a-distance gravity as philosophically
unacceptable (unexplained force across empty space). In its place, he proposed
that space is filled with a subtle material medium arranged in large rotating
vortices. Planets are carried through the solar vortex; moons are carried
through smaller planetary vortices.

This was a *mechanistic* theory — everything happens by contact, in the
tradition of Descartes's broader physics. It was widely discussed and had
serious adherents in the late 17th century.

---

## Central Question

Using a modern fluid simulation: can a vortex generate approximately Keplerian
orbital speeds? What fluid properties would be required? What additional
observable consequences (drag, heating, aberration, orbital decay) does the
mechanism predict, and are they observed?

---

## Key Stresses on the Theory

| Prediction | Cartesian Vortex | Observation |
|---|---|---|
| Planetary speed ∝ distance | Requires specific fluid viscosity profile | Kepler's second and third laws approximately satisfied only in limiting cases |
| Orbital stability | Vortex interactions should be disruptive | Orbits are stable over long periods |
| Planetary drag | Fluid should retard motion | No measurable orbital decay for planets |
| Moon attachment | Moons must remain in planetary sub-vortex | Saturn's and Jupiter's moons observed — consistent |
| Comet paths | Comets must follow vortex streamlines | Halley's comet follows highly eccentric paths crossing vortex boundaries |

---

## Key Historical Sources

| Source | Date | Role |
|---|---|---|
| Descartes, *Principia Philosophiae* | 1644 | Primary source for vortex cosmology |
| Newton, *Principia* Book II, Sec. IX | 1687 | Direct refutation of vortex theory |
| Aiton, E. J., *The Vortex Theory of Planetary Motion* | 1972 | Definitive historical account |

---

## Implementation Notes

*This is the most computationally demanding case study. A 2D computational
fluid dynamics simulation (simplified Navier-Stokes or particle-based SPH)
will be required. Consider whether a Web Worker-based approach is feasible
in-browser or whether server-side computation is needed.*
