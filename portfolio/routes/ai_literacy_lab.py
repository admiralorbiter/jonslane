"""AI Literacy Lab Blueprint — /ai-literacy-lab and shorthand /ai-lab routes."""

import re

from flask import Blueprint, abort, current_app, redirect, render_template, url_for
from jinja2 import TemplateNotFound

# Main blueprint for the section
ai_literacy_lab_bp = Blueprint(
    "ai_literacy_lab",
    __name__,
    url_prefix="/ai-literacy-lab",
    template_folder="../templates",
)

# Shorthand redirect blueprint (prefixless) to keep logic self-contained
ai_lab_redirect_bp = Blueprint("ai_lab_redirect", __name__)

# Centralized metadata for the lab folders.
# status: "active" = folder has real content and is shown on desktop.
#         "draft"  = placeholder, shown as locked/greyed on desktop.
LAB_METADATA = {
    "tools": {
        "title": "Tools & Workflows",
        "icon": "📁",
        "description": "How I use chatbots, coding agents, research tools, and presentation tools without letting the tool become the thinker.",
        "summary": "Careless use of AI tools is like handling a loaded gun — you risk major fallout beyond your own foot. Relying on lazy, thoughtless habits or acting like a passive conduit for robot outputs degrades your critical judgment. In this lab, we focus on cautious, active tool use: treating AI as a brainstorming partner or code editor, while remaining the primary author and decision-maker.",
        "status": "active",
    },
    "research": {
        "title": "Research & Source Grounding",
        "icon": "📁",
        "description": "Deep research, source-grounded AI, verification habits, and the difference between using AI to understand a source vs. instead of reading it.",
        "summary": "AI research tools are powerful when interrogating sources and synthesizing across documents, but dangerous when replacing domain judgment. Verification is paramount.",
        "status": "draft",
    },
    "risks": {
        "title": "Risks & Elephants",
        "icon": "📁",
        "description": "Hallucinations, bias, sycophancy, AI slop, ed-tech wrappers, IP, labor, data centers, and the hidden costs of scale.",
        "summary": "Understanding key systemic, environmental, and behavioral risks of outsourcing cognition to large language models. The hidden cost of wrappers and scale.",
        "status": "draft",
    },
    "education": {
        "title": "Education & AI",
        "icon": "📁",
        "description": "Process, motivation, detection, assignment design, and helping students learn with tools instead of outsourcing thought.",
        "summary": "AI has collapsed the friction of cutting corners. We must move beyond fragile detection schemes toward task motivation and teaching students to learn with tools.",
        "status": "draft",
    },
    "writing": {
        "title": "Writing & Feedback",
        "icon": "📁",
        "description": "Writing as thinking, AI feedback, voice, taste, slop, brainstorming, and why preserving the human part still matters.",
        "summary": "AI feedback on writing is useful, but writing is a cognitive strategy that promotes processing. Preserving your voice and taste is essential.",
        "status": "draft",
    },
    "sources": {
        "title": "Source Bank",
        "icon": "📁",
        "description": "Books, papers, articles, quotes, citation placeholders, and claims that need to be verified before publication.",
        "summary": "A tracked collection of papers, digital literacy frameworks, and academic studies referenced during the development of this lab.",
        "status": "draft",
    },
    "experience": {
        "title": "Experience Bank",
        "icon": "📁",
        "description": "Stories from coding, teaching, early AI experiments, student conversations, and learning the hard way.",
        "summary": "Personal stories from undergrad neural nets to classroom Turing tests that ground these AI literacy guidelines in reality.",
        "status": "draft",
    },
    "backlog": {
        "title": "Lab Backlog",
        "icon": "📁",
        "description": "Future pages, research gaps, citation cleanup, tool reviews, and ideas that are not ready yet but should not be lost.",
        "summary": "A workspace checklist and pipeline of future articles, reviews, and citation verification steps.",
        "status": "draft",
    },
}

# Allowlist for valid URL path segments — prevents traversal and enforces slug contract.
# URL segments may only contain letters, digits, hyphens, and underscores.
_SLUG_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


@ai_literacy_lab_bp.route("/")
def index():
    """Render the AI Literacy Lab landing page."""
    return render_template("ai_literacy_lab/index.html", folders=LAB_METADATA)


@ai_literacy_lab_bp.route("/<path:page_path>")
def render_page(page_path):
    """Dynamically route to template files based on URL path.

    URL slug convention: dashes in URL segments map to underscores in template
    filenames (e.g. 'editor-vs-coder' → 'editor_vs_coder.html').
    Only alphanumeric characters, hyphens, and underscores are permitted per
    segment — any other characters result in a 404.
    """
    clean_path = page_path.strip("/")
    parts = clean_path.split("/")

    # Security: allowlist-based guard — blocks traversal and enforces slug contract.
    if any(not _SLUG_RE.match(p) for p in parts):
        abort(404)

    # Convert dashes to underscores for template filename convention.
    safe_parts = [p.replace("-", "_") for p in parts]
    resolved_path = "/".join(safe_parts)

    template_path = f"ai_literacy_lab/pages/{resolved_path}.html"
    index_template_path = f"ai_literacy_lab/pages/{resolved_path}/index.html"

    # Try rendering the direct file, then fallback to directory index.html
    try:
        current_app.jinja_env.get_template(template_path)
        selected_template = template_path
    except TemplateNotFound:
        try:
            current_app.jinja_env.get_template(index_template_path)
            selected_template = index_template_path
        except TemplateNotFound:
            abort(404)

    return render_template(selected_template)


@ai_lab_redirect_bp.route("/ai-lab")
def redirect_to_lab():
    """Redirect the shorthand /ai-lab URL to the canonical /ai-literacy-lab."""
    return redirect(url_for("ai_literacy_lab.index"))
