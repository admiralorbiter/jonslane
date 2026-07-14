# Case Study 3: Corpuscular vs. Wave Theories of Light

**Newtonian Particles Against Huygens Waves — Which Experiments Forced the Decision?**

---

## Status: Planned

This document is a design stub. It will be expanded into a full specification
before implementation begins.

---

## Overview

Newton's corpuscular theory of light (particles) and Huygens's wave theory
competed for roughly 150 years. Both could explain reflection and refraction
(Snell's law). They made opposite predictions about the speed of light in a
denser medium — corpuscular theory required it to be *faster*; wave theory
required it to be *slower*. Measurements eventually confirmed the slower-in-
dense-medium prediction, a decisive result favoring the wave theory.

But the full story is more complicated: Newton's theory also made detailed
predictions about color and polarization, some of which were productive;
and the wave theory had its own difficulties (what was waving? what was the
medium?).

---

## Central Question

Which observations actually force the decision between the two models?
And: could the corpuscular theory have been modified to survive any of them?

---

## Phenomena to Simulate

| Phenomenon | Corpuscular Prediction | Wave Prediction | Discriminating? |
|---|---|---|---|
| Reflection | Particle rebounds | Wave reflects at interface | No — both predict law of reflection |
| Snell's law | Particle speeds up in dense medium | Wave slows in dense medium | Yes (speed) |
| Diffraction | Not explained (or ad hoc) | Naturally predicted | Yes |
| Interference | Not explained | Central prediction | Yes |
| Polarization | Particle has "sides" (Newton's ad hoc) | Transverse wave property | Partially |
| Double refraction | Ad hoc | Wave with two speeds | Partially |
| Speed in dense medium | Faster | Slower | Yes (decisive) |

---

## Key Historical Sources

| Source | Date | Role |
|---|---|---|
| Newton, *Opticks* | 1704 | Primary source for corpuscular theory |
| Huygens, *Traité de la Lumière* | 1690 | Primary source for wave theory |
| Young, "On the Theory of Light and Colours" | 1802 | Interference experiment |
| Fresnel, *Mémoire sur la diffraction de la lumière* | 1818 | Wave theory formalized |
| Foucault, measurement of speed of light in water | 1850 | Decisive measurement |

---

## Implementation Notes

*To be developed. The refraction and interference simulations are
computationally straightforward. The speed-in-medium measurement is a
historical event that can be shown as an animated timeline.*
