# Experimental Archaeology for Ideas

**Computational reconstruction of historical scientific theories — executable,
honest, and exploratory.**

---

## Concept

This section of the portfolio is an exercise in intellectual honesty and
computational history of science. It belongs to an emerging research tradition
sometimes called *computational reconstruction of scientific theories*,
*executable history of science*, or, as we prefer here,
**experimental archaeology for ideas**.

The phrase is borrowed from physical archaeology, where researchers
reconstruct lost tools and techniques to understand how they actually worked —
not just what they claimed to do. Applied to the history of science, it means:
building runnable, honest models of superseded theories and asking what they
could and could not do, on their own terms, with their own evidence.

> **This project does not begin with:**
> *"Here is an old, foolish theory. Watch it fail."*
>
> **It begins with:**
> *"Here is the world as this theory imagined it. Given its assumptions,
> mathematics, instruments, and available observations — what did it explain?
> What did it predict? Where exactly did it break?"*

---

## Relationship to Other Sections

Experimental Archaeology overlaps with — but is distinct from — the rest of
this portfolio:

| Section | Focus |
|---|---|
| **AI Literacy Lab** | Critical thinking about modern AI systems |
| **Count Me In / Piano Lab** | Learning science applied to music cognition |
| **Experimental Archaeology** | Philosophy of science through executable models |

The archaeology section is more research-oriented and computationally intensive
than the other tools. Its primary audience is someone who already cares about
the history of science and wants to engage with it at a deeper level than
Wikipedia allows.

---

## The Central Questions

For every historical theory reconstructed here, we try to answer:

1. **Why did intelligent people accept this?**
   What phenomena could it actually explain? What observations supported it?

2. **Where exactly did it break?**
   Not a hand-wave at "it was wrong," but a precise diagnosis: internal
   inconsistency, empirical failure on specific observations, dependence on
   fine-tuned parameters, or ad hoc growth under pressure.

3. **What survived?**
   Scientific revolutions rarely throw away everything. Which mathematical
   relationships, which observational techniques, which conceptual moves
   persisted even after the theory's physical interpretation was abandoned?

4. **Could it have been repaired?**
   Counterfactual: was there a historically plausible modification that would
   have extended the theory's life? What would that modification have cost it
   in simplicity or explanatory scope?

---

## Four Reconstruction Modes

Each case study implements (where feasible) four distinct models of the
historical theory:

### 1. Historically Faithful Reconstruction
> Uses only the concepts, mathematics, parameters, and observations that were
> reasonably available at the time.

The goal is not to make the theory look good or bad. The goal is to understand
why a working scientist of that era would have found the theory compelling.
Answers the question: *How difficult was it to calculate predictions? Which
anomalies were already visible?*

### 2. Charitable Modern Reconstruction
> Formalizes ambiguous historical claims using modern mathematics while
> preserving the theory's underlying ontology and mechanism.

Many historical theories were expressed verbally, geometrically, or
incompletely. Simply coding the most literal interpretation can produce a
straw man. This mode asks: *What is the strongest coherent version of this
idea?*

### 3. Best-Fit Reconstruction
> Allows an optimizer to tune every parameter the theory legitimately possesses.

Then compares the optimized historical theory against its competitors on:
- prediction error
- number of adjustable parameters (model complexity)
- sensitivity to parameter perturbations
- computational cost
- generalization to data outside the fitting window

This distinguishes a theory that *fundamentally cannot work* from one that
merely had poor historical measurements or parameter estimates.

### 4. Counterfactual Extension
> Permits historically plausible modifications — changes that someone working
> within the theory's worldview could have made.

This is where the archaeology gets most interesting. Could this theory have
been repaired without abandoning its central worldview? If so, what observations
would have forced the hand even of a repaired version?

---

## What a Simulation Can Actually Demonstrate

A simulation is itself an interpretation of the theory. It cannot directly
prove that "the historical theory" was wrong. But it can establish more precise
claims:

| Finding | Meaning |
|---|---|
| **Internal failure** | The stated mechanism does not produce the claimed behavior |
| **Empirical failure** | Its predictions disagree with specific observations |
| **Fine-tuning** | It works only inside a narrow parameter range |
| **Ad hoc growth** | Every new observation requires another corrective mechanism |
| **Poor generalization** | Fits known data but fails on held-out data |
| **Explanatory survival** | Parts of its mathematics remain useful even after its physical interpretation is abandoned |

The last category is often the richest. Carnot's engine efficiency result
survived the death of caloric theory. Ptolemaic epicycle geometry is formally
related to the Fourier decomposition of orbital paths. Noticing these survivals
is part of what makes the project intellectually worthwhile.

---

## The Assumption Ledger

Every reconstruction must explicitly track the source and confidence of every
claim it encodes. Without this discipline, modern assumptions quietly enter the
code and cause the historical theory to fail for reasons that have nothing to do
with the original idea.

Each encoded claim carries one of the following confidence markers:

| Marker | Meaning |
|---|---|
| `EXPLICIT` | Directly stated in the primary historical source |
| `HISTORICAL` | Standard interpretation among historians of science |
| `RECONSTRUCTION` | Necessary mathematical formalization of an ambiguous claim |
| `EXTENSION` | Modern charitable extension, preserving the theory's ontology |
| `COUNTERFACTUAL` | Speculative modification beyond what any historical figure proposed |

The interface exposes these markers to the reader. Uncertainty is not a bug to
be hidden; it is part of the intellectual content of the experiment.

---

## Reusable Architecture

Rather than building every reconstruction as a separate custom application,
all case studies share a common interface. Conceptually, each theory exposes:

```
Theory
├── ontology        What entities exist in this theory's world?
├── state           What variables describe the system at an instant?
├── dynamics        How does the state evolve over time?
├── parameters      What can be adjusted? What did the historical figure adjust?
├── observables     What would a contemporary instrument actually measure?
├── domain          Where is the theory intended to apply?
├── evidence        What observations originally supported it?
├── anomalies       What did it struggle to explain, even internally?
└── sources         Where does each claim come from? (→ Assumption Ledger)
```

Every computational theory exposes:

```python
def predict(initial_state, parameters, times) -> Predictions
def fit(observations, allowed_parameters) -> FittedParameters
def measure(simulated_state, instrument_model) -> Observables
def score(predictions, observations) -> Metrics
def explain_assumptions() -> AssumptionLedger
```

This allows the same comparison tools, the same residual plots, and the same
parameter-sensitivity analysis to work across astronomy, optics, mechanics,
thermodynamics, and potentially biology or economics.

---

## Interface Design Principles

Every reconstruction page uses a synchronized four-panel layout:

1. **Physical picture** — the theory's internal model of the world
   (e.g., Earth-centered vs. Sun-centered motion, with all mechanisms visible)

2. **Observable sky / instrument** — what a contemporary observer would
   actually have seen or measured (deliberately separated from the physical
   picture to avoid conflating the two)

3. **Residual plot** — predicted values minus observed values, over time
   or across the parameter space

4. **Historical context** — dated excerpts, instrument descriptions,
   available observations, known anomalies, and contemporary objections

A **knowledge-date switch** lets users evaluate a theory using only evidence
available before a selected year, rather than immediately judging it against
everything known today. This is the closest the interface can get to
reconstructing epistemic position rather than just physical position.

---

## Planned Case Studies

Studies are listed roughly in order of planned development. All are subject to
revision as actual implementation reveals what is and is not computationally
tractable.

| # | Topic | Central Question | Status |
|---|---|---|---|
| 1 | [Ptolemy, Copernicus & Kepler](case_studies/ptolemy_copernicus_kepler.md) | What did each model explain, and which observations actually discriminated among them? | Planned |
| 2 | [Caloric Theory & Carnot](case_studies/caloric_theory.md) | How could an incorrect theory of heat produce a correct result about heat engines? | Planned |
| 3 | [Corpuscular vs. Wave Theories of Light](case_studies/corpuscular_vs_wave_light.md) | Which observations forced the decision, and why did it take so long? | Planned |
| 4 | [Cartesian Vortex Cosmology](case_studies/cartesian_vortices.md) | Can a fluid vortex generate stable approximately-Keplerian orbits? | Planned |
| 5 | [Luminiferous Ether — a Family Tree](case_studies/luminiferous_ether.md) | Can successive ether modifications survive Michelson-Morley? | Planned |
| 6 | [Le Sage Mechanical Gravity](case_studies/le_sage_gravity.md) | How far does a push-gravity particle model go before it breaks on drag and heating? | Planned |

---

## Routes

```
/experimental-archaeology/              — Landing page (case study index)
/experimental-archaeology/<slug>/       — Individual case study (interactive)
/experimental-archaeology/about         — This concept document, rendered
```

---

## Key Files

```
docs/experimental_archaeology/
  README.md                                 — This file (concept & architecture)
  case_studies/
    ptolemy_copernicus_kepler.md            — Case study 1 design doc
    caloric_theory.md                       — Case study 2 design doc
    corpuscular_vs_wave_light.md            — Case study 3 design doc
    cartesian_vortices.md                   — Case study 4 design doc
    luminiferous_ether.md                   — Case study 5 design doc
    le_sage_gravity.md                      — Case study 6 design doc

portfolio/routes/experimental_archaeology.py  — Blueprint and metadata
portfolio/static/css/experimental_archaeology.css
portfolio/templates/experimental_archaeology/
  index.html                               — Case study landing page
  case_study.html                          — Interactive reconstruction shell
  panels/
    physical.html                          — Physical picture panel
    observable.html                        — Observable sky / instrument panel
    residuals.html                         — Residual plot panel
    context.html                           — Historical context panel
portfolio/static/js/experimental_archaeology/
  theory_runner.js                         — Core simulation runner
  assumption_ledger.js                     — Ledger rendering
  panels.js                                — Synchronized panel controller
  models/
    ptolemy.js
    copernicus.js
    kepler.js
    caloric.js
    carnot.js
```

---

## Design Aesthetic

This section takes a deliberately different visual language from the rest of
the portfolio. Where the AI Literacy Lab uses Windows XP nostalgia and the
music tools use dark neon, Experimental Archaeology uses an aesthetic inspired
by:

- Astronomical atlases and star charts (Bayer's *Uranometria*, Flamsteed's *Atlas Coelestis*)
- 18th-century scientific instrument diagrams
- Marginalia and annotated manuscript pages
- Scientific illustration (cross-section drawings, mechanical diagrams)

Palette: deep parchment backgrounds, iron-gall ink text, brass and verdigris
accent colors, subtle vellum texture. Motion is deliberate and slow — orbital
animation speeds, not game speeds.

Typography: a serif for body text (the project will use a historically-adjacent
serif, possibly Libre Baskerville or IM Fell English from Google Fonts for
running prose, with a geometric monospace for data and code).

---

## Intellectual Framing

This project sits at the intersection of:

- **History of science** (primary sources, instrument knowledge, epistemic context)
- **Philosophy of science** (theory change, underdetermination, explanatory structure)
- **Computational simulation** (numerical integration, parameter fitting, residual analysis)
- **Science communication** (making these arguments accessible without flattening them)

It is explicitly *not* a project about debunking old theories. It is a project
about understanding what it is for a theory to work — and what it means for
one to break.

The goal is for a thoughtful reader to come away thinking not "those people
were foolish" but "science is harder than I thought, and more interesting."
