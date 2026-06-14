# Academy | Rhythm Curriculum & Spaced Repetition

The Academy currently includes a structured rhythm curriculum based on a progressive learning path:

$$\text{Hear} \rightarrow \text{Move} \rightarrow \text{Count} \rightarrow \text{Name} \rightarrow \text{Guess} \rightarrow \text{Reflect} \rightarrow \text{Revisit later}$$

---

## 1. Academy Level Architecture & Mastery Gates

The curriculum is structured into progressive levels. Levels 2 and 3 run as parallel tracks under a single "Rhythmic Structure" tier, reflecting the pedagogical reality that subdivision and meter internalization develop concurrently.

| Level | Name / Track | Core Skill | Primary Metric & Mastery Gate | Qualifying Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **0** | Find the Pulse | Feel recurring beat, understand BPM | **Tap Stability:** Standard Deviation of inter-onset intervals (IOI) $\le 50\text{ ms}$ | 5 attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **1** | Meter & Downbeat | Bar, beat 1, downbeat alignment | **Downbeat Phase Error:** Average phase error $\le 60\text{ ms}$ | 5 attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **2** | Rhythmic Subdivisions | Quarter/eighth/sixteenth subdivision | **Subdivided Tap Stability:** SD $\le 45\text{ ms}$ on subdivision taps | 5 attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **3** | Metrical Ambiguity | Tactus vs. measure, half/double time | **Metrical-Match Accuracy:** Deviation $\le 3.0\%$ on metrical targets | 5 attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **4** | Tempo Anchors & SRS | Absolute tempo memory for anchors | **Anchor Recall Index (ARI):** $\text{ARI} \ge 85.0$ on each of 95, 120, 128, 140 BPM | Calculated over last 10 attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **5** | Groove & Syncopation | Genre feel, tresillo, offbeat syncopation | **Syncopated Tap Stability:** SD $\le 40\text{ ms}$ on offbeat taps | 5 attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **6** | Phrasing | 4/8/16-bar phrase structure, form | **Phrase Loop Deviation:** Alignment error $\le 75\text{ ms}$ | 3 attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **7** | Beatmatch & Drift | Pitch fader nudge, phase vs. BPM | **Pitch Nudge Drift:** Final phase drift $\le 40\text{ ms}$ | 3 attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |

---

## 2. Spaced Repetition Scheduling (SM-2 Algorithm)

Level 4 introduces the Spaced Repetition System (SRS), utilizing a custom implementation of the SuperMemo SM-2 algorithm to schedule anchor recall drills.

### Rating to Quality Mapping
The user's subjective or computed attempt ratings map directly to SM-2 quality scores ($q \in [0, 5]$):
- `Tempo Wizard` $\rightarrow 5$ (Perfect recall)
- `DJ-Ready` $\rightarrow 4$ (Correct response after hesitation)
- `Solid Ear` / `Metrical Match` $\rightarrow 3$ (Correct response with serious effort)
- `Getting There` $\rightarrow 2$ (Incorrect response; where the correct one seemed easy to recall)
- `Needs Practice` $\rightarrow 0$ (Complete blackout / incorrect response)

### Spacing Lockout Check
To prevent spamming attempts, a strict **18-hour lockout window** is enforced:
- If a user completes an attempt within 18 hours of their last review, the attempt is logged in history but does *not* modify the SRS schedule or increase the interval.

### Scheduling Update Rules
For an attempt at timestamp $t$ with quality $q$:

1. **If quality is a success ($q \ge 3$):**
   - If repetitions $R = 0$: interval $I_1 = 1\text{ day}$.
   - If $R = 1$: interval $I_2 = 6\text{ days}$.
   - If $R > 1$: interval $I_n = \text{round}(I_{n-1} \times EF)$ days.
   - Increment repetitions: $R \leftarrow R + 1$.
   - Recalculate Ease Factor ($EF$):
     $$EF \leftarrow EF + (0.1 - (5 - q) \times 0.08)$$
   - Bound $EF \in [1.3, 3.0]$.

2. **If quality is a failure ($q < 3$):**
   - Reset repetitions: $R \leftarrow 0$.
   - Reset interval: $I \leftarrow 1\text{ day}$.
   - Apply Ease Factor penalties:
     - If $q = 2$: $EF \leftarrow EF - 0.08$.
     - If $q < 2$: $EF \leftarrow EF - 0.20$.
     - Bound $EF \in [1.3, 3.0]$.

### Metrical Match Streak Capping
To ensure users do not drift indefinitely on near-matches (e.g., getting half-time or double-time matches repeatedly), the system tracks a `metrical_match_streak`:
- If `rating == "Metrical Match"`, the streak increments by 1.
- If a higher-tier rating (`DJ-Ready` or `Tempo Wizard`) is achieved, the streak resets to 0.
- If the `metrical_match_streak` reaches 3 or more:
  - The maximum review interval is capped at **7 days** (`interval_days = min(interval_days, 7)`).
  - The maximum Ease Factor is capped at **2.5** (`ease_factor = min(ease_factor, 2.5)`).

### Schedule Seeding from Guest History
When an anonymous visitor registers for an account, their guest attempts are synced. If they have historical attempts for an anchor, their initial `AnchorSchedule` is seeded with a customized starting Ease Factor based on their average guest percent error:
- $\text{Error} \le 3.0\% \rightarrow EF = 2.5$
- $3.0\% < \text{Error} \le 8.0\% \rightarrow EF = 2.3$
- $\text{Error} > 8.0\% \rightarrow EF = 2.1$
- The first review is scheduled immediately (`next_review_at = now`).
