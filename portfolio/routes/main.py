from flask import Blueprint, redirect, render_template, request, url_for

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    """Render the landing page."""
    return render_template("main/index.html")


@main_bp.route("/music")
def music():
    """Render the djon music section page."""
    return render_template("main/music.html")


@main_bp.route("/auth/callback")
def spotify_callback_alias():
    """Alias for /spotify/callback.

    Spotify's Developer Dashboard and .env may be configured to redirect here
    instead of /spotify/callback. This forwards the OAuth code+state params
    to the real callback handler without requiring Dashboard changes.
    """
    return redirect(url_for("spotify.callback", **request.args))
