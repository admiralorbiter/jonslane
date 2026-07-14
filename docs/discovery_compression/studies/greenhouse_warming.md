# Study 3: Greenhouse Warming

**Discovery Compression study for radiative forcing and CO₂ absorption**

---

## Overview

| Field | Value |
|---|---|
| **Modern theory** | Greenhouse effect — certain atmospheric gases (CO₂, H₂O, CH₄) absorb outgoing infrared radiation and re-emit it in all directions, including back toward the surface, raising surface temperature above what a bare-rock calculation predicts |
| **Estimated discovery horizon** | ~1750 CE (experimentally); theoretical basis available ~1800 CE |
| **Actual discovery date** | Fourier (1824) identified the atmosphere's thermal role; Tyndall (1859) measured differential absorption; Arrhenius (1896) calculated CO₂-temperature sensitivity |
| **Compression gap** | Minimal for basic phenomenon (~75 years); substantial for quantitative prediction (~150 years) |
| **Minimum hint level** | **Level 2 — Measurement hint**: *"Measure the temperature of air separately from the temperature of matter. Pass sunlight and heat through different gas mixtures. Compare incoming shortwave to outgoing longwave radiation."* |

---

## Central Question

> **Could an 18th-century natural philosopher, using existing thermometers, glass prisms, and carefully designed enclosures, have demonstrated that CO₂-enriched air absorbs and re-emits more thermal radiation than normal air — well before Fourier or Tyndall?**

Secondary questions:
- What is the minimum gas-path length and CO₂ concentration that produces a thermally measurable differential with 18th-century thermometry?
- Does Herschel's 1800 CE discovery of infrared radiation (using a prism and thermometers) constitute a near-miss? Why did it not lead immediately to atmospheric absorption experiments?
- How far could a researcher go using only visible-light optics (no knowledge of the infrared spectrum)?
- What institutional context would have made systematic climate-relevant absorption measurements more likely?

---

## Why The Delay Was Semi-Instrumental

Unlike the Mendel case, this delay is partly but not entirely instrumental.

Tyndall's 1859 experiment required:
- A long sealed tube containing a gas sample
- A heat source at one end (Leslie cube or similar)
- A thermometer or galvanometer at the other end
- Two gas samples to compare: standard air vs. CO₂-enriched or dry vs. humid air

The 18th-century thermometer (Fahrenheit 1714, Celsius 1742) was precise enough
to detect a temperature differential across a 1-meter gas tube given sufficient
CO₂ enrichment. The experimental design was within reach by 1750.

What was not yet clear:
- That "heat" and "light" are both electromagnetic radiation at different wavelengths
- That different gases selectively absorb different parts of the spectrum
- That "thermal radiation" and "luminous radiation" are physically different

The conceptual gap was the **distinction between visible and infrared radiation**.
Without knowing that heat and light are both radiation, the idea of "gas absorbs heat radiation
differently from light" has no physical foundation to rest on.

Herschel's 1800 prism experiment — where he placed thermometers beyond the red end of
a prism-split spectrum and found the temperature still rising — is the pivotal near-miss.
He discovered infrared radiation. He did not immediately test whether different gases
absorbed it differently. The connection took 59 more years.

---

## The Minimum-Hint Experiment

**Level 0 — No hint:**
Natural philosophers noted that glass traps heat (greenhouse-in-a-box experiments
date to the 1600s). de Saussure's "hot box" experiments (1767) showed solar heating
effects. The connection to atmospheric gases was not made.

**Level 1 — Attention hint:**
> *"The atmosphere may trap heat the way a glass box does. What property of
> a gas determines how much heat it traps?"*

Plausible hint. But without knowing that the relevant property is infrared
absorption, the experimental search space is very large.

**Level 2 — Measurement hint (minimum sufficient):**
> *"Construct two identical sealed chambers. Fill one with CO₂-enriched air and one
> with ordinary air. Heat both equally from a heat source. Measure the temperature
> inside each carefully over several hours. Repeat with various CO₂ concentrations."*

This provides a specific measurement protocol without revealing what the result
will be or why it occurs. A 1750 CE investigator with careful thermometry could
perform this experiment and detect a differential temperature effect for high
(above ~20%) CO₂ concentrations.

Note: detecting the subtlety of Earth's actual ~0.04% CO₂ level versus doubled
CO₂ requires much higher precision. The first experiment would need artificially
high concentrations to produce a clear signal.

**Level 3 — Experimental hint:**
> *"Pass radiation from a heated black body through a tube of CO₂ and measure the
> exit temperature. Repeat with nitrogen. The difference is the absorption effect."*

---

## Capability Inventory for ~1750 CE

```
A_1750CE = {
  thermometry:     Fahrenheit (1714) and Celsius (1742) scales; mercury thermometers
                   precision ~0.1°C achievable; absolute calibration crude
  gases:           CO₂ (fixed air) identified by Black (1754); obtainable from
                   limestone + acid reaction; purification possible
  optics:          Prisms (Newton 1666); known separation of light into spectrum
  heat sources:    Candle, oil lamp, focused solar mirror, heated metal objects
                   (Leslie cube not yet — invented 1804)
  enclosures:      Sealed glass or metal tubes; vacuum pump available (Boyle, 1659)
  math:            Calculus available (Newton/Leibniz); no statistical testing; ratio arithmetic
  infrared:        Not yet discovered (Herschel, 1800) — this is the key missing concept
  radiation:       Light understood as ray/particle; heat transport as "caloric" fluid
  concepts:        "Fixed air" known to extinguish flame; absorptive properties of gases unknown
}
```

**Key limitation:** The concept that heat is radiation — electromagnetic waves of longer
wavelength than visible light — does not exist in 1750. This means the absorptive
mechanism cannot be understood even if the differential temperature is measured.
However, the *empirical* differential could be measured, documented, and cited as evidence
for a heat-trapping property of "fixed air," without the electromagnetic explanation.

---

## What Could Have Been Concluded

At Level 2 (measurement hint), a 1750 CE investigator with careful thermometry could establish:

- ✅ Air enriched with "fixed air" (CO₂) retains more heat from a given source than regular air
- ✅ The effect is larger with higher CO₂ concentration
- ✅ The effect is present in sealed chambers and disappears when CO₂ is replaced with nitrogen
- ✅ Analogy: if the atmosphere contains variable amounts of "fixed air," atmospheric temperatures
     should be sensitive to that proportion

What would remain out of reach:
- ❌ The infrared absorption mechanism (requires Herschel 1800 + Tyndall 1859 + electromagnetic theory)
- ❌ Quantitative temperature prediction (requires Arrhenius 1896 + modern radiative transfer)
- ❌ Why CO₂ specifically absorbs heat (requires quantum mechanics and molecular vibration modes)
- ❌ Natural vs. anthropogenic CO₂ sources and sinks

The result would be: *"Fixed air in the atmosphere traps heat. Greater atmospheric
concentrations of fixed air should produce higher surface temperatures."* That is the
core claim of the greenhouse effect, without the mechanism.

---

## The Modern Theory's Structural Claims

| Claim | Level of hint required | Status |
|---|---|---|
| Certain gases trap heat | Level 2 | Measurable with 1750 thermometry at high concentrations |
| CO₂ specifically is such a gas | Level 2 | Accessible; CO₂ known from 1754 |
| Effect is proportional to concentration | Level 2 | Measurable with series of concentrations |
| Effect operates via radiation absorption | Level 4 | Requires Herschel's infrared (1800) |
| Temperature sensitivity per CO₂ doubling | Level 4 | Requires Arrhenius-level calculation |
| Molecular vibration modes cause absorption | Level 6 | Requires quantum mechanics |

---

## Hindsight-Leak Audit

| Potential leak | Status | Notes |
|---|---|---|
| Knowledge that CO₂ absorbs infrared | **Not allowed** | This is part of the conclusion |
| Knowledge that CO₂ exists ("fixed air") | **Allowed** | Joseph Black, 1754 |
| Knowledge of the infrared spectrum | **Not allowed** before 1800 | Herschel's discovery required |
| Knowledge of modern greenhouse mechanism | **Not allowed** | Clear post-discovery knowledge |
| High-CO₂ concentration experiment | **Allowed** | Feasible with 1750 materials |
| Precise thermometry differential | **Partial** | Feasible but at the instrument limit |
| Statistical comparison of groups | **Partial** | Ratio arithmetic OK; null hypothesis not formalized |

---

## The Near-Miss: Herschel 1800

The discovery of infrared radiation by William Herschel in 1800 is the closest near-miss
in the dataset. Herschel placed thermometers beyond the red end of a prism-split solar
spectrum and found temperatures above the room level. He named the region "calorific rays."

He did not ask: *"Do different gases absorb calorific rays to different degrees?"*

This question was 59 years away, asked by Tyndall in 1859. The experimental apparatus
was nearly identical. The prism, the heat source, the thermometers, the sealed tube —
all available to Herschel.

The intervening 59 years are one of the cleanest examples in the dataset of a compression
gap that was purely conceptual: the question was not asked, not the instrument missing.

---

## Interactive Study Design (Future Implementation)

The simulation will allow the user to:

1. **Select a historical year** (1700–1860 CE) and see the capability inventory
2. **Design an absorption experiment** with available materials (tubes, gases, heat sources, thermometers)
3. **See simulated outcomes** with realistic thermometric noise
4. **Vary the CO₂ concentration** and watch where the signal-to-noise ratio crosses 1
5. **Apply hint levels** and see how early the greenhouse effect becomes computable
6. **Explore the Herschel near-miss** — what would have happened if he had continued into gas-comparison experiments in 1800?

---

## Connection to 2026 → 2126 Analysis

This study is the clearest example of **Blind Spot Type 1** (Averaging Away the Signal):
the 1750 experiment requires deliberately concentrating CO₂ above atmospheric levels to
see the effect. The atmospheric signal was invisible not because of absent instruments
but because nobody had designed an experiment to amplify the contrast.

The modern analogue: what phenomena are currently undetectable at natural concentrations
but become clear when the relevant variable is systematically varied in a designed experiment?

---

## Selected Sources

- Fourier, J.B.J. (1824). *Mémoire sur les températures du globe terrestre et des espaces planétaires.*
- Tyndall, J. (1861). *On the absorption and radiation of heat by gases and vapours.*
- Herschel, W. (1800). *Experiments on the refrangibility of the invisible rays of the sun.*
- Weart, S. (2008). *The Discovery of Global Warming.* Harvard University Press.
- Fleming, J.R. (1998). *Historical Perspectives on Climate Change.* Oxford University Press.
