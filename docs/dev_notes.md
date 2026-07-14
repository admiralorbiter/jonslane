# Developer Notes & Feature Log

This log is used to brainstorm new features, track project updates, and maintain a running list of portfolio/research ideas.

---

## 🚀 Completed Projects

### 1. Count Me In (BPM Ear Trainer MVP)
- **Goal**: Help users train their tempo intuition by guessing browser-synthesized BPM beats by ear.
- **Features**:
  - Zero-database client-side play arena using Tone.js synthesizer pattern sequencers (House, Trap, Beginner).
  - High-DPI canvas visualizer, vinyl pitch-bend deceleration braking, and chord sweep audio feedback.
  - Browser `localStorage` stats tracking (Total drills, average error, range categorization, streaks) capped at a 1,000 sliding window.
  - Accessibility hotkeys (`Space`, `Enter`, `1`-`4`) and focus indicators.

### 2. Flask User Sign-in & Sync Ingestion API
- **Goal**: Implement secure user registrations, logins, and session management alongside transactional client-side local storage synchronization.
- **Features**:
  - Secure blueprints under `/auth/register`, `/auth/login`, and `/auth/logout` using Werkzeug password hashing.
  - Ingestion endpoint `/game/api/sync` that parses, validates bounds, and transactionally commits client attempts (preventing duplicates via UUID checks).
  - Chronological user streak calibration and synchronization.

### 3. Music (djon) Retro Profile Hub & Synthesizer
- **Goal**: Introduce the first dedicated interest section for the DJ alter-ego "djon" featuring a retro 2000s MySpace theme and interactive audio tools.
- **Features**:
  - Modular homepage Sections Grid showcasing the music hub with a slide-out, rotating neon vinyl sleeve card on hover.
  - Authentic MySpace profile layout containing a customized soft-blue grid background, blue and orange panel headers, Top 8 Friends, and a guestbook comments log.
  - Standing Web Audio API chiptune synthesizer engine utilizing precise look-ahead scheduling (100ms interval polling, 300ms advance scheduling) to play gapless loops.
  - Simultaneous, layered chiptune mashup of Beethoven's Moonlight Sonata (triplet arpeggios in the lower register) and Dr. Dre's "Still D.R.E." (staccato chords in the upper register).
  - Real-time HTML5 Canvas oscilloscope frequency visualizer synced directly to active synth outputs.
  - "djon's Crates" interactive vinyl selector letting visitors explore genre commentaries, view select playlists, and load tracks onto the retro player deck.

### 4. Spotify Integration & Live BPM Guessing
- **Goal**: Integrate user's real-time Spotify playback status with the BPM guessing game.
- **Features**:
  - **Spotify OAuth Credentials**: Flow integration to link accounts, store/refresh session tokens, and disconnect settings.
  - **Triple-Pipeline Resolver**: Seeding from reference tracks + fuzzy match (verified) fallback to background backend Librosa analysis on iTunes previews, with client-side Web Audio autocorrelation as a secondary fallback.
  - **Sticky Bottom bar**: Global track display that polls currently playing status, hides BPM values prior to guess submission, and supports quick inline guesses (input + Enter).
  - **Instant Score & Persistence**: Dynamically reveals rating badges (e.g. Perfect, Excellent) and true BPM inline, populating detail modals, and synchronizing guess attempts over page loads/refresh checks.

### 5. Space & Physics Explorable Explanations
- **Goal**: Help users develop intuitive mental models of physics and cosmology through inline dynamic simulations, real-time graphs, and scrollytelling.
- **Features**:
  - **4 Interactive Modules**: Built 1D Particle Dynamics, Galilean Relativity, Expanding Space Cosmology, and the **Connective Energy Pathway** (Coaster exchange, Double-well potential landscapes, Coulomb-projected friction, and numerical conservation).
  - **Symplectic Integration**: Leverages solvers from `solvers.js` (Euler-Cromer, Velocity Verlet) to maintain stable conserved states (shadow Hamiltonians) over long-term runs.
  - **Advanced Labs**: Implements patched-conics orbital mechanics, special relativity (Minkowski diagrams, Doppler shifts), and 1D Time-Dependent Schrödinger Equation quantum wavefunction solvers (split-step Fourier transforms).

---

## 🏗️ Upcoming Ideas & Projects

### 1. Experimental Archaeology for Ideas (New Section)
- **Goal**: A standalone research section at `/experimental-archaeology` where
  historical scientific theories are computationally reconstructed, honestly
  evaluated, and compared — not to mock old ideas, but to understand what
  made them compelling, what made them fail, and what survived them.
- **Design doc**: `docs/experimental_archaeology/README.md`
- **Planned case studies**:
  1. **Ptolemy, Copernicus & Kepler** — planetary astronomy; deferents/epicycles
     vs. elliptical orbits. Which observations discriminated them? Could an
     optimized Ptolemaic model rival early Kepler? (Full design doc: `case_studies/ptolemy_copernicus_kepler.md`)
  2. **Caloric Theory & Carnot** — How an incorrect theory of heat (conserved
     fluid) produced a correct result about engine efficiency. Carnot's proof
     survives caloric's fall because it rests on reversibility, not conservation.
     (Full design doc: `case_studies/caloric_theory.md`)
  3. **Corpuscular vs. Wave Light** — Competing models that both explained
     reflection; opposite predictions about speed in dense media proved decisive.
  4. **Cartesian Vortex Cosmology** — Fluid simulation of Descartes's contact
     mechanics; tests whether vortices can generate stable Keplerian orbits.
  5. **Luminiferous Ether Family Tree** — Successive modifications of ether
     theory vs. each experiment; culminates in the Lorentz/Einstein equivalence
     question.
  6. **Le Sage Mechanical Gravity** — Particle bombardment gravity: generates
     inverse-square force, also predicts drag, heating, and shielding that
     are not observed.
- **Architecture highlights**:
  - Shared `Theory` interface (ontology, state, dynamics, parameters,
    observables, sources) reused across all case studies
  - **Assumption Ledger**: every encoded claim carries a confidence marker
    (`EXPLICIT`, `HISTORICAL`, `RECONSTRUCTION`, `EXTENSION`, `COUNTERFACTUAL`)
  - Synchronized four-panel layout: Physical Picture + Observable Instrument
    + Residual Plot + Historical Context
  - Knowledge-date switch: evaluate any theory only on evidence available
    before a user-selected year
  - Four reconstruction modes per study: Historically Faithful, Charitable
    Modern, Best-Fit (optimized), Counterfactual
- **Aesthetic**: Astronomical atlas / 18th-century instrument diagram inspiration.
  Parchment palette, serif typography, slow deliberate animations.

### 2. External Audio Importers & Admin Queue
- **Goal**: Integrate licensed or public domain real-world tracks for advanced ear training.
- **Features**:
  - Freesound/Jamendo API integrations for query pulling.
  - Admin approval page to preview tracks, confirm licenses, and publish approved audio to challenges.

### 3. Count Me In Academy (V4)
- **Goal**: Restructure Count Me In as an 8-level **Rhythm Intelligence Academy** with a year-long structured learning path grounded in learning science (spaced repetition, interleaving, metacognition).
- **Features:**
  - Academy Hub page (`/academy`) with visual curriculum map, skill graph, and spaced review queue.
  - 8 progressive levels (Find the Pulse → Tempo Anchors → Subdivide → Meter → Half-Time → Groove → Phrasing → Beatmatch).
  - SM-2 spaced repetition scheduler for anchor recall reviews (`AnchorSchedule` model).
  - "Why Was I Wrong?" Diagnostic Engine generating plain-English feedback on every attempt.
  - Tempo Nudge Slider — a third input mode where users drag to match tempo by feel (Vigl et al., 2024).
  - Invisible Metronome Lab — metronome mutes for 8 beats; user maintains internal clock.
  - Personal BPM Memory Map — visual anchor dashboard with ARI scores and personal song tags.
  - Metrical X-Ray Visualizer — educational overlay showing tatum/tactus/measure/phrase layers.
- **Design doc:** See `docs/count_me_in/roadmap.md` V4 section.

### 4. Piano Lab (V5)
- **Goal**: Dedicated piano/instrument practice module (`/piano`) sharing the same user profile, audio engine, and Attempt model as Count Me In.
- **Features:**
  - Rhythm drills for piano: pulse, subdivision (LH quarters + RH eighths), invisible metronome, phrase counting.
  - MIDI controller support via Web MIDI API — real key presses replace spacebar taps.
  - Body Before Brain mode: walking, clapping, two-limb coordination exercises (Dalcroze-inspired).
  - Piano + DJ Bridge labs connecting CMI skills (phrase counting, tempo anchors) to piano accompaniment patterns.
- **Design doc:** See `docs/count_me_in/roadmap.md` V5 section and `docs/count_me_in/technical_spec.md` Sections 8–9.

### 5. MIDI Device Manager
- **Goal**: Shared JS module (`midi_manager.js`) enabling MIDI controller input across all rhythm labs.
- **Features:**
  - `navigator.requestMIDIAccess()` with graceful fallback for Firefox/Safari.
  - MIDI note-on timestamp integration with existing tap-tempo pipeline (zero refactoring needed).
  - Device picker UI surface.
- **Design doc:** See `docs/count_me_in/technical_spec.md` Section 8.

---

## 📝 Ongoing Refinements
- **SQLAlchemy Migrations**: Integrate `Flask-Migrate` (Alembic wrapper) to manage changes when auth columns are added to models.
- **Ruff Linting**: Maintain import organization hooks during standard development.
