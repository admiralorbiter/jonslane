# Count Me In | Product & Feature Roadmap

This document outlines the version milestones, completed work, and future directions for the **Count Me In** BPM training application.

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

## 🔮 Future Roadmap (Version 3.0)

Version 3.0 focuses on shifting Count Me In from a "Tempo Trainer" to a complete **DJ Rhythm, Sync, & Alignment Coach**.

### 1. Beatgrid & Downbeat Alignment Mini-game
*   **Concept:** Instead of guessing BPM, players are presented with a loop where the visual beat grid is misaligned, phase-shifted, or locked to the wrong transient (e.g., a snare instead of a kick).
*   **Implementation:**
    *   The user must shift the grid left/right (phase adjustment) or contract/expand it (BPM adjustment) using keyboard shortcuts until the visual grid aligns perfectly with the downbeat (beat 1) of the audio loop.
    *   Integrates standard Serato, Traktor, and Rekordbox style manual beatgrid-setting workflows.

### 2. "Algorithm Ghost" Mode (Human vs. Machine)
*   **Concept:** Compete against client-side beat-tracking algorithms to highlight the strengths and limitations of automated software.
*   **Implementation:**
    *   After the player submits a guess, the engine runs the audio loop through a client-side beat-tracking algorithm (e.g., Ellis-style onset detection or autocorrelation-style analyzer).
    *   Displays the machine's BPM estimate, its confidence metric, and compares the human's interpretation with the machine's (e.g. did the machine get confused by half-time cymbals?).
    *   Teaches users how algorithms can get tripped up by syncopated beats, metrical ambiguity, or polyrhythms.

### 3. Haptic Feedback Integration (Mobile/Controllers)
*   **Concept:** Leverage mobile haptic engines to vibrate the device on the downbeat or when a tap matches/misses the tempo.
*   **Implementation:**
    *   Use the HTML5 Vibration API to pulse the device on step 0 (downbeat) or provide tactile confirmation on taps, reducing input lag perception.
