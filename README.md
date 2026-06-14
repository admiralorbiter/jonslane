# Jon's Portfolio & Research Workspace

Welcome to my personal portfolio and research workspace! This project is built to showcase custom web projects, technical research, and experiments. It is designed to start simple and scale easily over time as new sections, pages, and tools are added.

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
