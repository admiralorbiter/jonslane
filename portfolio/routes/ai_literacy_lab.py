"""AI Literacy Lab Blueprint — /ai-literacy-lab and shorthand /ai-lab routes."""

from flask import Blueprint, redirect, render_template, url_for

# Main blueprint for the section
ai_literacy_lab_bp = Blueprint(
    "ai_literacy_lab",
    __name__,
    url_prefix="/ai-literacy-lab",
    template_folder="../templates",
)

# Shorthand redirect blueprint (prefixless) to keep logic self-contained
ai_lab_redirect_bp = Blueprint("ai_lab_redirect", __name__)


@ai_literacy_lab_bp.route("/")
def index():
    """Render the AI Literacy Lab landing page."""
    return render_template("ai_literacy_lab/index.html")


@ai_literacy_lab_bp.route("/same-song-louder-dance")
def same_song_essay():
    """Render the flagship essay in a dedicated notepad-style reader."""
    return render_template("ai_literacy_lab/same_song_reader.html")


@ai_lab_redirect_bp.route("/ai-lab")
def redirect_to_lab():
    """Redirect the shorthand /ai-lab URL to the canonical /ai-literacy-lab."""
    return redirect(url_for("ai_literacy_lab.index"))
