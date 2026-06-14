# Count Me In | Version 2.0 Roadmap

This document outlines the focus areas, features, and implementation blueprints for **Version 2.0 (V2)** of Count Me In, as well as future research directions for **Version 3.0 (V3)**.

---

## 🚀 Version 2.0 Focus: Anchors, Taps, and Metrical Precision

The primary goal of V2 is to transition the game from a randomized BPM quiz to a scientifically grounded tempo training program.

### Feature 1: Tap-Tempo Input Mode
*   **Concept:** Allows users to input their guess by tapping a key (e.g. `[T]` or `[Space]`) in time with the playback groove instead of typing a number.
*   **Scientific Grounding:** Tapping integrates **auditory estimation** with **motor synchronization** (sensorimotor synchronization as reviewed in Repp & Su, 2013).
*   **Implementation:**
    *   Record intervals (in ms) between consecutive key taps.
    *   Filter out outliers (taps too close together or too far apart).
    *   Calculate the running average interval and convert it to BPM ($60,000 / \text{interval\_ms}$).
    *   Evaluate **Tap Stability**: Display the standard deviation of tap intervals as a metric of the player's motor consistency.
    *   Compare the user's *auditory guess* (typed) with their *motor guess* (tapped).

### Feature 2: Anchor Tempo Training Path
*   **Concept:** A mode focused on developing absolute tempo memory (Levitin & Cook, 1996) by using stable reference "anchors."
*   **Scientific Grounding:** Levitin's work proves that absolute tempo representation is preserved in long-term memory. DJs use well-known reference tracks (anchors) to determine the BPM of unknown tracks.
*   **Implementation:**
    *   **Calibration Phase:** Expose the user to a clean, metronomic beat at a stable reference tempo (e.g. 100, 120, 128, 140 BPM) for 15 seconds, explicitly labeling the BPM.
    *   **Test Phase:** Play a randomized beat close to the anchor tempo and ask the user to guess it relative to the anchor (e.g., "Is this 128 or 124 BPM?").
    *   **Progression:** Over time, remove the calibration phase and test absolute recall.

### Feature 3: Genre-Specific DJ Crates
*   **Concept:** Create crates centered on real-world DJ tempo-matching scenarios:
    *   **95 BPM Crate** (Boom-Bap Hip Hop): Focusing on Moelants (2003) secondary peak.
    *   **128 BPM Crate** (Mainstage Dance): The most common dance tempo peak (Moelants, 2003).
    *   **140 BPM Crate** (Dubstep/Trap Metrical Ambiguity): Specifically training users to identify half/double time.
    *   **170 BPM Crate** (Drum & Bass): High-tempo training.

---

## 🔮 Version 3.0 & Future Work: Rhythmic Alignment & Machine Match

V3 transitions the project from a "Tempo Trainer" to a complete "DJ Rhythm & Sync Coach."

### Feature 1: Beatgrid & Downbeat Alignment Mini-game
*   **Concept:** Instead of guessing BPM, players are presented with a beat grid that is misaligned, shifted, or locked to the wrong transient (e.g., a snare instead of a kick).
*   **Implementation:**
    *   The user must shift the grid left/right or contract/expand it until it aligns perfectly with the downbeat (beat 1) of the audio loop.
    *   Integrates Serato and Traktor style beatgrid-setting workflows.

### Feature 2: "Algorithm Ghost" Mode (Human vs. Machine)
*   **Concept:** After a user submits their guess, run the audio loop through a client-side Web-Assembly implementation of a beat-tracking algorithm (e.g., Ellis-style or autocorrelation-style like `librosa` or `Essentia`).
*   **Implementation:**
    *   Display the machine's BPM estimation and its confidence rating.
    *   Compare the human's metrical interpretation with the machine's metrical interpretation (e.g. did the machine get confused and guess 140 BPM for a 70 BPM track?).
    *   Teaches users the limitations of software beat-detection.
