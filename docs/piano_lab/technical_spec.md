# Piano Lab & MIDI Trainer | Technical Specification

This document details the software design, event timing translations, and scoring mathematics behind the **Piano Lab & MIDI Trainer** (Version 5.0).

---

## 1. Event Timing & Latency Compensation

Piano Lab uses the Web MIDI API to process keypress events with high-resolution timing. The client synchronizes these events using two specialized classes:

### `PrecisionAudioSync`
Translates `DOMHighResTimeStamp` (from MIDI events in milliseconds) to Tone.js `AudioContext` seconds, compensating for device output latency:
- **High-Precision Path:** If `getOutputTimestamp()` is available, the system pairs the hardware clocks:
  $$\text{Clock Offset} = t_{\text{perf}} - (t_{\text{ctx}} \times 1000)$$
  $$t_{\text{audio}} = \frac{t_{\text{MIDI}} - \text{Clock Offset}}{1000}$$
- **Fallback Path:** Uses the delta between `performance.now()` and current context time:
  $$\text{Clock Offset} = t_{\text{now}} - (t_{\text{contextCurrent}} \times 1000)$$
  $$t_{\text{audio}} = \frac{t_{\text{MIDI}} - \text{Clock Offset} - \text{outputLatency}}{1000}$$

---

## 2. Web MIDI Processing

### `MidiDeviceManager`
Responsible for port discovery, channel filtering, sustain pedal mapping, and note clustering.

#### Chord clustering
When a user plays a piano chord, notes are struck in rapid succession but slightly spread out. To prevent registering separate taps for each key in a single chord, the manager clusters notes:
- Uses a **25ms clustering window** (`clusterWindowMs`).
- When a note-on command is detected, a timeout is scheduled. Any subsequent notes played within the window are grouped into a single `Stroke` object.
- The average timestamp of all keys in the stroke determines the tap timing.

#### Sustain Pedal (CC 64) Tracking
Tracks sustain pedal status to coordinate audio envelope releases:
- When the sustain pedal (Control Change 64) value is $\ge 64$, sustain is marked active.
- Note-off events received while sustained are added to a `pendingNoteOffs` set.
- Once the sustain pedal drops below 64, note-off trigger events are immediately fired for all pending notes to prevent audio leakage.

---

## 3. Scoring Mathematics

Attempt results are evaluated by `calculate_piano_score_and_rating` inside `portfolio/routes/game.py`:

### Metrics

1. **Tap Stability ($S_{\text{tap}}$):** The standard deviation of the user's inter-onset intervals (IOI) in milliseconds.
2. **Phase Error ($E_{\text{phase}}$):** The mean absolute time deviation between user taps and closest metrical grid points in milliseconds.
3. **Percent Error ($E_{\text{pct}}$):** Standard tempo deviation from the target BPM.

### Scoring Formula
For a stability-based drill:
$$\text{Stability Score} = 100 - \frac{S_{\text{tap}}}{2.5}$$
For a grid-locked phase drill:
$$\text{Phase Score} = 100 - \frac{E_{\text{phase}}}{3.0}$$
Scores are clamped between $0$ and $100$.

### Performance Ratings
- **Score $\ge 95$:** `Tempo Wizard` (Mastery)
- **$85 \le \text{Score} < 95$:** `DJ-Ready` (Highly Consistent)
- **$70 \le \text{Score} < 85$:** `Solid Ear` (Stable)
- **$50 \le \text{Score} < 70$:** `Getting There` (Developing)
- **Score $< 50$:** `Needs Practice` (Unstable)

---

## 4. UI Feedback & Count-in Lifecycle

### Warmup Count-in Sequence
Before starting a drill, a **1-bar metronome count-in** plays:
- The system fires four synthesizer click triggers (`C6`) at the target BPM.
- Renders visual digits (4, 3, 2, 1) in the viewport.
- Keeps input listener status locked during the count-in to prevent initial timing errors.

### Real-Time Precision Indicators
Flashes timing evaluation text above the keyboard interface based on boundaries:
- **Perfect:** Tap falls within $\pm 25\text{ms}$ of the target grid point.
- **Early:** Tap falls before grid point ($< -25\text{ms}$).
- **Late:** Tap falls after grid point ($> 25\text{ms}$).

### Active Teardown (`stopActiveDrills`)
Instantly disposes resources on mode changes or panel collapse:
- Halts the `Tone.Transport` sequencer.
- Cancels all pending Javascript timeouts and loops.
- Cleans up connected MIDI callback mappings to prevent memory leakage.
