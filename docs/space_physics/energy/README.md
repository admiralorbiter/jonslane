# Energy Pathway Documentation

**Pathway:** Space & Physics → Energy
**Status:** Overview & Roadmap

---

This folder is the source-of-truth package for the first connective pathway in the Space & Physics resource.

The pathway begins with the existing particle-state material and develops the concepts needed to connect classical mechanics to orbital mechanics, waves, relativity, thermodynamics, and quantum mechanics.

## Documents

1. [01_energy_truth.md](01_energy_truth.md)
   - Physics definitions, equations, assumptions, examples, limits, and cross-topic connections.

2. [02_energy_learning_design.md](02_energy_learning_design.md)
   - Learning sequence, interactive page structure, common difficulties, and visual-design rules.

3. [03_energy_implementation_validation.md](03_energy_implementation_validation.md)
   - Computational model, numerical tests, invariants, edge cases, and acceptance criteria.

4. [04_sources_and_reading.md](04_sources_and_reading.md)
   - Annotated reference map covering textbooks, lectures, simulations, and physics-education research.

5. [topic_truth_template.md](topic_truth_template.md)
   - Reusable template for later topics such as momentum, waves, fields, and probability.

## Recommended Build Order

1. Build **Energy Exchange: Kinetic, Potential, and Total**.
2. Add **Potential Landscapes and Allowed Motion**.
3. Add **Open Systems, Friction, and Energy Transfer**.
4. Add **Energy Conservation as a Numerical Test**.
5. Connect the pathway to the existing orbital and quantum laboratories.

## Core Design Claim

Energy should not be introduced as a mysterious substance possessed by an isolated object. It should be introduced as a calculable property of a defined system that can be stored in different ways, transferred across a system boundary, and transformed while the total accounting remains consistent.

## Source Policy

Use sources in this order:

1. Primary equations and definitions: established university textbooks and canonical physics lectures.
2. Scope and modern framing: peer-reviewed or scholarly physics-education research.
3. Interaction precedents: PhET, Falstad, and other tested educational simulations.
4. Quick-reference sites: HyperPhysics and curated library guides.

Quick-reference sites are useful for navigation, but they should not be the only support for subtle claims or implementation decisions.
