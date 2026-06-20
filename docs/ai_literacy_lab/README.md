# AI Literacy Lab

A Windows XP / old-school computer lab inspired resource hub about AI literacy, judgment, writing, education, source grounding, and using AI without outsourcing your brain.

## Concept Overview
- **Aesthetic**: Nostalgic 2001 Windows XP desktop, rounded sky blue window chrome, classic Tahoma and MS Sans Serif system typography, pale gray/beige panels, and flat folder cards.
- **Tone**: Curious, playful, technically literate, and educator-minded.
- **Core Principle**: Human judgment stays in the loop.

## Structure and Files
- **Route**: `/ai-literacy-lab` (with redirect from `/ai-lab`)
- **Blueprint**: `portfolio/routes/ai_literacy_lab.py`
- **Main CSS**: `portfolio/static/css/ai_literacy_lab.css`
- **Jinja2 Template**: `portfolio/templates/ai_literacy_lab/index.html`
- **Essays Sub-Templates**: `portfolio/templates/ai_literacy_lab/essays/`

## Features Implemented
- **Dual-View Toggle**:
  - **Notebook Mode**: Classic desktop with folder grid, sticky note, status panel, and taskbar.
  - **Reader Mode**: Styled after Windows XP Help & Support Center; left navigation panel with content table, right large text-reading panel.
- **Start Menu ("Lab Menu")**: Retro popup panel acting as a navigation hub back to the main site.
- **Interactive Windows**: Minimizing or closing a window collapses it to the taskbar or hides it, with options to restore via the Lab Menu.
- **Live clock**: Tray clock updating with user local time.
- **Focus Indicators**: Dotted outline on focused interactive controls for accessibility compliance.
