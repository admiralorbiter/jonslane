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

---

## 🏗️ Upcoming Ideas & Projects

### 1. External Audio Importers & Admin Queue
- **Goal**: Integrate licensed or public domain real-world tracks for advanced ear training.
- **Features**:
  - Freesound/Jamendo API integrations for query pulling.
  - Admin approval page to preview tracks, confirm licenses, and publish approved audio to challenges.

---

## 📝 Ongoing Refinements
- **SQLAlchemy Migrations**: Integrate `Flask-Migrate` (Alembic wrapper) to manage changes when auth columns are added to models.
- **Ruff Linting**: Maintain import organization hooks during standard development.
