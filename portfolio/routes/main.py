from flask import Blueprint, render_template

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    """Render the landing page."""
    return render_template("main/index.html")


@main_bp.route("/music")
def music():
    """Render the djon music section page."""
    return render_template("main/music.html")

