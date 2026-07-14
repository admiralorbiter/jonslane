# Case Study 1: Ptolemy, Copernicus, and Kepler

**Planetary Astronomy — From Deferents and Epicycles to Elliptical Orbits**

---

## Overview

The Ptolemy–Copernicus–Kepler sequence is close to ideal as a first
reconstruction. The mathematical machinery is feasible to implement in a
browser (existing interactive Ptolemaic simulations prove the geometry works).
The historical record is unusually rich. The case raises nearly every
philosophically interesting question about theory change in a single, legible
narrative.

More importantly, the transition from Ptolemy to Kepler was not a single
decisive refutation. It was a long, contested negotiation among predictive
accuracy, computational convenience, physical plausibility, and theological
concern. A simulation that can show this in motion — rather than declaring a
winner from the outside — is the goal.

---

## Historical Context

### Ptolemy (c. 150 CE)
The *Almagest* is among the most sophisticated scientific documents of the
ancient world. Ptolemy's system was not a crude Earth-at-center-with-circles
model. It was a carefully engineered predictive framework using:

- **Deferents**: Large circles centered near (but not exactly at) the Earth
- **Epicycles**: Smaller circles rolling on the deferent
- **Eccentrics**: Displaced centers to account for varying orbital speeds
- **The Equant**: The most controversial element — a point from which the
  epicycle center appears to move at constant angular velocity, even though
  it is not the geometric center. This was mathematically effective but
  violated Aristotelian principles of uniform circular motion.

The system required roughly 40–80 parameters (depending on how one counts)
across all visible planets. It was predictively competitive with Copernicus
for over a millennium.

**Key observation**: Retrograde motion — planets appearing to reverse their
motion against the fixed stars — was explained by the epicycle geometry as
the planet rounds the near side of its epicycle. This was geometrically correct
*in terms of appearance*, even with the wrong physical picture.

### Copernicus (1543, *De revolutionibus orbium coelestium*)
Copernicus moved the center to the Sun but retained:
- Circular orbits
- Epicycles (a smaller number, but still present)
- Eccentrics

He explicitly rejected the Equant on philosophical grounds (uniform circular
motion), which actually *worsened* his short-term predictive accuracy compared
to Ptolemy on some planets.

**Key observation**: Heliocentrism did not immediately improve numerical
accuracy. Its initial advantage was conceptual — it naturally explained *why*
inferior planets (Mercury, Venus) always appear near the Sun, and gave a
principled ordering of the planets by orbital period. Ptolemy's system could
mimic these appearances but required it as an additional assumption.

### Kepler (1609–1619, *Astronomia Nova*, *Harmonices Mundi*)
Kepler had access to Tycho Brahe's unprecedentedly precise naked-eye observations.
His three laws replaced both epicycles and equants:

1. **Orbits are ellipses** with the Sun at one focus
2. **Equal areas are swept in equal times** (conservation of angular momentum,
   though Kepler did not frame it this way)
3. **T² ∝ a³** — the orbital period squared is proportional to the semi-major
   axis cubed

Kepler's model has ~6 parameters per planet (shape, size, and orientation of
the ellipse, plus epoch). It generalized correctly to new planets and comets.
It was the first system that could be derived from a single physical law
(Newton's gravity, a generation later).

---

## Research Questions for this Reconstruction

The reconstruction will address these questions empirically, not rhetorically:

1. **Accuracy**: How closely does each model reproduce the apparent ecliptic
   longitude of Mars over a 20-year test window? (Mars was historically most
   diagnostic because its eccentricity is large enough to expose circular-orbit
   models.)

2. **Parameter count**: How many independently adjustable parameters does each
   model use for Mars alone? What is the prediction error per parameter?

3. **Noise sensitivity**: How do the predictions degrade when input observations
   are perturbed by ±5 arcminutes (a plausible pre-telescopic measurement error)?

4. **Extrapolation**: If fitted on 1580–1590 Tycho data, how well does each
   model predict the 1595–1600 positions?

5. **Optimization question**: What is the minimum prediction error achievable
   by a Ptolemaic model with optimally tuned parameters? Does it approach
   Keplerian accuracy? (A modern analysis of Ptolemy's system suggests
   substantially improved accuracy was available with different parameter choices.)

6. **Discriminating observations**: Which specific observations actually
   separate the three models' predictions? Which are compatible with all three?

7. **Knowledge-date question**: Evaluated *only* on data available before
   Tycho's observations (pre-1580), how do the three models compare?

---

## Model Specifications

### Model A: Ptolemaic (Historically Faithful)

**Entities**: Earth at approximate center; Moon, Sun, Mercury, Venus, Mars,
Jupiter, Saturn on deferents with epicycles.

**State variables per planet**:
- Deferent center position (offset from Earth = eccentric)
- Deferent radius `R`
- Deferent angular velocity `ω_d`
- Deferent phase `φ_d`
- Epicycle radius `r`
- Epicycle angular velocity `ω_e`
- Epicycle phase `φ_e`
- Equant offset distance `e_q`

**Observables**: Ecliptic longitude and latitude as seen from Earth.

**Assumption ledger notes**:
- `EXPLICIT`: Deferent + epicycle structure (Almagest Book III–VI)
- `EXPLICIT`: Equant construction (Almagest Book IX)
- `RECONSTRUCTION`: Numerical parameter values — we use Ptolemy's own tabulated
  values (converted from sexagesimal notation) as the historically faithful
  baseline, then allow optimization to explore the parameter space
- `EXTENSION`: Modern floating-point arithmetic (Ptolemy used sexagesimal
  approximations with bounded precision)

### Model B: Copernican (Historically Faithful)

**Entities**: Sun at approximate center (eccentric, not exact); Earth and
planets on deferents with small epicycles.

**State variables**: Similar to Ptolemaic but reorganized with Sun-centered
geometry. Note: Copernicus retained a small epicycle for Earth itself to
account for the varying eccentricity he believed he observed.

**Assumption ledger notes**:
- `EXPLICIT`: Heliocentric ordering and orbital periods (*De revolutionibus* Book I)
- `EXPLICIT`: Elimination of the equant (and the philosophical motivation for it)
- `HISTORICAL`: The Copernican model is sometimes presented as "simpler" —
  this is an interpretive claim. The raw parameter count is comparable to Ptolemy.
  The simplicity was architectural (one center for all planets), not numeric.

### Model C: Keplerian (Historically Faithful)

**Entities**: Sun at one focus of each planet's ellipse.

**State variables per planet**:
- Semi-major axis `a`
- Eccentricity `e`
- Inclination `i`, longitude of ascending node `Ω`, argument of perihelion `ω`
- Mean anomaly at epoch `M₀`

**Dynamics**: Kepler's equation `M = E - e·sin(E)` (solved numerically);
true anomaly from eccentric anomaly; position from orbital elements.

**Observables**: Ecliptic longitude/latitude computed via heliocentric-to-
geocentric transformation.

**Assumption ledger notes**:
- `EXPLICIT`: All three laws (*Astronomia Nova* and *Harmonices Mundi*)
- `RECONSTRUCTION`: We use modern orbital element values (the Keplerian
  "historically faithful" model uses parameters Kepler actually derived,
  which are slightly different from modern best-fit values)
- `EXTENSION`: Matrix rotation for coordinate transformation (Kepler used
  geometric constructions)

---

## Interface Design

### Four Synchronized Panels

**Panel 1 — Physical Picture**
An animated orrery. The user can switch between geocentric and heliocentric
reference frames. All mechanisms are visible: epicycle arms rotate, equant
point is marked, ellipse is drawn with semi-latus rectum marked. Speed control
(1× to 1000× real time).

**Panel 2 — Observable Sky**
A strip of the ecliptic showing each model's predicted position of Mars (or
the selected planet) as a colored dot. Observed historical positions (from
Tycho or earlier sources) shown as white crosses. The gap between dot and cross
is the residual, displayed as a live arc-minute readout.

**Panel 3 — Residual Plot**
A time-series chart of (predicted − observed) in ecliptic longitude, for all
three models simultaneously. X-axis: calendar year. Y-axis: error in arcminutes.
One colored line per model. A horizontal band shows ±5 arcminutes (the
approximate limit of pre-telescopic measurement).

**Panel 4 — Historical Context**
A scrollable column showing:
- The dated observation currently being evaluated
- What instrument produced it (naked eye, quadrant, armillary sphere)
- The contemporary state of knowledge (which anomalies were already known)
- Relevant excerpt from the primary source

**Knowledge-Date Switch**: A slider from 100 CE to 1620 CE. When moved, the
residual plot and context panel update to show only observations available
before that date. The physical picture still animates; only the evidence
available for evaluation changes.

### Control Panel

```
Model visibility toggles:  [✓ Ptolemy]  [✓ Copernicus]  [✓ Kepler]
Planet selector:           [Mars ▾]
Mode:                      [Historical] [Optimized] [Counterfactual]
Knowledge date:            [◄──────────────────────►] 1543
Speed:                     [◄──────────────────────►] 100×
```

---

## Counterfactual Analysis

The counterfactual question for Ptolemy is: how close to Keplerian accuracy
could an optimized Ptolemaic model get?

A published analysis (Strobel, 2013, and related computational work) found
that a Ptolemaic model with optimally re-tuned equant offsets and epicycle
radii achieves substantially lower error on Mars than Ptolemy's own parameter
choices — but still significantly worse than Kepler for the full orbital period.

Our reconstruction will:
1. Reproduce this finding
2. Display which observations force the Ptolemaic model into error even at
   its best
3. Show what a "repaired" Ptolemaic model (e.g. adding a second small epicycle
   per planet, as some post-Ptolemaic astronomers did) achieves

The counterfactual for Copernicus is more dramatic: the Copernican model fitted
on pre-Tycho data is comparable to Ptolemy in accuracy. It took Tycho's
precision — and Kepler's willingness to abandon circles — for the heliocentric
advantage to become numerically unambiguous.

---

## Key Historical Sources

| Source | Date | Role |
|---|---|---|
| Ptolemy, *Almagest* | c. 150 CE | Primary source for Model A parameters |
| Copernicus, *De revolutionibus* | 1543 | Primary source for Model B |
| Kepler, *Astronomia Nova* | 1609 | Primary source for Model C and its derivation |
| Tycho Brahe, *Astronomiae instauratae progymnasmata* | 1602 | Observation dataset |
| Owen Gingerich, *The Book Nobody Read* | 2004 | Historiography: reception of Copernicus |
| James Evans, *The History and Practice of Ancient Astronomy* | 1998 | Technical Ptolemaic reconstruction guide |
| Swerdlow & Neugebauer, *Mathematical Astronomy in Copernicus's De revolutionibus* | 1984 | Definitive Copernican parameter source |

---

## Implementation Notes

### Language and Libraries
- **Frontend**: Vanilla JavaScript + Canvas API for the orrery and sky strip.
  Plotly.js or Chart.js for the residual time-series.
- **Computation**: Keplerian solver runs in a Web Worker to avoid blocking
  the animation loop. Ptolemaic solver is lighter and can run on the main thread.
- **Parameter fitting**: A simple gradient-free optimizer (Nelder–Mead or
  differential evolution) implemented in JS for the "Optimized" mode.

### Data Sources
Historical planetary positions for comparison will be computed from modern
ephemeris data (JPL Horizons) back-computed to historical dates, then used as
"ground truth" against which all three models are evaluated. This is a
`MODERN` annotation — we are evaluating the models against modern measurements,
not against Tycho's original handwritten tables (though we note the difference).

For the historically faithful evaluation, Tycho's published observations
(available in digitized form) will be used as the comparison dataset, with
their known measurement errors documented.

### Numerical Precision
Ptolemaic sexagesimal notation will be converted using documented conversion
tables. The precision limit of the historical computation (roughly ±1–2
arcminutes for a careful Ptolemaic calculation) will be simulated by adding
appropriate rounding noise to the historically faithful model.

---

## What We Expect to Find

Based on prior computational work in this area:

1. The historically faithful Ptolemaic and Copernican models will be roughly
   comparable in accuracy on Mars (~10–30 arcminute RMS error depending on
   the evaluation window).

2. The optimized Ptolemaic model will improve substantially (perhaps to ~5–8
   arcminutes) but will not converge to Keplerian accuracy (~1–2 arcminutes).

3. The discriminating observations will cluster around Mars's perihelion and
   aphelion passages, where the equant approximation breaks down most visibly.

4. The Copernican model's "simplicity" advantage will appear most clearly in
   the architectural structure (natural orbital ordering, linked inferior-planet
   motion) rather than in raw prediction error.

5. Kepler's advantage will be dramatic only when evaluated on data of Tychonic
   precision — pre-Tycho, the models are closer to each other.

These are predictions to be tested, not conclusions to be illustrated.
