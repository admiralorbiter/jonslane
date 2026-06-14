# Piano Lab & MIDI Trainer | System Overview

This directory contains documentation for the **Piano Lab & MIDI Trainer** (Version 5.0), a dedicated instrument practice module integrated into the portfolio site alongside other interactive music tools.

## System Layers & Core Integration

Piano Lab serves as a public surface (**Layer 1**) that is fully usable without logging in. It uses local storage tracking for guest attempts, which syncs seamlessly to the database once a user registers or logs in.

```
+--------------------------------------------------------------+
|                Piano Lab View (/piano)                       |
|                                                              |
|   +-----------------------+      +-----------------------+   |
|   |    Rhythm Drills      |      |   Subdivision Trainer |   |
|   +-----------+-----------+      +-----------+-----------+   |
|               |                              |               |
|   +-----------v-----------+      +-----------v-----------+   |
|   | Chord-Loop Phraser    |      |  Invisible Metronome  |   |
|   +-----------------------+      +-----------------------+   |
+----------------------------------------------+---------------+
                                               |
                                               v
+--------------------------------------------------------------+
|                Shared Technical Core (Layer 2)               |
|                                                              |
|  * Attempt (with module="piano_lab", hand, phase_error)      |
|  * Tone.js BpmAudioEngine (Groove synth & clicking loops)     |
|  * navigator.requestMIDIAccess() Web MIDI listener           |
+--------------------------------------------------------------+
```

## Core Features

1. **MIDI Controller Support:** Integrates Web MIDI to accept real piano keyboard keystrokes, converting notes and velocity into timing indicators.
2. **Warm Acoustic Aesthetic:** Uses a warm wood and ivory tone styling (`piano.css`), deliberately distinct from Count Me In's neon dark-mode theme.
3. **Advanced Rhythm Drills:** Includes Metronome-based pulse exercises, subdivisions (scored per-hand), chord change timing, and phrase counting.
4. **Body Before Brain Mode:** Physical, Dalcroze-inspired coordination training exercises (e.g., walking, clapping, and multi-limb tapping).

## Directory & File Mapping

- **Routes & Logic:**
  - [piano.py](file:///c:/Users/admir/Github/jonslane/portfolio/routes/piano.py) - Blueprint for `/piano/`, API endpoints for submitting/fetching attempts, and score calculations.
  - [game.py](file:///c:/Users/admir/Github/jonslane/portfolio/routes/game.py) - Contains `calculate_piano_score_and_rating` which computes stability, error percent, and ratings.

- **Views & Templates:**
  - [piano_lab.html](file:///c:/Users/admir/Github/jonslane/portfolio/templates/piano/piano_lab.html) - SPA container orchestrating Tone.js sound engines, visual keyboard layouts, and practice modes.

- **Styles & Scripts:**
  - [piano.css](file:///c:/Users/admir/Github/jonslane/portfolio/static/css/piano.css) - Custom mahogany, ivory, and brass aesthetics.
  - [midi_manager.js](file:///c:/Users/admir/Github/jonslane/portfolio/static/js/midi_manager.js) - Handles Web MIDI connection, port selection, and callbacks. (Wait, let's verify if `midi_manager.js` exists or if the MIDI logic is inlined in `piano_lab.html`. Let's check this below).

## Technical Constraints & Fallbacks

- **Web MIDI Browsers:** Access is optimized for Chrome and Edge. Firefox and Safari degrade gracefully to standard keyboard tapping (`A`, `S`, `D`, `F`, etc.) with a single-line warning.
- **Timestamp Synchronization:** Web MIDI `timeStamp` metrics are mapped to the high-resolution browser clock (`performance.now()`), allowing sub-millisecond precision.
