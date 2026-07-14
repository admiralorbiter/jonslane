# Study 1: Discrete Inheritance

**Discovery Compression study for Mendelian genetics**

---

## Overview

| Field | Value |
|---|---|
| **Modern theory** | Mendelian inheritance — heritable traits are controlled by discrete factors (alleles) that segregate independently and recombine according to fixed probability ratios |
| **Estimated discovery horizon** | ~500 BCE (technically); practically ~200 BCE with sufficient scale |
| **Actual discovery date** | 1866 CE (Mendel's *Versuche über Pflanzenhybriden*) |
| **Compression gap** | ~2,000 years |
| **Minimum hint level** | **Level 2 — Measurement hint**: *"Count offspring sorted into distinct categories across multiple generations. Do not average. Look for fixed whole-number ratios."* |

---

## Central Question

> **Could a Mediterranean-era researcher, with access to crop plants and sufficient experimental scale, have discovered that hereditary factors behave as discrete combinatorial units — without any knowledge of chromosomes, DNA, or cells?**

Secondary questions:
- At what granularity of experimental design does the 3:1 ratio become statistically unambiguous against noise?
- What minimum sample sizes were actually feasible given ancient agricultural practice?
- What conceptual vocabulary would be needed to interpret the pattern, given that "probability" and "statistics" were not yet formalized?
- Could the result have been stated as an empirical law without the theoretical vocabulary to explain it?

---

## Why The Delay Was Not Instrumental

Mendel's experiments required:

- Pea plants (*Pisum sativum*) — available and domesticated for millennia
- Multiple generations of controlled crosses — achievable in 2–3 growing seasons
- Sharp, categorical traits (round/wrinkled, green/yellow) — already observed by farmers
- Counting offspring by category — basic tallying
- Large sample sizes (Mendel used ~28,000 plants) — achievable with organized agricultural labor
- Recognizing fixed ratios — requires numeracy and the concept of ratio, both ancient

Nothing on this list was unavailable before the Common Era.

The missing element was not instrumentation. It was the **question** and the **counting discipline** — sorting offspring into categories rather than blending them into a description of the average offspring's appearance.

---

## The Minimum-Hint Experiment

**Level 1 — Attention hint:**
> *"In your seed crosses, the offspring do not all look the same. They sort into groups."*

This is insufficient. Without knowing to count carefully across many generations, a researcher might note variation without discovering the ratio.

**Level 2 — Measurement hint (minimum sufficient):**
> *"Count every offspring of each cross, sorted into the distinct trait categories. Repeat the same cross many times. Keep records for three generations. Look for stable numerical ratios between categories."*

This hint does not reveal what the ratio will be, what it means, or why it exists. It only redirects attention from average appearance to category counts.

A researcher receiving this hint and following it rigorously for three generations with ~1,000 plants per cross would encounter ratios close enough to 3:1 (and 9:3:3:1 for dihybrids) to be compelling.

**Level 3 — Experimental hint:**
> *"Repeatedly cross pure-breeding yellow peas with pure-breeding green peas. Count every offspring in F1 and F2 separately. Then cross the F2 offspring back to the pure-breeding parent strains."*

This provides the exact Mendelian experimental design without explanation.

---

## Capability Inventory for ~300 BCE

```
A_300BCE = {
  plants:       Pea, bean, lentil, grain — controlled crosses achievable
  labor:        Agricultural estates; 10^3 plants per growing season feasible
  traits:       Discrete visible distinctions well-known to farmers
  math:         Ratio arithmetic available; fractions understood; no probability theory
  records:      Papyrus, wax tablets; multi-generation records feasible with organization
  seasons:      2–3 generations per year (pea); 10-year study = 20–30 generations
  statistics:   None formally — "most of" vs "about half" as rough language
  concepts:     "Seed" and "type" understood; no concept of allele, factor, or gene
}
```

**Key limitation:** Without probability theory, the discovery could be stated as
an empirical pattern (*"roughly three of every four offspring resemble the first
parent, and one resembles the other"*) but not derived or predicted from a
mechanistic model. The empirical regularity would be discoverable. The theory
would not be.

---

## What Could Have Been Concluded

At Level 2 (measurement hint), a careful ancient researcher could have established:

- ✅ F1 offspring of pure-breeding crosses all resemble one parent ("dominant" type)
- ✅ F2 offspring split into approximately 3:1 (dominant:recessive) ratio
- ✅ The ratio is stable across different trait pairs and different plant species
- ✅ Certain traits skip a generation and reappear
- ✅ Two traits crossed simultaneously produce a 9:3:3:1 split

What would remain out of reach without additional hints:
- ❌ Why the ratio is 3:1 (requires the concept of allele pairs and segregation)
- ❌ Whether the same rules apply to animals (different breeding timelines, harder to control)
- ❌ The chromosomal mechanism (requires microscopy, ~1880)
- ❌ The molecular mechanism (requires biochemistry, ~1950)

---

## The Modern Theory's Structural Claims

The study focuses on recovering *structural claims*, not the complete theory:

| Claim | Level of hint required | Status |
|---|---|---|
| Traits segregate as discrete units | Level 2 | Recoverable from ratio counting |
| There is a dominant and recessive form | Level 2 | Observable in F1 crosses |
| Segregation ratios are fixed | Level 2 | Requires statistical discipline |
| Two traits are independently assorted | Level 3 | Requires deliberate dihybrid design |
| The "factors" come in pairs (diploid) | Level 4 | Requires structural interpretation |
| Factors are located on chromosomes | Level 5 | Requires cytology + microscopy |
| Factors are DNA sequences | Level 5 | Out of reach without biochemistry |

---

## Hindsight-Leak Audit

Any proposed "early" experiment must pass the following checks:

| Potential leak | Status | Notes |
|---|---|---|
| Knowledge of which traits are categorical | **Allowed** | Farmers had this empirically |
| Controlled parentage across generations | **Allowed** | Requires organization, not modern tech |
| Large sample sizes | **Requires justification** | Feasible with agricultural estate scale |
| Statistical reasoning about ratios | **Partial leak** | Ratio arithmetic is ancient; null hypothesis testing is not |
| Concept of "pure breeding" | **Allowed** | Empirically accessible through repeated selection |
| Concept of "gene" or "allele" | **Not allowed** | These are post-1909 terms |
| Knowledge of Mendel's laws before the experiment | **Not allowed** | Pure hindsight |

---

## Interactive Study Design (Future Implementation)

The simulation will allow the user to:

1. **Select a historical year** (500 BCE → 1900 CE) and see the capability inventory
2. **Run simulated cross experiments** at that period's sample size constraints
3. **Receive the results** with historically-accurate noise and record-keeping limitations
4. **Apply hint levels 0–6** and see how much of the 3:1 pattern becomes visible
5. **Read the historical context** — what was being said about heredity in that year

Key output: a visual representation of how many generations and plant counts are
required to distinguish the discrete-factor hypothesis from the blending alternative,
as a function of the measurement noise realistically available in each period.

---

## Selected Sources

- Mendel, G. (1866). *Versuche über Pflanzenhybriden.* Verhandlungen des naturforschenden Vereines in Brünn.
- Olby, R. (1985). *Origins of Mendelism.* University of Chicago Press.
- Hartl, D. & Orel, V. (1992). *What did Gregor Mendel think he discovered?* Genetics, 131(2).
- Theophrastus (~300 BCE). *Enquiry into Plants.* — evidence of ancient categorical trait observation
