# Discovery Compression

**Computational investigation of the earliest possible dates for scientific discoveries —
and what that tells us about what we cannot yet see.**

---

## Concept

This project asks the inverse question to Experimental Archaeology.

**Experimental Archaeology** starts with a superseded theory and asks:
*"How did this wrong model explain the world on its own terms?"*

**Discovery Compression** starts with a true modern theory and asks:
*"What is the earliest year in history when a rigorous investigator,
using only the tools, observations, materials, and mathematics available
at that time — but knowing where to look — could have obtained compelling
evidence for at least one of this theory's important structural claims?"*

That date — the **earliest testable year** — is what we call the
**discovery horizon** of a theory.

> **Not asked:** *"Given the old theory, why did it fail?"*
>
> **Asked instead:** *"Given the true modern theory, how far back in history
> could someone have discovered at least part of it, provided they knew
> where to look?"*

---

## Why This Question Is Different

Most history of science runs in the natural direction: forward from what
people knew to what they discovered. Discovery Compression runs backward
from what we know now to the earliest moment it was reachable.

This produces a rigorous distinction between three different historical dates
for every major idea:

| Date | Meaning |
|---|---|
| **First observable date** | When the relevant phenomenon could have been noticed with existing instruments |
| **First testable date** | When available tools could distinguish competing explanations with adequate precision |
| **First comprehensible date** | When the necessary mathematical or conceptual framework existed to interpret the result |

These dates can be centuries apart. A person may detect a relationship
without understanding its mechanism — that happened repeatedly in science,
and the gap between detection and comprehension is one of the most
interesting objects the project studies.

The gap between the **first testable date** and the **actual discovery date**
is what we call the **compression gap**. It measures how much earlier a
discovery *could* have happened — and raises the question of what actually
caused the delay.

---

## The Formal Core

For a theory T and a calendar year y, define the **historical capability inventory**:

```
A_y = { instruments, materials, mathematics, observations,
        manufacturing, communication, institutional organization }
```

For each year y, we ask whether there exists an experiment *e*, buildable
from *A_y*, whose results would substantially distinguish T from the plausible
competing theories of that time. The **discovery horizon** is:

```
y*(T) = min y [ ∃ e ∈ A_y  such that  e strongly discriminates T ]
```

`y*(T)` is *not* the year when someone could have developed the complete
modern theory. It is the earliest point when they could have obtained
compelling evidence for one of its important structural claims.

That distinction matters. An experiment rarely tests a theory in isolation.
It also depends on assumptions about instruments, initial conditions,
measurement procedures, and background theories. A result may eliminate
one model without uniquely establishing the modern replacement.

---

## The Minimum-Hint Experiment

The distinctive core of this project is the **minimum-hint experiment**:
for each theory, what is the smallest piece of information a historical
researcher would need in order to discover the phenomenon substantially earlier?

We define six intervention levels:

| Level | Name | Description |
|---|---|---|
| **0** | No hint | Only actual literature and tools of the period |
| **1** | Attention hint | *"Compare these two groups"* — where to look |
| **2** | Measurement hint | *"Measure this specific variable"* — what to track |
| **3** | Experimental hint | The experimental design, but not the explanation |
| **4** | Structural hint | The mathematical relationship |
| **5** | Ontological hint | What hidden entities exist |
| **6** | Full theory | Complete modern equations, mechanism, and interpretation |

For each theory, we estimate how much of the modern result a historical
researcher could recover at each level. This turns a philosophical question
into a computational one:

> **How many bits of hindsight are needed to move a discovery
> backward by 10, 50, or 500 years?**

This quantity is **discovery compression**.

---

## The Hindsight-Leak Problem

The hardest discipline in this project is preventing smuggled modern knowledge.

Any proposed "early experiment" must be audited for hidden dependencies on:

- Purified materials unavailable at the time
- Modern statistical conventions
- Modern units or calibration standards
- Knowledge of *where* to look (a planet's location, a fossil site, a gene) that is only available in hindsight
- Instruments that could theoretically be built but whose construction presupposes later engineering knowledge
- Modern distinctions between variables that historical researchers treated as one phenomenon

Without this discipline, the project continuously smuggles the answer into
the setup of the experiment. The **Hindsight-Leak Detector** is a required
component of every study.

---

## Four System Components

Each study is built around four components:

### 1. Historical Capability Model (`A_y`)

For a selected year, describes:

- Measurable quantities and their precision (distances, times, temperatures, masses, angles, voltages)
- Expected instrument noise floors and systematic errors
- Available materials and manufacturing tolerances
- Accessible geographical regions and field sites
- Available mathematical techniques
- Data storage and communication capacity
- Realistic institutional organization and sample sizes

Social and institutional constraints are first-class components.
An experiment requiring twenty observatories to standardize measurements
for forty years may be technically possible but institutionally implausible.

### 2. Theory Compiler

Translates the modern theory into observable predictions that do not
require modern instruments or conceptual vocabulary.

The chain is:
```
hidden mechanism  →  intermediate process  →  period-measurable observable
```

For example: rather than asking an eighteenth-century researcher to detect DNA,
the compiler searches for macroscopic consequences of discrete inheritance
(count the offspring categories; look for fixed numerical ratios).

### 3. Experiment Search

Searches the historically feasible experiment space for optimal designs:

```
S(e) = expected discrimination among theories
       ────────────────────────────────────────
       cost + duration + measurement difficulty
```

The goal is not the most precise experiment. It is the **cheapest historically
possible experiment that changes what a reasonable observer should believe**.

### 4. Hindsight-Leak Detector

Audits every proposed experiment for smuggled modern knowledge. Flags:

- Anachronistic materials
- Modern statistical procedures
- Calibration dependencies on later science
- Hidden use of modern spatial or conceptual maps

---

## Planned Studies

Studies are listed roughly in order of planned development. Each study
produces a complete design document before implementation begins.

| # | Study | Modern Theory | Estimated Horizon | Min-Hint Level |
|---|---|---|---|---|
| 1 | [Discrete Inheritance](studies/discrete_inheritance.md) | Mendelian genetics | ~500 BCE | Level 2 (measurement) |
| 2 | [Transmissible Infection](studies/transmissible_infection.md) | Germ theory | ~1000 CE | Level 1 (attention) |
| 3 | [Greenhouse Warming](studies/greenhouse_warming.md) | Radiative forcing / CO₂ absorption | ~1750 CE | Level 2 (measurement) |
| 4 | [Molecular / Atomic Motion](studies/molecular_motion.md) | Kinetic theory / Brownian statistics | ~1700 CE | Level 3 (experiment) |
| 5 | [Continental Motion](studies/continental_motion.md) | Plate tectonics | ~1850 CE | Level 1 (attention) |
| 6 | [Relativistic Invariance](studies/relativistic_invariance.md) | Special relativity | ~1880 CE | Level 5 (ontological) |

---

## What This Teaches Us About the Present (2026 → 2126)

The forward-looking purpose of this project is to identify the **structural
signatures of the "discoverable but undiscovered"** — and then search for
those same signatures in modern science.

The past becomes a controlled dataset of discoveries whose answers we already know.
We use it to learn what "discoverable but undiscovered" looks like. Then we search
for those signatures in modern science.

Five candidate blind spots recur across historical delays:

### 1. Averaging Away the Signal
Mendelian patterns become visible when offspring are **categorized** rather
than averaged. Today there may be systems where population means erase:
subtypes, phase transitions, rare states, individual response patterns,
or mixtures of mechanisms. The future discovery may not require a better
instrument — it may require refusing to collapse heterogeneous observations
into one mean.

### 2. Classifying Related Phenomena as Separate Subjects
Plate tectonics unified earthquakes, volcanoes, ridges, trenches, mountain
formation, paleomagnetism, and continental geometry as one system. Our current
blind spot may similarly exist between disciplines whose databases, vocabulary,
and professional communities are separated. A useful sub-project: search for
identical mathematical patterns appearing under different names in different fields.

### 3. Treating Signal as Noise
Brownian motion is the model case. Irregular movement was not merely interference
obscuring the phenomenon; the fluctuation itself contained evidence about
invisible molecular activity. Information may currently be discarded through
smoothing, averaging, baseline correction, outlier removal, or preprocessing
pipelines. A future historian should always ask: *what physical model would
make the residuals meaningful?*

### 4. Measuring the Convenient Rather Than the Discriminating
Two theories can make nearly identical predictions under ordinary conditions.
More observations under those conditions add almost no information. The important
experiment changes the system so the theories diverge. Computational strategy:
represent competing models, search possible boundary conditions, identify where
predictions differ most, design the smallest experiment in that region.

### 5. Possessing the Equations but Misunderstanding the Ontology
Carnot extracted deep thermodynamic structure within caloric theory.
Lorentz transformations existed before their spacetime interpretation.
Mathematical structures can succeed even when the story about what exists is wrong.
A future theory may retain much of our mathematics while radically changing
what we believe its variables represent.

---

## Relationship to Experimental Archaeology

These two projects are companion laboratories under a shared philosophical umbrella:

| | Experimental Archaeology | Discovery Compression |
|---|---|---|
| **Starting point** | A wrong theory | A true theory |
| **Direction** | Forward: simulate the old theory, watch it fail | Backward: when was the truth first reachable? |
| **Central output** | Executable models of superseded physics | Discovery horizon y*(T) + minimum-hint experiment |
| **Formal core** | Theory interface + Assumption Ledger | Capability inventory A_y + Hindsight-Leak Detector |
| **Forward-looking** | No — historically grounded | Yes — the 2126 component is the whole point |

They share infrastructure: historical capability inventories, counterfactual
reasoning, the assumption ledger concept, and the vocabulary of experimental
discrimination. A study in either lab benefits from work in the other.

---

## Routes (Planned)

```
/discovery-compression/              — Landing page (study index + concept)
/discovery-compression/<slug>/       — Individual study (interactive)
/discovery-compression/about         — This concept document, rendered
```

---

## Key Files

```
docs/discovery_compression/
  README.md                                 — This file (concept & architecture)
  studies/
    discrete_inheritance.md                 — Study 1: Mendelian genetics
    transmissible_infection.md              — Study 2: Germ theory
    greenhouse_warming.md                   — Study 3: Radiative forcing
    molecular_motion.md                     — Study 4: Kinetic theory
    continental_motion.md                   — Study 5: Plate tectonics
    relativistic_invariance.md              — Study 6: Special relativity

portfolio/routes/discovery_compression.py   — Blueprint and metadata (future)
portfolio/static/css/discovery_compression.css
portfolio/templates/discovery_compression/
  index.html
  study.html
  panels/
    capability_model.html                   — A_y inventory panel
    experiment_search.html                  — Optimal experiment panel
    horizon_plot.html                       — y*(T) timeline panel
    hindsight_audit.html                    — Hindsight-leak audit panel
portfolio/static/js/discovery_compression/
  capability_model.js
  theory_compiler.js
  experiment_search.js
  hindsight_detector.js
  study_runner.js
```

---

## Design Aesthetic

Discovery Compression shares the parchment / atlas aesthetic of Experimental
Archaeology (they are companion projects), but emphasizes **timeline and
inventory** rather than orbit and residuals.

Key visual elements:
- A horizontal discovery timeline as the primary navigation metaphor
- Capability inventory cards (for each year, what was measurable)
- A "compression dial" showing how many hint levels are needed
- The three-date system visualized as overlapping bands on the timeline

---

## Intellectual Framing

This project sits at the intersection of:

- **Counterfactual history of science** (what could have been discovered, and when)
- **Philosophy of experiment** (what does an experiment actually establish?)
- **Computational epistemology** (formalizing "what a reasonable observer should believe")
- **Future-oriented science studies** (using the past as a dataset to understand present blindspots)

The central question of the whole project:

> *How often is scientific ignorance caused by an inability to observe —
> and how often is it caused by an inability to imagine the observation
> that would matter?*
