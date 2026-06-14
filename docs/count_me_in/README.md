# Count Me In | BPM Ear-Training Game

"Count Me In" is an interactive, browser-based ear-training application designed to help music producers, DJs, and live performers train their tempo intuition by guessing BPM beats by ear.

---

## 🎮 Gameplay Overview

Players select a **Crate** (each representing a different tempo range and genre style) and listen to a procedurally generated, loop-based audio sequence. The objective is to guess the current playback BPM as accurately as possible.

### Difficulty Crates
1. **Beginner Crate** (Easy): Metronomic beats between **100 and 120 BPM**. Perfect for learning the basics of tempo estimation.
2. **House Crate** (Medium): Four-to-the-floor rhythms between **118 and 132 BPM**. Focuses on fine tempo sensitivity.
3. **Half-Time Trap Crate** (Hard): Syncopated trap beats between **65 and 80 BPM** (which can easily be confused with double-time 130–160 BPM).

---

## 💡 Scoring & Clue Rules

To help players, the game offers four **Clue Reveal Layers**. Using clues lowers the maximum potential score for the round:

| Clue Level | Audio Elements Enabled | Score Multiplier | Max Potential Payout |
| :--- | :--- | :--- | :--- |
| **Level 1** | Kick Only | `0.5x` | **50 points** |
| **Level 2** | Kick + Snare | `0.6x` | **60 points** |
| **Level 3** | Kick + Snare + Hi-Hat | `0.75x` | **75 points** |
| **Level 4** | Full Groove (e.g., Synth/Bass) | `1.0x` | **100 points** |

### Accuracy Ratings
Based on the percentage error of the guess compared to the true BPM:
* **Tempo Wizard** (Error < 1.0%): Base 100 points. Increments active streak.
* **DJ-Ready** (Error <= 3.0%): Base 75 points. Increments active streak.
* **Solid Ear** (Error <= 5.0%): Base 50 points. Increments active streak.
* **Getting There** (Error <= 8.0%): Base 25 points. Resets active streak.
* **Needs Practice** (Error > 8.0%): Base 10 points. Resets active streak.

---

## ⌨️ Hotkeys & Accessibility

The game is optimized for keyboard-only play to ensure zero-latency interaction:
* `[Spacebar]`: Start / Stop playback.
* `[1]` – `[4]`: Switch clue layers dynamically during playback.
* `[Enter]`: Submit guess when typing in the input field.

*Note: Hotkeys are automatically bypassed if the cursor is active inside the guess input field.*

---

## 📚 Research Grounding

"Count Me In" is built on academic findings in music perception and sensorimotor synchronization:
* **DJ Accuracy & The 3% Band**: Foster et al. (2021) showed that professional DJs achieve ~3.10% accuracy in the 120–139 BPM club tempo range. This directly supports our **3.0% "DJ-Ready"** threshold.
* **Tempo Memory & The 8% Band**: Levitin & Cook (1996) demonstrated that absolute tempo memory is preserved in long-term memory, with 72% of trials falling within 8% of the original tempo. This supports our **8.0% "Getting There"** threshold.
* **Metrical Ambiguity**: Serato, Traktor, and Rekordbox instruction manuals all document that automatic analysis software frequently makes "octave errors" (halving or doubling the BPM). In Music Information Retrieval (MIR) research, this is recognized as metrical level ambiguity (Klapuri, 2006). The **"Metrical Match"** rating handles this by awarding partial credit and preserving active streaks.

For the full list of references, see the [Research Bibliography](file:///c:/Users/admir/Github/jonslane/docs/count_me_in/research_citations.md).

---

## 🎓 Future Direction: Count Me In Academy

Count Me In is designed to grow into a **year-long Rhythm Intelligence Academy** — a structured, research-grounded learning path that teaches four interconnected skills together:

1. **Perception** — Hear pulse, tempo, meter, and downbeat
2. **Motor control** — Tap, clap, count, and play in time
3. **Music theory** — Understand beat, subdivision, meter, bar, phrase, syncopation
4. **DJ/piano application** — Beatmatch, count phrases, practice with and without a metronome

The planned curriculum has 8 progressive levels (Level 0: Find the Pulse → Level 7: Beatmatch & Drift) and incorporates three learning science principles: **spaced retrieval** (Carpenter et al., 2012), **interleaved practice** (Kornell & Bjork, 2008), and **metacognitive reflection** (Hallam, 2001).

A companion **Piano Lab** module and **MIDI controller integration** are also designed, sharing the same user profile, audio engine, and scoring pipeline.

For the full roadmap see [roadmap.md](file:///c:/Users/admir/Github/jonslane/docs/count_me_in/roadmap.md). For technical system designs see [technical_spec.md](file:///c:/Users/admir/Github/jonslane/docs/count_me_in/technical_spec.md).
