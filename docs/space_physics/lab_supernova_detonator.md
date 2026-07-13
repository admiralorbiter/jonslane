# Technical Specification: Supernova Detonator

**Module:** Space & Physics → Supernova Detonator  
**File:** `docs/space_physics/lab_supernova_detonator.md` (spec) + Jinja2 template (`supernova_detonator.html`)  
**Status:** Pre-implementation reference  

---

## 1. Overview & Pedagogical Goals

The **Supernova Detonator** is a time-critical, interactive astrophysics simulation where players manage the final moments of a massive star's life. Players adjust core compression rate, rotation, and magnetic fields to trigger a successful core-collapse supernova.

### What the User Learns:
* **Stellar Core-Collapse**: When an iron core exceeds the Chandrasekhar limit ($1.44 M_\odot$), electron degeneracy pressure fails, and the core collapses to a neutron star in milliseconds.
* **Neutrino-Driven Mechanism**: The shock wave stalls as it tries to exit the dense core; neutrino heating from the newly-formed neutron star re-energizes the shock wave to blow off the outer layers.
* **Nucleosynthesis**: The extreme heat of the supernova explosion synthesizes elements heavier than iron (e.g. gold, platinum) via the r-process.
* **Core Collapse Endstates**: Depending on initial mass, spin, and magnetic strength, the core collapses into a stable neutron star, a highly magnetic magnetar, or a black hole.

---

## 2. Physics Engine & Mathematical Formulation

### 2.1 Core Collapse Free-Fall Time
When pressure support is removed, the core collapses on the free-fall timescale:

$$t_{\text{ff}} = \sqrt{\frac{3\pi}{32 G \rho_{\text{core}}}}$$

In the simulator, as core density $\rho_{\text{core}}$ rises from $10^{10}\,\text{kg/m}^3$ to $10^{17}\,\text{kg/m}^3$ (nuclear saturation density), the time left for the player to react approaches zero.

### 2.2 Neutrino Heating and Shock Re-energization
The shock wave stalls at a radius of $\sim 100-200$ km due to dissociation of iron nuclei. To revive the shock, neutrino heating must exceed the cooling rate. The net heating rate $\dot{q}$ is modeled as:

$$\dot{q} = K \cdot \left( L_{\nu} \cdot \sigma_{\nu} \cdot r^{-2} - \text{Cooling}(T) \right)$$

Where $L_{\nu}$ is the neutrino luminosity and $\sigma_{\nu}$ is the neutrino cross-section. The player must adjust the neutrino escape rate (via density sliders) to keep $\dot{q} > 0$ until the shock breaks out of the star.

### 2.3 Angular Momentum and Magnetic Core Spin
If the star's initial rotation velocity $\Omega$ and magnetic field $B$ are high, the collapse creates a highly magnetized, rotating neutron star (Magnetar) and produces a collimated jet:

$$B_{\text{final}} = B_{\text{initial}} \cdot \left(\frac{R_{\text{initial}}}{R_{\text{final}}}\right)^2$$

$$\Omega_{\text{final}} = \Omega_{\text{initial}} \cdot \left(\frac{R_{\text{initial}}}{R_{\text{final}}}\right)^2$$

---

## 3. Rendering & Visual Effects

* **Cross-Sectional Star View**: Rendered in 3D Three.js showing the onion-skin layers of the star (Hydrogen, Helium, Carbon, Neon, Oxygen, Silicon, Iron).
* **Expanding Shockwave Mesh**: A deformed, turbulent sphere representing the shock front. The propagation rate is mapped to the simulated shock velocity:
  $$R_{\text{shock}}(t) = R_0 + v_{\text{shock}} \cdot t$$
* **SASI (Standing Accretion Shock Instability) Oscillation**: The shockwave wobbles back and forth dynamically, reflecting the physics of hydrodynamic instability.
* **Neutrino Cone Bloom**: Volumetric light shafts radiating outward from the core during the neutrino burst.

---

## 4. Game Mechanics & Interface

### Controls:
* **Neutrino Gate Slider**: Open/close channels to regulate neutrino emission. Too high = energy escapes; too low = core collapses to a black hole.
* **Rotational Spin Dial**: Adjust initial rotation speed.
* **Ignition Trigger**: Fire the core-collapse sequence when the core mass crosses the Chandrasekhar threshold.

### Branching Outcomes:
1. **Failed Supernova**: If the shock stalls completely, the core collapses silently into a black hole (stellar disappearance).
2. **Standard Type II Supernova**: Successful shock revival. Yields a stable neutron star and ejects heavy elements.
3. **Hypernova / Magnetar**: If spin and magnetic fields are maximized, triggers a high-energy magnetar explosion with polar relativistic jets.
