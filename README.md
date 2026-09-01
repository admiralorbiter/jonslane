# Jon's Lane (`jonslane`) — Creative Computing Workspace & Portfolio Lab (Summer 2026)

> **Status:** `[COMPLETED PERIOD ARTIFACT / FROZEN CREATIVE WORKSPACE]` (June 14 – July 14, 2026: ~35+ commits) — **Kept Public**  
> **Host Environment:** Python 3.10+, Flask, SQLite, Tailwind, Tone.js, Three.js, Canvas  
> **Portfolio Reference:** [`bigbraintime/projects/jonslane-creative-workspace.md`](https://github.com/admiralorbiter/bigbraintime)  

---

## Retrospective: A Laboratory of Native Interface Metaphors

*Jon's Lane* was an intensive one-month creative computing workspace. Rather than a conventional static résumé website, it functioned as an incubator where **interfaces were built to embody the physical/aesthetic metaphor of their subject matter:**

```text
               ┌────────────────────────────────────────────────────────┐
               │           JON'S LANE (Summer 2026 Workspace)            │
               │   "One man's personal traffic pattern & interactive lab"│
               └──────────────────────────┬─────────────────────────────┘
                                          │
        ┌───────────────────┬─────────────┴───────┬───────────────────┐
        ▼                   ▼                     ▼                   ▼
 [ MUSIC & DJ ]      [ AI LITERACY LAB ]   [ EXPERIMENTAL ARCH. ] [ SPACE & PHYSICS ]
 ├── MySpace Retro   ├── Windows XP Lab    ├── Brass/Parchment    ├── 3D Orbitals &
 │   Music Profile   │   Notepad Chrome    │   Astronomical Atlas │   Relativity Labs
 └── DJ Roomba &     └── Grounded Literacy └── Historical Theory  └── Quantum Phase
     Count Me In         Essays & Tools        Orrery Simulator       Scrollytelling
```

### The Architectural Transition: From Monolith to the 4-Domain Future

In Summer 2026, *Jon's Lane* held identity, products, writing, educational explainers, and research at a single navigation level. This generative explosion informed the clean structural separation of your modern ecosystem:
- **Work:** [`PREP-KC/modeling`](https://github.com/PREP-KC), [`the_haystack`](https://github.com/admiralorbiter/the_haystack), [`hope-scale`](https://github.com/admiralorbiter/hope-scale).
- **Research:** [`science-book`](https://github.com/admiralorbiter/science-book).
- **Writing:** Future Rethink Blog / Public Essays.
- **Play:** [`computational-sketchbook`](https://github.com/admiralorbiter/computational-sketchbook).

---

# Jon's Portfolio & Research Workspace

Welcome to my personal portfolio and research workspace! This project is built to showcase custom web projects, technical research, and experiments.

Currently, it features:
* **Count Me In**: A scientifically grounded BPM ear-training program for DJs and musicians.
* **Space & Physics Explorable Explanations**: A collection of inline scrollytelling visualizers, phase-space plots, and custom physics simulation labs (classical mechanics, relativity, cosmology, and quantum mechanics).

### 🎧 Count Me In features:
* **Tap Tempo Input**: Estimate tempo by tapping keys or clicking a tap pad, capturing timing consistency (motor stability).
* **Anchor Tempo Training**: A structured level progression mode designed to build long-term absolute tempo memory (Levitin & Cook, 1996) around stable reference anchors (95, 120, 128, 140 BPM).
* **Genre-Specific DJ Crates**: Play across boom-bap hip hop, dance-pop & R&B, trap & dubstep, and pop-punk & indie rock crates, dynamically streaming real-world 30-second audio previews from the iTunes API, pitch-shifted and EQ-filtered to match clue levels.
* **Automatic Offline Fallback**: Seamlessly falls back to local synthesized Tone.js loops if network is unavailable.

## 🛠️ Tech Stack

- **Backend**: Python with [Flask](https://flask.palletsprojects.com/) (using the Application Factory pattern)
- **Database / ORM**: SQLite with [Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/) (Object Relational Mapper)
- **Frontend**: Custom HTML5 & vanilla CSS with HSL-tailored dark themes and custom layout blueprints
- **Quality Assurance**: [Ruff](https://astral.sh/ruff) for lightning-fast linting and formatting, integrated with `pre-commit` hooks

---

## 📁 Project Structure

```text
jonslane/
├── app.py                  # Entrypoint to run the Flask application
├── config.py               # Application configuration classes
├── requirements.txt        # Python dependency manifest
├── pyproject.toml          # Ruff config settings
├── .pre-commit-config.yaml # Git pre-commit hooks config
├── docs/                   # Developer documentation and project tracking
│   ├── architecture.md     # System design and database schema docs
│   └── dev_notes.md        # Feature backlog, project ideas, and research log
└── portfolio/              # Main Flask application package
    ├── __init__.py         # App factory and extension setup
    ├── models.py           # SQLAlchemy database models
    ├── routes/             # Blueprints for modular route handling
    │   ├── __init__.py
    │   └── main.py         # Home and project listing routes
    ├── static/             # Static files (CSS, JS, images)
    │   └── css/
    │       └── main.css    # Premium CSS design system & layout framework
    └── templates/          # HTML templates
        ├── base.html       # Shared layout (headers, footers, imports)
        └── main/
            └── index.html  # Landing page and profile template
```

---

## 🚀 Getting Started

### 1. Prerequisites

Ensure you have Python 3.10+ installed on your machine.

### 2. Setup Virtual Environment & Install Dependencies

```bash
# Create a virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Windows (CMD):
.\venv\Scripts\activate.bat
# On macOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 3. Install Pre-Commit Hooks

We use `pre-commit` to ensure code style consistency. This installs Ruff checks that run automatically on `git commit`.

```bash
pre-commit install
```

### 4. Run the Application

Start the Flask development server:

```bash
python app.py
```

Open your browser and navigate to `http://127.0.0.1:5000`.

---

## 🧹 Quality Control (Linter & Formatter)

Ruff handles both code formatting and linting. You can run it manually:

```bash
# Check for lint errors and apply auto-fixes
ruff check . --fix

# Format files
ruff format .
```
