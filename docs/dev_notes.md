# Developer Notes & Feature Log

This log is used to brainstorm new features, track project updates, and maintain a running list of portfolio/research ideas.

---

## 🚀 Upcoming Ideas & Projects

### 1. Research Project Showcase
- **Goal**: Showcase notebooks, write-ups, or scripts in an interactive, clean interface.
- **Database Schema**: A `ResearchPaper` or `Project` model with fields for title, abstract, date, tags, and markdown content.
- **Features**: Filterable lists, tags, and a markdown renderer inside Flask templates.

### 2. Live Tech Sandbox
- **Goal**: Build small interactive frontend widgets or mini-webtools (e.g., custom format converters, canvas drawings, or API scrapers).
- **Styling**: Specific, self-contained layout designs using the section CSS override pattern.

---

## 📝 Ongoing Refinements
- **SQLAlchemy Migrations**: When database schema changes are needed, integrate `Flask-Migrate` (Alembic wrapper) to manage changes.
- **Ruff Integrations**: Monitor the performance of the pre-commit hook during standard development workflow and add specific ignores if necessary.
- **Frontend Optimization**: Look into bundling static assets or minification if stylesheets scale significantly.
