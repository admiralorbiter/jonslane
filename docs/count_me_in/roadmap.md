# Count Me In | Product & Feature Roadmap

This document outlines the version milestones, completed work, and future directions for the **Count Me In** BPM training application and the broader **Rhythm Intelligence Platform** it is growing into.

---

## 🚀 Released Milestones

### Version 1.0: Core Synthesizer Ear-Trainer [Completed]
*   **Description:** Core web application providing random BPM playback challenges.
*   **Key Features:**
    *   Four-channel synthesized drum loop (Kick, Snare, Hi-hat, Bass).
    *   Clue Levels muting channels to train focused listening.
    *   Local storage attempts logging and user dashboards.
    *   Manual numeric BPM guess inputs and score rating calculations.

### Version 2.0: Anchors, Taps, & DJ Crates [Completed]
*   **Description:** Transitioned the application from a simple quiz to a scientifically grounded training system.
*   **Key Features:**
    *   **Tap-Tempo Input Mode:** Interactive tapping interface evaluating tempo estimation (sensorimotor synchronization) and timing consistency (motor stability).
    *   **Anchor Tempo Training Path:** Structured training mode designed to build long-term absolute tempo memory (Levitin & Cook, 1996) using stable reference anchors (95, 120, 128, 140 BPM) and level progression.
    *   **Genre-Specific DJ Crates:** Support for boom-bap hip hop, dance-pop & R&B, trap & dubstep, and pop-punk & indie rock crates (25 tracks/crate), streaming 30-second audio previews from the iTunes API, pitch-shifted and EQ-filtered to match clue levels.
    *   **Test Database Isolation:** Isolated unit tests to run in-memory, protecting the local development database from teardown drops.
*   **Technical Specification:** Detailed implementation info is available in the [Technical Spec](file:///c:/Users/admir/Github/jonslane/docs/count_me_in/technical_spec.md).

---

## 🔮 Future Roadmap

### Version 3.0: DJ Rhythm, Sync & Alignment Coach [Planned]

Version 3.0 shifts Count Me In from a "Tempo Trainer" to a complete **DJ Rhythm, Sync, & Alignment Coach**.

#### 3.1 Beatgrid & Downbeat Alignment Mini-game
*   **Concept:** Instead of guessing BPM, players are presented with a loop where the visual beat grid is misaligned, phase-shifted, or locked to the wrong transient (e.g., a snare instead of a kick).
*   **Implementation:**
    *   The user must shift the grid left/right (phase adjustment) or contract/expand it (BPM adjustment) using keyboard shortcuts until the visual grid aligns perfectly with the downbeat (beat 1) of the audio loop.
    *   Integrates standard Serato, Traktor, and Rekordbox style manual beatgrid-setting workflows.

#### 3.2 "Algorithm Ghost" Mode (Human vs. Machine)
*   **Concept:** Compete against client-side beat-tracking algorithms to highlight the strengths and limitations of automated software.
*   **Implementation:**
    *   After the player submits a guess, the engine runs the audio loop through a client-side beat-tracking algorithm (e.g., Ellis-style onset detection or autocorrelation-style analyzer).
    *   Displays the machine's BPM estimate, its confidence metric, and compares the human's interpretation with the machine's (e.g. did the machine get confused by half-time cymbals?).
    *   Teaches users how algorithms can get tripped up by syncopated beats, metrical ambiguity, or polyrhythms.

#### 3.3 Haptic Feedback Integration (Mobile/Controllers)
*   **Concept:** Leverage mobile haptic engines to vibrate the device on the downbeat or when a tap matches/misses the tempo.
*   **Implementation:**
    *   Use the HTML5 Vibration API to pulse the device on step 0 (downbeat) or provide tactile confirmation on taps, reducing input lag perception.

#### 3.4 "Why Was I Wrong?" Diagnostic Engine
*   **Concept:** After each guess, generate a human-readable explanation of the most likely error type rather than only showing a score.
*   **Implementation:**
    *   Server-side `utils/diagnostics.py` module analyzing `percent_error`, `metrical_multiplier`, `tap_stability`, `anchor_bpm`, and `anchor_level`.
    *   Returns a plain-English explanation in the existing `/game/api/attempt` JSON response. No new endpoint needed.
    *   Example outputs: "You heard the half-time pulse — a musically valid layer, but not the tactus." / "Your taps drifted after beat 4. Focus on locking beats 5–8."

#### 3.5 Tempo Nudge Slider Mode
*   **Concept:** A third input mode (alongside Numeric and Tap-Tempo) where users drag a slider to adjust playback speed until the loop matches a target feel. Justified by Vigl et al. (2024), who found tempo-adjustment is more precise than tapping.
*   **Implementation:**
    *   Slider drives `playbackRate` in real time using the existing `BpmAudioEngine` mechanism.
    *   Final slider position is submitted as the guess via the existing attempt API.

---

### Version 4.0: Count Me In Academy [Designed — Planned for Phased Build]

Version 4.0 restructures Count Me In into a **year-long, research-grounded rhythm intelligence curriculum** with 8 progressive levels. The pedagogy loop is:

> **Hear → Move → Count → Name → Guess → Reflect → Revisit later**

> [!IMPORTANT]
> **Academy is auth-gated.** The `/academy` routes are visible only to logged-in users. Non-logged-in visitors can use Count Me In and Piano Lab fully, but Academy does not appear in their navigation and all its routes return 403 or redirect to login.
>
> **Academy is not music-specific.** It is the private meta-layer for the whole portfolio. Starting with music tools (CMI + Piano Lab), it is designed to eventually accommodate language learning, other skill trainers, or any future learning experience built on this platform. Some Academy content will only exist within the Academy and will never be surfaced publicly.

The learning science foundation draws on:
- **Spaced retrieval** (Carpenter et al.): anchor tempos reviewed at increasing intervals, not just immediately after learning
- **Interleaved practice** (Kornell & Bjork, 2008): mixing genres and crates instead of blocked grinding
- **Metacognitive reflection** (Hallam, 2001): "Why Was I Wrong?" prompts and self-assessment after each session

#### 4.1 Academy Level Architecture & Mastery Gates

The curriculum is structured into progressive levels. Levels 2 and 3 run as parallel tracks under a single "Rhythmic Structure" tier, reflecting the pedagogical reality that subdivision and meter internalization develop concurrently.

| Level | Name / Track | Core Skill | Primary Metric & Mastery Gate | Qualifying Criteria |
|---|---|---|---|---|
| **0** | Find the Pulse | Feel recurring beat, understand BPM | **Tap Stability:** Standard Deviation of inter-onset intervals (IOI) $\le 50\text{ ms}$ | 5 attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **1** | Tempo Anchors | Absolute tempo memory for anchors | **Anchor Recall Index (ARI):** $\text{ARI} \ge 85.0$ on each of 95, 120, 128, 140 BPM | Calculated over last 10 attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **2** | Rhythmic Structure A: Within the Beat | Quarter/eighth/sixteenth subdivision | **Subdivided Tap Stability:** SD $\le 45\text{ ms}$ on subdivision taps | 5 consecutive attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **3** | Rhythmic Structure B: Across Beats | Bar, beat 1, downbeat alignment | **Downbeat Phase Error:** Average phase error $\le 40\text{ ms}$ | 5 consecutive attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **4** | Half-Time/Double-Time | Tactus vs. measure, metrical ambiguity | **Metrical-Match Accuracy:** Deviation $\le 3.0\%$ on metrical targets | 5 consecutive attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **5** | Groove & Syncopation | Genre feel, tresillo, offbeat syncopation | **Syncopated Tap Stability:** SD $\le 40\text{ ms}$ on offbeat taps | 5 consecutive attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **6** | Phrasing | 4/8/16-bar phrase structure, form | **Phrase Loop Deviation:** Alignment error $\le 30\text{ ms}$ | 3 consecutive attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |
| **7** | Beatmatch & Drift | Phase vs. BPM, pitch fader nudge | **Pitch Nudge Drift:** Final phase drift $\le 20\text{ ms}$ | 3 consecutive attempts across $\ge 2$ sessions, $\ge 24\text{ hours}$ apart |

#### 4.2 Spaced Repetition Scheduling
*   New `AnchorSchedule` table: stores `ease_factor`, `interval_days`, `repetitions`, `next_review_at` per (user, anchor_bpm).
*   SM-2 algorithm adapted to map CMI ratings to quality scores (Tempo Wizard = 5, Needs Practice = 1).
*   Dashboard surfaces overdue anchor reviews as priority tasks.

#### 4.3 Academy Hub Page (`/academy`)
*   Visual curriculum map showing 8 levels with skill mastery indicators.
*   Skill graph per-user: pulse, anchor, subdivision, meter, half-time, groove, phrasing, beatmatch mastery scores.
*   Spaced review queue for overdue anchor recalls.
*   Lab launchers routing into existing `/game` routes or new `/piano` routes.

#### 4.4 Personal BPM Memory Map
*   Visual anchor timeline (60 → 90 → 95 → 120 → 128 → 140 → 174) with ARI scores, last attempt dates, and personal song tags.
*   Users can search iTunes API to attach a known song to any anchor BPM for a personal "feel" reference.

#### 4.5 Academy Discovery & Post-Login Transition
*   **Navigation Link Visibility:** The Academy Hub link `/academy` is dynamically injected into `base.html` for logged-in users only. It is completely absent for guests.
*   **Post-Login Transition:** Upon first login, or immediately after a guest registers and syncs their local attempts, the user is redirected to a welcome screen `/academy/welcome` showcasing their retroactive skill graph seeded from their guest sessions.
*   **Immediate Call-to-Action:** The landing page highlights the single most critical action item (e.g., "Start Level 0: Find the Pulse" or "Your 120 BPM anchor is overdue for SRS review").

#### 4.5 Invisible Metronome Lab
*   App counts 8 beats with metronome click, mutes for 8 beats, resumes.
*   Phase alignment on resumption measured in milliseconds (below 30ms = "Locked In").
*   The primary internal clock test — bridges CMI and Piano Lab equally.

---

### Version 5.0: Piano Lab & MIDI Integration [Designed — Future]

Version 5.0 introduces a dedicated **Piano Lab** module (`/piano`) and full **MIDI controller support**, extending the rhythm intelligence platform beyond DJ ear-training to instrument practice.

> [!NOTE]
> Piano Lab is a **public surface** (Layer 1) — fully usable without login, with the same guest-mode localStorage tracking as Count Me In. Only the Academy's structured curriculum and skill graph around Piano Lab content are auth-gated.

#### 5.1 MIDI Device Manager (`midi_manager.js`)
*   **Chrome/Edge only.** Uses `navigator.requestMIDIAccess()` (Web MIDI API). No cross-browser fallback planned — Firefox/Safari users see a one-line notice and fall back to keyboard-only mode automatically.
*   Converts note-on events to timestamped tap events, replacing spacebar input in any existing lab.
*   Device picker UI: "No MIDI? Use spacebar. MIDI detected: [device name]."

#### 5.2 Piano Lab Aesthetic
*   **Warm, acoustic design** — ivory/wood tones and classical feel, deliberately distinct from CMI's dark/neon/DJ palette.
*   Implemented as a dedicated `piano.css` stylesheet injected via the `{% block extra_css %}` mechanism (same pattern as `game.css`).
*   The contrast between the two tools is intentional: they serve different practice contexts and should *feel* different.

#### 5.2 Piano Lab Blueprint (`/piano`)
*   **Rhythm Drills:** Metronome-based pulse exercises, body-first before notation.
*   **Subdivision Trainer:** LH quarters, RH eighths, scored separately per hand.
*   **Chord-Loop Phrase Counter:** Play a 4-chord loop, count 8 bars to a phrase boundary.
*   **Invisible Metronome:** Piano equivalent — play 8 bars with click, 2 bars without, resync.
*   **MIDI Groove Matching:** App plays a reference groove; user matches it on MIDI keys in real time; drift scored.

#### 5.3 Piano + DJ Bridge Labs
*   **Left Hand Pulse:** CMI tap-tempo stability meets LH quarter-note accompaniment.
*   **Right Hand Eighths:** Subdivision recognition meets RH eighth-note patterns.
*   **Drop Prediction Piano:** Identify where the bridge/chorus starts; play a piano stab on beat 1 of the new section.
*   **Chord Change Timing:** App shows chord chart; user hits root note on each change; timing vs. phrase grid scored.

#### 5.4 Body Before Brain Mode
*   Dalcroze/eurhythmics-inspired physical exercises before any notation.
*   Labs: Walk at BPM (self-report), Clap on 2 and 4, Foot quarters + hand eighths (two-key or two-MIDI).
*   Lowest barrier entry for complete beginners.

---

## 📐 Architecture Vision

The full platform follows a three-layer model:

```
djon Music Hub (music.html)
├── Count Me In  (/game)   — DJ Ear Training       [public, Layer 1]
├── Piano Lab    (/piano)  — Instrument Practice   [public, Layer 1, planned]
├── Academy Hub  (/academy)— Curriculum & Progress [auth-gated, Layer 3, planned]
└── Shared Core            — Audio, MIDI, DB, Auth [Layer 2]
    ├── BpmAudioEngine (Tone.js)
    ├── MidiDeviceManager [planned]
    ├── Attempt model (+ module/skill_tag columns)
    ├── AnchorSchedule model (SRS) [auth-gated]
    └── UserSkillProfile (computed on-demand) [auth-gated]
```

For detailed system design and finalized decisions, see the [brainstorm document](file:///C:/Users/admir/.gemini/antigravity/brain/a8f27e5b-3ff5-4d50-855d-2775a58ec14f/implementation_plan.md).
