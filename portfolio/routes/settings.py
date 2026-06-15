"""Settings Blueprint — /settings prefix.

Provides account settings for authenticated users, including
Spotify connection management and privacy preferences.
"""

from flask import Blueprint, jsonify, redirect, render_template, request, session, url_for

from portfolio import db
from portfolio.models import SpotifyToken, SpotifyListeningAttempt, User

settings_bp = Blueprint("settings", __name__, url_prefix="/settings")


def _require_login():
    """Redirect to login if the user is not authenticated."""
    user_id = session.get("user_id")
    if not user_id:
        return None, redirect(url_for("auth.login", next=request.path))
    user = db.session.get(User, user_id)
    if not user:
        session.pop("user_id", None)
        return None, redirect(url_for("auth.login"))
    return user, None


@settings_bp.route("/")
def index():
    """Render the main settings page."""
    user, err = _require_login()
    if err:
        return err

    # Spotify connection status
    spotify_token = SpotifyToken.query.filter_by(user_id=user.id).first()
    spotify_connected = spotify_token is not None

    # Listening attempt count for stats display
    listening_count = SpotifyListeningAttempt.query.filter_by(user_id=user.id).count()

    # Surface any OAuth feedback from query params
    spotify_error = request.args.get("spotify_error")
    spotify_connected_flash = request.args.get("spotify_connected")
    spotify_disconnected_flash = request.args.get("spotify_disconnected")

    return render_template(
        "settings/settings.html",
        user=user,
        spotify_connected=spotify_connected,
        spotify_token=spotify_token,
        listening_count=listening_count,
        spotify_error=spotify_error,
        spotify_connected_flash=spotify_connected_flash,
        spotify_disconnected_flash=spotify_disconnected_flash,
    )
