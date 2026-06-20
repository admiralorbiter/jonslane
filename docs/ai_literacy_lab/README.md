# AI Literacy Lab

A Windows XP / old-school computer lab inspired resource hub about AI literacy,
judgment, writing, education, source grounding, and using AI without outsourcing
your brain.

## Concept

- **Aesthetic**: Nostalgic Windows XP desktop — sky blue chrome, classic Tahoma
  typography, manila folder cards, sticky note, taskbar, live clock, and start menu.
- **Tone**: Curious, playful, technically literate, and educator-minded.
- **Core Principle**: Human judgment stays in the loop.
- **Status**: Growing resource — content is intentionally rough and unverified
  at this stage. Folders go live on the desktop only when they have real content.

## Routes

| URL | Description |
|---|---|
| `/ai-literacy-lab/` | Desktop homepage |
| `/ai-literacy-lab/<folder>` | Full section page (e.g. `tools`, `research`) |
| `/ai-literacy-lab/<folder>/<sub>` | Sub-page — only exists when content warrants its own URL |
| `/ai-literacy-lab/same-song-louder-dance` | Flagship essay (served by catch-all) |
| `/ai-lab` | Shorthand redirect to `/ai-literacy-lab/` |

All sub-page routing is handled by a **single catch-all route** in
`portfolio/routes/ai_literacy_lab.py`. URL path segments map to template
file paths under `templates/ai_literacy_lab/pages/`. Dashes in URL segments
are converted to underscores in template filenames (e.g. `same-song-louder-dance`
→ `same_song_louder_dance.html`).

## Key Files

```
portfolio/routes/ai_literacy_lab.py         — Blueprint, LAB_METADATA, all routes
portfolio/static/css/ai_literacy_lab.css    — All styles (desktop + notepad wrapper)
portfolio/templates/ai_literacy_lab/
  index.html                                — Desktop homepage
  page_wrapper.html                         — Notepad chrome for all sub-pages
  essays/same_song.html                     — Flagship essay content partial
  pages/
    tools.html                              — Tools & Workflows (active, full content)
    research.html                           — Research & Source Grounding (draft)
    risks.html                              — Risks & Elephants (draft)
    education.html                          — Education & AI (draft)
    writing.html                            — Writing & Feedback (draft)
    sources.html                            — Source Bank (draft)
    experience.html                         — Experience Bank (draft)
    backlog.html                            — Lab Backlog (draft)
    same_song_louder_dance.html             — Flagship essay (extends page_wrapper)
```

## Content Scaling Model

Content lives at the level appropriate to its size:

| Content size | Where it lives |
|---|---|
| Short note (< ~500 words) | Inline H3 section in the parent section page |
| Full article (700–2,000 words) | Sub-page with its own URL |
| Major multi-article topic | New top-level desktop folder |
| Flagship essay | Dedicated page extending `page_wrapper.html` |

**Horizontal scaling** (new folders): add an entry to `LAB_METADATA` with
`status: "active"` and create the corresponding `.html` file in `pages/`.
The desktop grid renders dynamically — no template changes required.

**Vertical scaling** (deeper content): add H3 sections inline in the section
page until a section genuinely outgrows it, then extract to a sub-page.

## LAB_METADATA

Defined in `portfolio/routes/ai_literacy_lab.py`. Each folder entry contains:

```python
{
    "title": str,        # Display name
    "icon": str,         # Emoji icon for the folder card
    "description": str,  # One-line card description
    "summary": str,      # Paragraph shown in the preview popup
    "status": str,       # "active" (live on desktop) or "draft" (greyed/locked)
}
```

The metadata is embedded directly into `index.html` as an inline JavaScript
object (`const LAB_METADATA = {{ folders | tojson }};`). There is no AJAX
endpoint for folder metadata — it is all available synchronously on page load.

## View Modes

- **Notebook Mode** (default): Classic XP desktop with interactive windows,
  minimise/close controls, taskbar tabs, sticky note, and folder grid.
- **Reader Mode**: Linearised view with left TOC sidebar. All windows are
  restored and the sticky note/shortcuts are hidden. TOC links anchor to
  the actual folder card element IDs (`#folder-tools`, `#folder-research`, etc.).

## Draft Folder Gating

Folders with `status: "draft"` render as non-interactive `<div>` elements
with a 🔒 icon suffix, reduced opacity, and `pointer-events: none`. They
are visible but not clickable, signalling content is coming without creating
dead-end user journeys.

## Features

- **Dual-View Toggle**: Notebook Mode (desktop) / Reader Mode (linearised).
- **Preview Popup**: Click a folder card to see its summary + "Open full page →"
  button. No AJAX — reads from embedded metadata.
- **Start Menu ("Lab Menu")**: Retro popup panel for site-wide navigation.
- **Interactive Windows**: Minimise/close collapse a window to the taskbar;
  "Restart Desktop" restores all windows.
- **Live Clock**: Taskbar tray clock updating every minute with local time.
- **Security**: Catch-all route uses an allowlist regex
  (`[a-zA-Z0-9_-]` per segment) — blocks directory traversal and enforces
  the URL slug naming contract.
