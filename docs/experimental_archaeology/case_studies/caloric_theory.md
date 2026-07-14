# Case Study 2: Caloric Theory and Carnot's Engine

**Heat as a Fluid — How a Wrong Ontology Produced a Right Result**

---

## Overview

This case study may be the single most philosophically rich in the collection.
Caloric theory treated heat as a conserved, weightless fluid that flowed between
bodies and could not be created or destroyed. It was a serious, productive
scientific framework — not a naive superstition — and its leading practitioners
included Lavoisier, Laplace, and Poisson.

The theory collapsed when Joule (building on earlier work by Rumford, Mayer,
and Helmholtz) demonstrated a fixed mechanical equivalent of heat,
establishing that heat could be created from work and vice versa. Heat was
not conserved; energy was.

But here is the puzzle this case study is built around: **Sadi Carnot derived
his result about the maximum efficiency of heat engines using caloric theory.**
His 1824 *Réflexions sur la puissance motrice du feu* contained the argument
that later became foundational for the second law of thermodynamics — an
argument developed under an incorrect theory of what heat fundamentally is.

The result survived. The theory did not. Understanding *why* is the point.

---

## Historical Context

### Caloric Theory (c. 1780–1850)
Developed largely by Lavoisier, who included "caloric" in his table of chemical
elements as a conserved, imponderable (massless) fluid. Key features:

- **Conservation**: Heat (caloric fluid) is neither created nor destroyed, only
  transferred
- **Repulsion**: Caloric particles repel each other but are attracted to ordinary
  matter — this explained thermal expansion (more caloric → particles pushed further)
- **Specific heat**: Different materials hold different amounts of caloric per
  unit temperature rise
- **Latent heat**: Caloric hidden in phase changes (ice → water without
  temperature rise = caloric absorbed but "latent")
- **Thermal equilibrium**: Caloric flows from high concentration (high temperature)
  to low concentration until equalized

Successes of caloric theory:
- Correctly predicted thermal conduction qualitatively
- Laplace used caloric to give a better account of the speed of sound than
  Newton's isothermal calculation
- Poisson derived the adiabatic relations using caloric arguments
- Correctly described many heat-capacity phenomena

Problems that emerged:
- Rumford's cannon-boring experiments (1798): drilling iron produced apparently
  unlimited heat — hard to explain if caloric is finite and conserved
- Gay-Lussac's free expansion experiments: gas expanding into vacuum showed
  no temperature change — caloric theory predicted it should
- The mechanical equivalent of heat (Joule, 1843–1850): quantitative
  demonstration of conversion between mechanical work and heat

### Sadi Carnot (1824, *Réflexions sur la puissance motrice du feu*)
Carnot asked a deceptively simple question: What is the maximum work a heat
engine can produce from a given quantity of heat?

His argument, stated in caloric terms:
- A heat engine works by allowing caloric to "fall" from a hot reservoir to a
  cold reservoir, analogous to water falling over a mill wheel
- Work is extracted from this fall without destroying caloric (conservation)
- Maximum efficiency is achieved by a reversible engine — one that can be run
  backwards as a refrigerator without any dissipation
- This maximum efficiency depends **only** on the temperatures of the two
  reservoirs, not on the working fluid or engine design

The efficiency formula for a Carnot engine:
$$\eta = 1 - \frac{T_{\text{cold}}}{T_{\text{hot}}}$$

(where temperatures are on an absolute scale — Carnot did not have Kelvin's
absolute temperature scale yet, but his argument implicitly required it)

**The puzzle**: Carnot's proof assumed caloric was conserved (the same amount
of caloric flows out at the cold end as flows in at the hot end — no caloric
is consumed). In modern thermodynamics, heat is *not* conserved — energy is.
Yet the efficiency formula is exactly correct.

### Resolution in Modern Thermodynamics
Clausius and Kelvin (1850s) preserved Carnot's result while abandoning caloric
conservation:

- A heat engine takes in heat `Q_hot` at the hot reservoir
- It converts some to work `W`
- It dumps heat `Q_cold` at the cold reservoir
- Energy conservation (first law): `Q_hot = W + Q_cold`
- Carnot efficiency: `η = W/Q_hot = 1 - Q_cold/Q_hot = 1 - T_cold/T_hot`
- Clausius introduced entropy to formalize why this limit exists

The efficiency formula is identical. But the *physical interpretation* changed:
caloric (conserved fluid) was replaced by entropy (a state function that
cannot decrease in an isolated system). The mathematical relationship survived
the ontological revolution.

---

## Research Questions

1. **Running the same engine under two theories**: Given a Carnot cycle with
   specified reservoir temperatures and a working gas, do the caloric and
   modern theories predict the same efficiency? If so, why? If not, where
   do they diverge?

2. **Where caloric conservation breaks down**: Run a Joule-expansion experiment
   under both theories. Caloric theory predicts a temperature drop; modern
   thermodynamics predicts no temperature change for an ideal gas. Which matches
   the simulation of gas particle behavior?

3. **Structural survival**: Which mathematical steps in Carnot's argument remain
   valid in modern thermodynamics, and which rest on the false caloric assumption?
   (Spoiler: the reversibility argument survives almost intact; only the
   interpretation of what "falls" changes.)

4. **The Laplace speed-of-sound calculation**: Laplace used caloric theory
   to correct Newton's isothermal speed-of-sound formula to an adiabatic one.
   How does his caloric-based derivation compare to the modern adiabatic
   derivation? (They give the same formula; the ontological interpretation
   differs.)

5. **Where caloric theory *cannot* be saved**: The Joule paddle-wheel experiment
   created heat from work at a quantitative, reproducible rate. Model this
   under caloric theory. What ad hoc addition would be required to explain it?
   Is there a coherent caloric-preserving account?

---

## Model Specifications

### Model A: Caloric Theory (Historically Faithful)

**Ontology**: Heat is a conserved, massless fluid (caloric). Temperature is
the concentration of caloric per unit volume. Heat flow is caloric flow from
high to low concentration.

**State variables**:
- `Q_cal(body)`: Amount of caloric in each body
- `T(body)`: Temperature = f(Q_cal, mass, specific_heat_capacity)
- `V(body)`: Volume (caloric exerts pressure)

**Dynamics**:
- Caloric flows between bodies at a rate proportional to temperature difference
- Caloric is strictly conserved: `∑Q_cal = const`
- Work produced by an engine = caloric `dropped` × temperature difference
  (by analogy with waterwheel: work = mass × gravitational drop)

**Heat engine under caloric theory**:
- Same amount of caloric enters the hot end and leaves the cold end
- `Q_in = Q_out` (conservation)
- Work comes from the temperature difference, not from consuming caloric
- `η_caloric = f(T_hot - T_cold)` — Carnot's original non-absolute-temperature form

**Assumption ledger**:
- `EXPLICIT`: Caloric conservation (Lavoisier, *Traité élémentaire de chimie*, 1789)
- `EXPLICIT`: Carnot's waterfall analogy (*Réflexions*, 1824)
- `RECONSTRUCTION`: The functional form of caloric-concentration-to-temperature
  mapping (this was not precisely formalized by caloric theorists; we use a
  linear proportionality as the simplest assumption)
- `HISTORICAL`: The caloric theory's treatment of latent heat (Black, 1760s)

### Model B: First Law Only (Energy Conserved, No Second Law)

An intermediate model: energy (not caloric) is conserved, heat can convert to
work, but there is no entropy constraint. This lets us ask: is Carnot's
efficiency limit already implied by energy conservation alone, or does it
require something additional?

(Answer: it requires something additional — without the second law, a "perfect"
engine converting all heat to work would not violate energy conservation.)

**Assumption ledger**:
- `HISTORICAL`: Joule's mechanical equivalent of heat (1843)
- `EXTENSION`: We encode only the first law; we deliberately exclude the
  Clausius entropy inequality to isolate its contribution

### Model C: Full Classical Thermodynamics (Historically Modern)

**Ontology**: Heat is a form of energy transfer; entropy is a state function;
work and heat are interconvertible.

**State variables**: Standard thermodynamic state (P, V, T, n for ideal gas;
U, S derived quantities).

**Dynamics**:
- First law: `dU = δQ - δW`
- Carnot cycle: two isothermals, two adiabatics
- Efficiency derived from entropy change: `ΔS_universe ≥ 0` for any real process
- Reversible engine: `ΔS_universe = 0` → maximum efficiency

**Model D: Statistical Thermodynamics (Modern Kinetic)**

A particle-level simulation:
- `N` particles in a box with mass and velocity
- Temperature = mean kinetic energy
- "Heat flow" = momentum transfer during particle collisions with a piston
  or membrane
- Joule expansion: remove partition between two chambers; track mean kinetic
  energy before and after

This model makes the Joule expansion result intuitive: removing the partition
doesn't change mean kinetic energy (no work done, no heat exchanged) — the
caloric theory's prediction of a temperature drop simply has no mechanism
at the particle level.

---

## Interface Design

### Three Synchronized Views

**View 1 — The Heat Engine**
A schematic diagram of a Carnot cycle:
- Hot reservoir (top, red): labeled with temperature `T_hot`
- Cold reservoir (bottom, blue): labeled with temperature `T_cold`
- Piston/cylinder: animated through the four Carnot strokes
- Arrows showing heat flow `Q_hot` in, work `W` out, heat `Q_cold` out

Under caloric theory: `Q_hot = Q_cold` (conservation) is shown explicitly.
Under modern thermodynamics: `Q_hot ≠ Q_cold`; the difference is `W`.
The efficiency formula is displayed for both — users can see they agree.

**View 2 — The Joule Expansion**
A two-chamber box:
- Left chamber: gas at pressure `P`, temperature `T`
- Right chamber: vacuum
- Partition removal: animated expansion

Shown simultaneously under:
- Caloric prediction: temperature drops (caloric is diluted over larger volume)
- Modern prediction (ideal gas): temperature unchanged (no work done, no heat
  exchanged)
- Particle simulation: particles redistribute; mean kinetic energy unchanged

**View 3 — The Assumption Ledger**
For each claim in the current simulation mode, a color-coded table:
```
Claim                          | Source        | Status in Model A | Status in Model C
Heat is conserved             | Lavoisier 1789 | Assumed           | False
Reversibility limits efficiency | Carnot 1824  | Assumed           | True (different reason)
Carnot efficiency formula      | Carnot 1824   | Derived           | Derived (identical result)
Entropy is a state function    | Clausius 1865 | Unknown           | Assumed
```

### Control Panel

```
Engine mode:    [Carnot]  [Joule Expansion]  [Joule Paddle Wheel]
Theory:         [◯ Caloric]  [◯ First Law Only]  [◯ Full Thermo]  [◯ Particles]
T_hot:          [400 K ──────────────────────]
T_cold:         [300 K ──────────────────────]
Show efficiency: [✓] η = 1 - T_cold/T_hot = 25%
```

---

## The Key Philosophical Point

Carnot's proof rested on the following valid logical move:

> *If two reversible engines operating between the same reservoirs had
> different efficiencies, you could couple them to produce work from nothing —
> a perpetual motion machine. Therefore all reversible engines between the same
> reservoirs must have the same efficiency.*

This argument does **not** depend on what heat *is*. It depends only on:
1. Some conservation principle (caloric theory gave one; energy conservation
   gives another, slightly different one)
2. The concept of a reversible process
3. The impossibility of a perpetual motion machine

The modern version replaces caloric conservation with entropy non-decrease,
and the structural logic of the proof is essentially unchanged.

This is an example of what philosophers of science call *structural realism*:
the mathematical structure of a theory can survive its ontological interpretation.
Carnot's mathematics was more robust than his physics.

The simulation should make this visible by showing the identical efficiency
formula arising from two completely different physical pictures.

---

## What We Expect to Find

1. **The efficiency formula is identical** under caloric and modern thermodynamics
   for a reversible Carnot engine. Both yield `η = 1 - T_cold/T_hot`.

2. **The Joule expansion discriminates** the theories sharply: caloric predicts
   cooling; modern thermodynamics predicts no temperature change; particle
   simulation confirms the modern result.

3. **The Laplace sound-speed correction** is derivable under both theories
   with identical results, demonstrating that caloric language for adiabatic
   processes was a working proxy for the modern adiabatic concept.

4. **The Joule paddle-wheel experiment** cannot be accommodated in caloric
   theory without an ad hoc source of caloric. We will show the minimum
   modification required and ask what it costs the theory in terms of
   explanatory simplicity.

5. **The surviving structure** (reversibility argument, absolute temperature
   scale, Carnot efficiency) is precisely the part of Carnot's reasoning that
   does not depend on caloric conservation.

---

## Key Historical Sources

| Source | Date | Role |
|---|---|---|
| Lavoisier, *Traité élémentaire de chimie* | 1789 | Primary source for caloric theory |
| Carnot, *Réflexions sur la puissance motrice du feu* | 1824 | Central text for engine efficiency argument |
| Joule, "On the Mechanical Equivalent of Heat" | 1850 | Key refuting evidence for caloric conservation |
| Clausius, "On the Moving Force of Heat" | 1850 | Modern thermodynamic replacement |
| Fox, Robert, *The Caloric Theory of Gases* | 1971 | Standard historical account |
| Truesdell, *The Tragicomical History of Thermodynamics* | 1980 | Detailed philosophical analysis |
| Kuhn, Thomas S., "Carnot's Version of 'Carnot's Cycle'" | 1955 | Analysis of the caloric-based argument's structure |

---

## Implementation Notes

### Carnot Cycle Simulation
The Carnot cycle can be simulated exactly for an ideal gas:
- Isothermal expansion: `pV = nRT = const`, work = `nRT_hot · ln(V2/V1)`
- Adiabatic expansion: `pV^γ = const`
- Isothermal compression at `T_cold`
- Adiabatic compression back to start

Both caloric and modern models predict the same `(P, V)` trajectory for the
ideal gas. The models differ in *interpretation*, not in observable mechanical
output — until we ask about the Joule expansion.

### Particle Simulation
A 2D molecular dynamics simulation using Lennard-Jones or hard-sphere
interactions. Partitioned box with removable wall. Track mean kinetic energy
before and after partition removal. This is computationally intensive; we
will limit to ~200–500 particles and use a Web Worker.

### Assumption Ledger Integration
The ledger will be a JSON data structure with one entry per encoded claim:
```json
{
  "claim": "Caloric is conserved",
  "source": "Lavoisier 1789, Table of Elements",
  "confidence": "EXPLICIT",
  "active_in": ["model_a"],
  "status_in_modern": "FALSE — energy is conserved, not heat",
  "consequence": "Forces Q_in = Q_out in engine; prevents Joule heating explanation"
}
```

This structure drives both the ledger display and any automated consistency
checks we build later.
