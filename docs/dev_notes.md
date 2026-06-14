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

---

## 🏗️ Upcoming Ideas & Projects

### 1. Flask User Sign-in & Sync Ingestion API
- **Goal**: Implement user logins (email, password hash, sessions) so players can persist their local attempts data permanently in the server database.
- **Features**:
  - Ingestion endpoint `/game/api/sync` that parses, deduplicates (via UUID check), and writes client attempts to SQLite.
  - Interactive profile page displaying global leaderboards, historic progress graphs, and account settings.

### 2. External Audio Importers & Admin Queue
- **Goal**: Integrate licensed or public domain real-world tracks for advanced ear training.
- **Features**:
  - Freesound/Jamendo API integrations for query pulling.
  - Admin approval page to preview tracks, confirm licenses, and publish approved audio to challenges.

---

## 📝 Ongoing Refinements
- **SQLAlchemy Migrations**: Integrate `Flask-Migrate` (Alembic wrapper) to manage changes when auth columns are added to models.
- **Ruff Linting**: Maintain import organization hooks during standard development.
