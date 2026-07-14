# Energy Pathway: Learning and Interaction Design

**Pathway:** Space & Physics → Energy
**Status:** Design Reference

---

## 1. Learning Goal

The learner should leave the pathway able to use energy as a system-level accounting tool rather than merely repeat formulas.

The target mental model is:

> A defined system can store energy in several calculable ways. Interactions can transform that energy inside the system or transfer it across the boundary. For an isolated system, the total accounting remains constant even when the visible motion changes.

## 2. Prerequisites

The learner should already understand:

- Position and velocity as state variables.
- Acceleration as change in velocity.
- Force as part of an evolution law.
- Basic graphs and slopes.
- The idea that a numerical model approximates continuous evolution.

The existing **Why Position Is Not Enough** page supplies these prerequisites.

## 3. Pathway Structure

## Page 1: Energy Exchange

### Driving question

How can an object stop, speed up, or reverse while a single total quantity remains unchanged?

### Recommended phenomenon

A frictionless cart or mass moving in an adjustable one-dimensional potential.

### Interaction sequence

1. Release a particle from rest on a hill.
2. Show position and speed only.
3. Ask the learner to predict where speed will be largest.
4. Reveal kinetic and potential energy bars.
5. Reveal total energy as a fixed reference line.
6. Let the learner change mass, starting height, and potential shape.

### Core reveal

$$K = \frac{1}{2}mv^2, \qquad E = K + U$$

The mathematical panel should appear only after the transformation has been observed.

### Success evidence

The learner can explain why speed is largest where the potential is lowest and why the total-energy line does not move.

---

## Page 2: Potential Landscapes

### Driving question

How much can we predict from a landscape without solving the entire trajectory?

### Interaction sequence

1. Draw or select a potential curve.
2. Place a horizontal total-energy line.
3. Shade allowed regions where $E \ge U(x)$ in **Neon Cyan** and classical forbidden regions where $E < U(x)$ in a **hashed grey pattern**.
4. Mark turning points automatically.
5. Release a particle and compare the predicted region with the actual motion.
6. Move the arbitrary zero of $U$ without changing the trajectory.

### Concepts

- Allowed and forbidden classical regions (visualized with contrasting active/inactive shadings).
- Turning points: at these points ($E = U(x)$), the velocity vector disappears, while the force vector remains as a prominent **Amber arrow** representing the potential's slope to prove $a \ne 0$.
- Bound and unbound motion.
- Stable and unstable equilibrium.
- Potential zero as a convention.

### Critical prompt

At a turning point, is the force necessarily zero?

The interaction should make the particle instantaneously stop while the force arrow remains nonzero when the potential has a slope.

---

## Page 3: Where Did the Energy Go?

### Driving question

If friction makes the visible motion stop, has energy disappeared?

### Interaction sequence

1. Begin with the same oscillator or rolling cart.
2. Add a friction slider.
3. Initially display only mechanical energy; let it decrease.
4. Ask where the missing energy went.
5. Reveal an internal/thermal-energy store.
6. Show the larger-system total remain constant.

### Representation

Use a double-nested boundary visualization:

- **Inner Box (System):** Represents the particle plus the conservative potential. Shows the mechanical energy bars ($K$ and $U$) exchanging energy ($K \leftrightarrow U$).
- **Outer Box (Surroundings):** Represents the track/environment receiving thermal energy ($E_{\text{thermal}}$).
- **Behavior:** When friction is enabled, the visual system animates the flow of dissipated energy crossing the inner boundary to fill the surroundings' thermal bar, visually satisfying the full system accounting: $\Delta K + \Delta U + \Delta E_{\text{thermal}} = 0$.

This makes the system choice visible rather than burying it in prose.

### Important language

Prefer:

- "Mechanical energy decreased."
- "Energy was transferred to internal energy."
- "The larger system's total is conserved."

Avoid:

- "The energy was lost."
- "Friction used up the energy."

---

## Page 4: Can the Computer Break Physics?

### Driving question

Can a numerical algorithm manufacture energy even when the modeled force cannot?

### Interaction sequence

1. Run an ideal spring with an exact reference trajectory.
2. Compare Forward Euler, Euler-Cromer, and optionally RK4.
3. Plot phase space and total energy simultaneously.
4. Allow the learner to change $\Delta t$.
5. Display energy error and solver stability warnings.
6. Ask which solver is most trustworthy for long-term orbital-like motion.

### Conceptual distinction

- The **physical model** may conserve energy.
- The **numerical implementation** may fail to preserve that property exactly.

This page should link directly to the existing numerical-solvers chapter and the orbital mechanics lab.

## 4. Common Learner Difficulties

### Difficulty: Energy is treated as an object or fuel-like stuff

Useful response:

Use a consistent accounting representation, but explicitly state that the visual bars are a representation of calculated quantities, not literal containers inside the object.

### Difficulty: Energy belongs to the moving object

Useful response:

Change the system boundary. Show that gravitational or elastic potential energy appears only when the relevant interaction is included.

### Difficulty: Friction destroys energy

Useful response:

Exaggerate the thermal outcome when necessary. A large-friction version can visibly heat a track or increase molecular agitation before returning to the realistic small effect.

### Difficulty: Potential energy is determined by height alone

Useful response:

Compare uniform gravity, a spring, and an arbitrary potential. Height is one possible configuration variable, not the definition of potential energy.

### Difficulty: Negative energy is impossible

Useful response:

Allow the reference zero to move. Show that negative values can appear while all forces, motion, and energy differences remain unchanged.

### Difficulty: Total energy predicts the complete motion

Useful response:

At the same $x$ and total $E$, display both possible velocity directions. Energy constrains speed and accessible regions but does not always specify the complete state.

### Difficulty: A stopped object has no energy or no force

Useful response:

At a turning point, show $K=0$, $U=E$, $v=0$, and a nonzero force arrow. Stopping at one instant is not equilibrium.

## 5. Representation System

Use the same quantities across every page:

| Quantity | Suggested visual |
|---|---|
| Kinetic energy $K$ | Filled bar tied to speed |
| Potential energy $U$ | Curve plus bar |
| Mechanical energy $K+U$ | Fixed total line or combined bar |
| Internal/thermal energy | Separate store inside expanded system boundary |
| Work/transfer | Arrow crossing a boundary |
| Power | Animated transfer rate or flow thickness |
| Numerical error | Small explicit diagnostic, never silently hidden |

### Color rule

A color must always mean the same quantity throughout the pathway. Do not reuse the kinetic-energy color for velocity or the potential-energy color for force.

### Synchronization rule

All representations must update from the same simulation state in the same animation frame:

- physical particle,
- velocity arrow,
- force arrow,
- potential curve,
- energy bars,
- numerical readouts,
- time graph.

## 6. Interaction Design Principles

### One conceptual surprise per section

Do not introduce potential curves, friction, arbitrary zeros, numerical error, and power in one dashboard. Reveal them in stages.

### Prediction before explanation

Before each reveal, ask a concrete question:

- Where will the particle be fastest?
- Can it cross this hill?
- Does changing the zero change the motion?
- Where did the energy go?
- Which solver is adding energy?

### Direct manipulation

Let the learner drag:

- the particle's initial position,
- the total-energy line,
- potential control points,
- friction,
- the energy-zero reference,
- numerical step size.

### Immediate consequence

The physical motion and every representation should respond continuously while the parameter is dragged.

### Safe failure

Impossible initial states should teach rather than fail silently. If a user places the particle where $U(x) > E$, either raise $E$ automatically with an explanation or show why that state is inconsistent.

### Progressive disclosure

Default layer:

- phenomenon,
- direct controls,
- qualitative energy bars.

Optional "Show the math" layer:

- equations,
- derivations,
- units,
- exact numerical values.

Optional "How the simulation works" layer:

- differential equations,
- integrator,
- error diagnostics,
- test cases.

## 7. Page Contract

Every explorable should include:

1. One driving question.
2. A model specification card.
3. A prediction prompt.
4. One primary direct manipulation.
5. Synchronized physical and abstract representations.
6. A concept check requiring explanation, not only calculation.
7. A misconception or boundary case.
8. A "Show the math" panel.
9. A model limitations section.
10. Links to prerequisites and next applications.

## 8. Recommended First Page Outline

# Energy Exchange: The Motion Changes, the Total Does Not

1. **Same particle, different motion**
   - Release from several positions.

2. **Where is it fastest?**
   - Prediction based on the landscape.

3. **Two ways of storing mechanical energy**
   - Reveal $K$ and $U$.

4. **The invariant total**
   - Show $K+U$ fixed.

5. **Change the mass**
   - Explore what changes and what relationships remain.

6. **Change the potential**
   - Gravity, spring, and custom curve.

7. **Move the zero**
   - Values change; motion does not.

8. **Concept check**
   - Compare two locations with equal $U$ or equal speed.

9. **Where this goes next**
   - Potential landscapes, friction, orbital energy, quantum wells.

## 9. Accessibility Requirements

- Every canvas must have a text summary of the current state.
- Controls must be keyboard operable.
- Values must not be communicated by color alone.
- Provide pause, reset, and step controls.
- Respect reduced-motion preferences.
- Use visible focus states.
- Announce important state changes through an `aria-live` region without announcing every animation frame.
- Include a table or textual alternative for energy values and turning points.

## 10. Evaluation Questions

Test with learners using questions such as:

1. A cart stops at the top of a hill. Is its acceleration necessarily zero?
2. If the potential-energy zero is moved upward, does the cart's motion change?
3. A block slides to rest because of friction. Is total energy destroyed?
4. Can two states have the same total energy but opposite velocities?
5. Why can one numerical solver spiral outward even though the ideal spring does not gain energy?

The interaction is successful when learners answer these using the system, transfer, and transformation model rather than isolated memorized formulas.
