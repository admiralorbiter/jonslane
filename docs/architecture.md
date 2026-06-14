# Architecture & Design Overview

This document describes the design principles, application structure, and extension patterns used in the portfolio codebase.

## Design Philosophy

The project is structured to scale cleanly. While starting with a simple homepage and resume/project links, the project setup uses a modular Flask pattern (Application Factory with Blueprints) rather than a single-file script. This avoids high-refactoring costs later.

---

## 🏗️ Directory Layout and Patterns

### 1. Application Factory (`portfolio/__init__.py`)
Rather than initializing a global `app` object directly in the module scope, we use `create_app(config_name)`. This allows:
- Clean configuration switching (Development vs. Testing vs. Production).
- Initialization of Flask extensions (such as Flask-SQLAlchemy) separately from the application instance.
- Avoidance of circular imports between routes, models, and application settings.

### 2. Database Models (`portfolio/models.py`)
All database schema are defined using Flask-SQLAlchemy's ORM syntax.
- Tables are automatically created during server boot if they don't already exist (handled in `app.py`).
- SQLite writes local data to the root-level `instance/portfolio.db` directory.
- Model logic is kept separated from views to ensure clean database migration capabilities later if needed.

### 3. Modular Routes (`portfolio/routes/`)
Routes are registered under Flask **Blueprints**.
- The main page views are located in `portfolio/routes/main.py`.
- As new modules (e.g. specialized research projects, custom interactive tools, dashboard interfaces) are developed, they should be created as their own Python modules inside `routes/` and registered in `portfolio/__init__.py`.

---

## 🎨 Theme & Style Extension Pattern

A key requirement is to allow custom, rich styling depending on the page or section. We implement this using two mechanisms:

### 1. CSS Custom Properties (Variables)
`portfolio/static/css/main.css` defines the core style tokens inside the `:root` pseudo-class. These include:
- Typography rules (fonts, scale)
- Primary/secondary color gradients using HSL values
- Glassmorphic backdrop filters
- Standard micro-animations (e.g., button hovers, link highlights)

### 2. Section Stylesheet Injection
In `portfolio/templates/base.html`, a standard Jinja2 block is defined inside the `<head>` tag:

```html
<!-- Base Stylesheet -->
<link rel="stylesheet" href="{{ url_for('static', filename='css/main.css') }}">

<!-- Page-specific styles -->
{% block extra_css %}{% endblock %}
```

If a specific sub-project requires a completely different style (e.g., a retro terminal styling for a research page, or a high-contrast theme), the sub-template can inject its own stylesheet or inline style adjustments within this block:

```html
{% block extra_css %}
<link rel="stylesheet" href="{{ url_for('static', filename='css/research_retro.css') }}">
<style>
  :root {
    --bg-primary: #051a05;
    --text-primary: #33ff33;
    --accent-color: #00ff00;
  }
</style>
{% endblock %}
```

---

## 🎧 Hybrid Client-Server Pattern (e.g., "Count Me In")

For interactive, zero-latency applications like the BPM ear trainer, we employ a hybrid architecture where the server manages metadata configurations while the browser orchestrates audio engines, canvas loops, and temporary storage:

### 1. Zero-Database Client Gameplay
- The Flask backend fetches static configurations (like `Crate` categories and boundaries) and renders them.
- Procedural challenge recipe details (target BPM, genre instruments) are randomized on-the-fly when loading `/game/play/<id>` and injected into DOM data attributes (`id="recipe-meta"`), bypassing server-side database writes during active gameplay.

### 2. Browser LocalStorage State Engine
- Attempt logs, accuracy metrics, and streak counts are computed directly in client JavaScript and cached under `localStorage` namespaces (`count_me_in_attempts`, `count_me_in_streak`).
- To keep JSON parsing latency below 5ms (preventing main-thread blocking), the local attempts history is capped to a **sliding window of 1,000 records**.

### 3. Web Audio (Tone.js) Lifecycle Management
- **Autoplay Compliance**: Audio context initializes only after explicit user interaction (e.g. clicking "Play Groove").
- **Resource Disposal**: When navigating away or stopping playback, the custom engine calls `.dispose()` on all active synth nodes and loops to free Web Audio memory.
- **Background Throttling**: Tab changes (`visibilitychange` listener) automatically suspend the loops to conserve client battery.

### 4. Auth & Synchronization Integration
- **Session-Based Authentication**: Provides Register, Login, and Logout functionality using secure Werkzeug password hashing and cryptographic Flask sessions.
- **Transactional Client-Side Sync**: Copies local storage attempts, posts them to `/game/api/sync` on page load/interaction, and transactionally filters out successfully synced items (using unique UUID keys) to prevent duplicate database writes and preserve in-flight gameplay logs.
- **Streak Calibration**: The backend chronologically aggregates all synced attempts to calibrate streaks, which then overwrite the local storage streak values.

---

## 🎹 Multi-Module System & Academy

The architecture is built as a **three-layer system** where public tools, a shared technical core, and a private Academy co-exist cleanly. See `docs/count_me_in/roadmap.md` for the full feature roadmap.

### System Layers

```
Layer 1: Public Surfaces (no login required)
├── Count Me In (/game)   — DJ BPM ear training
├── Piano Lab   (/piano)  — Instrument rhythm practice
└── Any future public tools

Layer 2: Shared Technical Core (invisible to users)
├── BpmAudioEngine (Tone.js)   — shared audio engine
├── MidiDeviceManager           — shared MIDI input
├── Attempt model               — shared attempt logging
├── User model + auth           — shared identity
└── utils/srs.py, diagnostics  — shared algorithms (SRS implemented, diagnostics planned)

Layer 3: Academy (/academy)     — AUTH-GATED: logged-in users only
├── Curriculum map + skill graph
├── Spaced repetition review queue
├── Progress tracking across ALL modules
├── Future: language, other learning experiences beyond music
└── Academy-exclusive content (never surfaced publicly)
```

### Key Architectural Constraints

- **Academy is invisible to guests.** Non-logged-in users cannot see `/academy` routes at all. No navigation link, no teaser, no locked preview. It simply does not exist for unauthenticated requests.
- **Academy is not music-specific.** It is the private, personalized meta-layer for the whole portfolio. It begins with music tools (CMI + Piano Lab) but is designed to accommodate language learning, other skill trainers, or any future learning project built on this platform.
- **Public tools are fully standalone.** Count Me In, Piano Lab, and all future Layer 1 tools work completely without login, using guest-mode localStorage tracking exactly as CMI does today.
- **Academy consumes, never owns.** It reads from the same `Attempt` table the public tools write to. When a guest logs in and their data syncs, it automatically feeds into their Academy skill graph.
- **Some features are Academy-exclusive.** Spaced repetition scheduling, the full skill graph, metacognitive reflection prompts, and structured curriculum content are never surfaced publicly.

### 5. Piano Lab Blueprint (`routes/piano.py`)

A new Flask Blueprint at `/piano` following the same pattern as the game blueprint:

```
/piano/              — Lab selector / Piano Lab home
/piano/drill/<id>    — Active drill page (mirrors /game/play/<id>)
/piano/api/attempt   — Submit attempt (same model, module="piano_lab")
```

- Shares the `Attempt` model with an added `module` discriminator column.
- Reuses the same `calculate_score_and_rating()` function and auth system.
- Uses the same Tone.js `BpmAudioEngine` for metronome clicks and groove playback.
- Adds MIDI input support via the new `MidiDeviceManager` class.
- **Aesthetic:** Warm, acoustic design (ivory/wood tones) — deliberately distinct from CMI's dark/neon palette. Implemented via a dedicated `piano.css` stylesheet injected via the `{% block extra_css %}` mechanism.

### 6. Academy Blueprint (`routes/academy.py`)

A new Flask Blueprint at `/academy`, fully protected by `@login_required` at the blueprint level:

```
/academy/                — Curriculum map, skill graph, review queue
/academy/level/<n>       — Level detail page (0–7 for music; extensible)
/academy/api/skill-graph — JSON: user skill profile
/academy/api/review-queue — JSON: anchors due for SRS review
```

- Every route returns 403 or redirects to login for unauthenticated requests.
- Reads computed `UserSkillProfile` values (aggregated on-demand from the `Attempt` table) and `AnchorSchedule` models.
- Routes users into `/game` or `/piano` labs based on Academy level.
- No public-facing teaser or preview mode.

### 7. MIDI Device Manager (`static/js/midi_manager.js`)

A new client-side module following the same lifecycle contract as `BpmAudioEngine`:

```javascript
class MidiDeviceManager {
    async init()          // navigator.requestMIDIAccess() — Chrome/Edge only
    onNoteOn(callback)    // note-on events → tap pipeline
    selectDevice(id)      // choose active MIDI input port
    dispose()             // clean up event listeners
}
```

- **Chrome/Edge only.** No cross-browser fallback planned. The `init()` method catches `SecurityError` and `DOMException` and silently degrades to keyboard-only mode, displaying a one-line notice.
- MIDI `MIDIMessageEvent.timeStamp` is compatible with `performance.now()`, so it drops transparently into the existing tap-tempo timing pipeline with zero refactoring.
- Follows the same `dispose()` cleanup contract as `BpmAudioEngine` to prevent event listener leaks.

### 8. New DB Models

| Model | Purpose | Access |
|---|---|---|
| `AnchorSchedule` | SM-2 spaced repetition schedule per (user, anchor_bpm) | Academy-only (auth-gated) |
| `UserSkillProfile` (Computed) | Calculated on-demand by aggregating `Attempt` rows (no dedicated DB table) | Academy-only (auth-gated) |

Both follow the same ORM conventions as existing models. All existing queries are unaffected.
