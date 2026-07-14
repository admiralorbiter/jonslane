# Case Study 5: Luminiferous Ether — A Family Tree

**From Stationary Ether to Special Relativity — The Modification Problem**

---

## Status: Planned

This document is a design stub. It will be expanded into a full specification
before implementation begins.

---

## Overview

The luminiferous ether was not a single theory but a family of theories, each
adapting to new experimental pressure. Instead of presenting "the ether as
wrong," this case study constructs the family tree of ether models and shows
which experiments ruled out which members.

The central lesson: a theory can be repeatedly modified to survive new
observations, raising deep questions about when modification becomes ad hoc
and when it is legitimate scientific response to evidence.

---

## The Ether Family Tree

```
Stationary Ether (Fresnel, partial drag)
    │
    ├─ Failed: stellar aberration inconsistency with full drag
    │
    ▼
Partial Drag Ether
    │
    ├─ Failed: Michelson-Morley (1887) — no fringe shift
    │
    ▼
Lorentz-FitzGerald Contraction (moving objects contract in ether direction)
    │
    ├─ Survived: Michelson-Morley
    ├─ Survived: Kennedy-Thorndike (1932)
    ├─ Failed: Ives-Stilwell (1938) — time dilation confirmed
    │
    ▼
Lorentz Ether Theory
    │
    ├─ Empirically equivalent to Special Relativity (same predictions)
    ├─ Failed: simplicity, explanatory structure, no preferred frame detectable
    │
    ▼
Special Relativity (ether operationally eliminated)
```

---

## Central Question

At each branch in the tree: what experiment ruled out that version? And:
is there a version of ether theory that survives *all* experiments — and if
so, what makes it distinct from special relativity?

The answer is interesting: Lorentz ether theory is empirically equivalent
to special relativity. It cannot be ruled out by experiment alone. It is
ruled out (to the extent it is) by considerations of simplicity and
explanatory structure — which are not purely empirical considerations.

---

## Virtual Michelson-Morley Interferometer

The centerpiece of this case study: an interactive interferometer that displays
the expected fringe shift under each ether model's assumptions, plus the
observed (null) result.

Controls:
- Earth velocity relative to ether: `v = 30 km/s` (orbital speed)
- Arm length: adjustable
- Expected fringe shift: computed per model
- Lorentz contraction: toggle on/off
- Time dilation: toggle on/off

---

## Key Historical Sources

| Source | Date | Role |
|---|---|---|
| Michelson & Morley, "On the Relative Motion of the Earth and Luminiferous Ether" | 1887 | Central experiment |
| FitzGerald, letter to *Science* | 1889 | Contraction hypothesis |
| Lorentz, *Versuch einer Theorie der electrischen und optischen Erscheinungen* | 1895 | Lorentz ether theory |
| Einstein, "On the Electrodynamics of Moving Bodies" | 1905 | Special relativity |
| Janssen, Michel, "Reconsidering a Scientific Revolution" | 2002 | Philosophical analysis of Lorentz vs. Einstein |

---

## Implementation Notes

*The interferometer simulation is computationally lightweight — it is
essentially a calculation of path length differences. The main work is in
the UI: clearly showing different ether models' predictions side by side
against the observed null result.*
