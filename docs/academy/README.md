# Academy | System Overview

This directory contains documentation for the **Academy** (Version 4.0), a structured, research-grounded learning curriculum integrated into the portfolio site.

## Architecture & Layers

The Academy acts as a private, personalized meta-layer (**Layer 3**) for the user's progress and achievements across various modules. It interacts with public components by consuming data from shared tables while maintaining strict auth-gating and system boundaries.

```
+-------------------------------------------------------------+
|               Academy Hub Dashboard (/academy)             |
|                                                             |
|  +---------------------+  +------------------------------+  |
|  |   Curriculum Map    |  |  Spaced Repetition Queue     |  |
|  |   (Levels 0 to 7)   |  |  (Overdue Anchor Reviews)    |  |
|  +----------+----------+  +--------------+---------------+  |
|             |                            |                  |
|  +----------v----------+  +--------------v---------------+  |
|  |     Skill Graph     |  |    Personal BPM Memory Map   |  |
|  |   (SVG Radar Chart) |  |   (Song Tags & ARI Scores)   |  |
|  +---------------------+  +------------------------------+  |
+-------------------------------------------------------------+
                               |
                               | (Consumes synced history)
                               v
+-------------------------------------------------------------+
|                 Shared Technical Core (Layer 2)             |
|                                                             |
|  * User (streak fields)      * Attempt (performance rows)   |
|  * AnchorSchedule (SRS DB)   * utils/srs.py (SM-2 engine)    |
+-------------------------------------------------------------+
```

## Core Features

1. **Curriculum Map & Progression (Levels 0–7):** Progressive levels tracing skills from basic pulse synchronization to advanced phrasing and DJ beatmatching. (See [curriculum.md](file:///c:/Users/admir/Github/jonslane/docs/academy/curriculum.md) for details).
2. **Spaced Repetition System (SRS):** An adaptation of the SuperMemo SM-2 algorithm to prompt review of target "anchor" tempos (95, 120, 128, 140 BPM) at expanding intervals.
3. **Interactive Skill Profile:** A custom SVG radar chart visualizing five dimensions of rhythmic capability (Pulse, Anchor Memory, Subdivision, Downbeat, Ambiguity).
4. **Welcome/Onboarding Flow:** Retroactive ingestion of anonymous guest attempts into the user account upon first authentication, seeding a starting skill profile and review schedules.

## Directory & File Mapping

- **Routes & Logic:**
  - [academy.py](file:///c:/Users/admir/Github/jonslane/portfolio/routes/academy.py) - Enforces blueprint-wide authentication and serves the dashboard, welcome, and skill profile routes.
  - [srs.py](file:///c:/Users/admir/Github/jonslane/portfolio/utils/srs.py) - Contains SM-2 scheduling updates, rating mappings, and guest history initialization.
  - [academy_stats.py](file:///c:/Users/admir/Github/jonslane/portfolio/utils/academy_stats.py) - Aggregates user attempts to compute the 5-dimension skill graph and progress levels.

- **Views & Templates:**
  - [academy.html](file:///c:/Users/admir/Github/jonslane/portfolio/templates/academy/academy.html) - Main Academy hub displaying the curriculum timeline, SVG radar chart, SRS queue, sandbox crates, and Piano Lab launchers.
  - [welcome.html](file:///c:/Users/admir/Github/jonslane/portfolio/templates/academy/welcome.html) - First-login onboarding layout.

- **Styles & Scripts:**
  - Styles are injected natively into templates using Jinja blocks or derived from core classes in [game.css](file:///c:/Users/admir/Github/jonslane/portfolio/static/css/game.css).

## Technical Implementation Details

### Database Schema

- **`AnchorSchedule` Table:**
  - Tracks specific SM-2 learning state parameters: `ease_factor` (starts at 2.5), `interval_days` (spacing window), `repetitions` (number of successive passes), `next_review_at` (due timestamp), and `metrical_match_streak`.
  - Enforces a unique index on `(user_id, anchor_bpm)` to ensure one schedule per target frequency.

- **On-Demand Computations:**
  - The `UserSkillProfile` is not saved in a DB table; instead, it is computed dynamically by the backend in `get_user_academy_stats` by checking the last 50 attempts in the `Attempt` table to prevent stale caching issues.

### Auth Rules

- **Invisible to Guests:** The Academy is completely hidden for non-logged-in users. The route handler `@academy_bp.before_request` intercepts all matching calls and redirects to `/auth/login` (or returns a 401 JSON code for API requests) so guests cannot trace route locations.
