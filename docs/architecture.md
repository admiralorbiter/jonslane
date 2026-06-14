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
