"""Spotify Blueprint — /spotify prefix.

Routes:
  GET  /spotify/connect          → start OAuth flow
  GET  /spotify/callback         → handle OAuth callback, store tokens
  GET  /spotify/disconnect       → remove stored token
  GET  /spotify/api/now-playing  → JSON: current track + BPM annotation
  POST /spotify/api/guess        → submit a listening attempt
  GET  /spotify/api/recent       → JSON: recently played tracks
"""

from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, redirect, request, session, url_for
from flask import current_app as app

from portfolio import db
from portfolio.models import SpotifyListeningAttempt, SpotifyToken

from .bpm_resolver import (
    compute_grade,
    create_machine_estimate,
    get_or_create_track_identity,
    resolve_bpm_for_track,
)
from .client import get_currently_playing, get_recently_played, parse_track_identity
from .oauth import build_auth_url, exchange_code, generate_state, refresh_access_token

spotify_bp = Blueprint("spotify", __name__, url_prefix="/spotify")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _require_login():
    """Return (user_id, None) or (None, redirect_response)."""
    user_id = session.get("user_id")
    if not user_id:
        if request.path.startswith("/spotify/api/"):
            return None, (jsonify({"error": "Authentication required"}), 401)
        return None, redirect(url_for("auth.login", next=request.path))
    return user_id, None


def _get_valid_token(user_id: int) -> str | None:
    """Return a valid access token for the user, refreshing if needed.

    Returns None if the user has no Spotify token or refresh fails.
    """
    token_rec = SpotifyToken.query.filter_by(user_id=user_id).first()
    if not token_rec:
        return None

    now = datetime.now(timezone.utc)

    # Make expires_at offset-aware if stored as naive datetime
    expires = token_rec.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    # Refresh if within 60 seconds of expiry
    if now >= expires - timedelta(seconds=60):
        refreshed = refresh_access_token(token_rec.refresh_token)
        if not refreshed:
            # Refresh failed — token is dead, user must re-auth
            db.session.delete(token_rec)
            db.session.commit()
            return None

        token_rec.access_token = refreshed["access_token"]
        token_rec.expires_at = now + timedelta(seconds=refreshed.get("expires_in", 3600))
        # Spotify may return a new refresh token
        if "refresh_token" in refreshed:
            token_rec.refresh_token = refreshed["refresh_token"]
        db.session.commit()

    return token_rec.access_token


def _bpm_annotation_payload(annotation) -> dict | None:
    """Serialize a TrackTempoAnnotation for the API response."""
    if annotation is None:
        return None
    return {
        "canonical_bpm": annotation.canonical_bpm,
        "alternate_bpms": annotation.alternate_bpms or [],
        "confidence": annotation.confidence,
        "source": annotation.source,
        "time_signature": annotation.time_signature,
    }


# ---------------------------------------------------------------------------
# OAuth Routes
# ---------------------------------------------------------------------------


@spotify_bp.route("/connect")
def connect():
    """Redirect user to Spotify OAuth consent screen."""
    user_id, err = _require_login()
    if err:
        return err

    if not app.config.get("SPOTIFY_CLIENT_ID"):
        return (
            jsonify(
                {
                    "error": "Spotify integration not configured. "
                    "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET."
                }
            ),
            503,
        )

    state = generate_state()
    session["spotify_oauth_state"] = state
    return redirect(build_auth_url(state))


@spotify_bp.route("/callback")
def callback():
    """Handle Spotify OAuth callback — exchange code for tokens."""
    user_id, err = _require_login()
    if err:
        return err

    # Validate CSRF state
    returned_state = request.args.get("state", "")
    expected_state = session.pop("spotify_oauth_state", "")
    if not returned_state or returned_state != expected_state:
        return redirect(url_for("settings.index") + "?spotify_error=state_mismatch")

    error = request.args.get("error")
    if error:
        return redirect(url_for("settings.index") + f"?spotify_error={error}")

    code = request.args.get("code", "")
    if not code:
        return redirect(url_for("settings.index") + "?spotify_error=no_code")

    tokens = exchange_code(code, app.config["SPOTIFY_REDIRECT_URI"])
    if not tokens:
        return redirect(url_for("settings.index") + "?spotify_error=token_exchange_failed")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=tokens.get("expires_in", 3600))

    # Upsert SpotifyToken for this user
    token_rec = SpotifyToken.query.filter_by(user_id=user_id).first()
    if token_rec:
        token_rec.access_token = tokens["access_token"]
        token_rec.refresh_token = tokens["refresh_token"]
        token_rec.expires_at = expires_at
        token_rec.scope = tokens.get("scope", "")
        token_rec.connected_at = now
    else:
        token_rec = SpotifyToken(
            user_id=user_id,
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            expires_at=expires_at,
            scope=tokens.get("scope", ""),
        )
        db.session.add(token_rec)

    db.session.commit()
    return redirect(url_for("settings.index") + "?spotify_connected=1")


@spotify_bp.route("/disconnect")
def disconnect():
    """Remove stored Spotify token for the current user."""
    user_id, err = _require_login()
    if err:
        return err

    token_rec = SpotifyToken.query.filter_by(user_id=user_id).first()
    if token_rec:
        from portfolio.models import PlaylistImport
        # Deactivate user's playlist imports on Spotify disconnect
        PlaylistImport.query.filter_by(user_id=user_id).update({PlaylistImport.is_active: False})
        db.session.delete(token_rec)
        db.session.commit()

    return redirect(url_for("settings.index") + "?spotify_disconnected=1")



# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------


@spotify_bp.route("/api/now-playing")
def api_now_playing():
    """Return current Spotify playback state + BPM annotation.

    Response shape:
      {
        "is_playing": bool,
        "track": {
          "spotify_track_id": str,
          "title": str,
          "artist": str,
          "album": str,
          "album_art_url": str,
          "duration_ms": int,
          "progress_ms": int,
        },
        "bpm_annotation": { ... } | null,
        "spotify_connected": bool
      }

    Returns 204 if nothing is playing.
    """
    user_id, err = _require_login()
    if err:
        return err

    access_token = _get_valid_token(user_id)
    if not access_token:
        return jsonify({"spotify_connected": False}), 200

    data = get_currently_playing(access_token)

    if data is None:
        # 204 — nothing playing or no active device
        return jsonify({"spotify_connected": True, "is_playing": False, "track": None}), 200

    if data.get("_error") == "token_expired":
        return jsonify({"spotify_connected": False, "error": "token_expired"}), 200

    item = data.get("item")
    if not item or data.get("currently_playing_type") != "track":
        return jsonify({"spotify_connected": True, "is_playing": False, "track": None}), 200

    track_data = parse_track_identity(item)
    identity = get_or_create_track_identity(track_data)
    annotation = resolve_bpm_for_track(identity)

    progress_ms = data.get("progress_ms", 0)
    is_playing = data.get("is_playing", False)

    # Fetch last guess for this track by this user
    last_attempt = SpotifyListeningAttempt.query.filter_by(
        user_id=user_id,
        track_id=identity.id
    ).order_by(SpotifyListeningAttempt.created_at.desc()).first()

    last_guess = None
    if last_attempt:
        grade = None
        if last_attempt.was_gradable and annotation and annotation.confidence != "unknown":
            primary_bpm = last_attempt.guessed_bpm if last_attempt.guessed_bpm is not None else last_attempt.tap_estimated_bpm
            grade = compute_grade(primary_bpm, annotation, last_attempt.metrical_multiplier)
        
        last_guess = {
            "guessed_bpm": last_attempt.guessed_bpm,
            "was_gradable": last_attempt.was_gradable,
            "grade": grade,
            "metrical_multiplier": last_attempt.metrical_multiplier,
            "confidence": last_attempt.confidence,
            "user_note": last_attempt.user_note,
        }

    return jsonify(
        {
            "spotify_connected": True,
            "is_playing": is_playing,
            "track": {
                **track_data,
                "progress_ms": progress_ms,
                "track_identity_id": identity.id,
            },
            "bpm_annotation": _bpm_annotation_payload(annotation),
            "last_guess": last_guess,
            # When BPM is unknown, give the client a search hint so it can
            # trigger the iTunes + Web Audio beat detector.
            "itunes_query": (
                f"{track_data['artist']} {track_data['title']}"
                if annotation is None else None
            ),
        }
    )


@spotify_bp.route("/api/guess", methods=["POST"])
def api_guess():
    """Submit a BPM guess for the currently playing track.

    Expected JSON body:
      {
        "track_identity_id": int,
        "guessed_bpm": float | null,
        "tap_estimated_bpm": float | null,
        "tap_stability_ms": float | null,
        "input_method": "numeric" | "tap" | "both",
        "confidence": "guess" | "pretty_sure" | "locked_in",
        "metrical_multiplier": 0.5 | 1.0 | 2.0,
        "half_double_flag": "half" | "normal" | "double",
        "user_note": str | null,
        "playback_progress_ms": int | null,
        "listening_context": str | null
      }

    Response shape:
      {
        "success": true,
        "attempt_id": int,
        "was_gradable": bool,
        "grade": { percent_error, rating, feedback_label, effective_bpm } | null,
        "bpm_annotation": { ... } | null
      }
    """
    user_id, err = _require_login()
    if err:
        return err

    body = request.get_json(silent=True) or {}

    track_identity_id = body.get("track_identity_id")
    guessed_bpm = body.get("guessed_bpm")
    tap_estimated_bpm = body.get("tap_estimated_bpm")
    tap_stability_ms = body.get("tap_stability_ms")
    input_method = body.get("input_method", "numeric")
    confidence = body.get("confidence", "guess")
    metrical_multiplier = float(body.get("metrical_multiplier", 1.0))
    half_double_flag = body.get("half_double_flag", "normal")
    user_note = body.get("user_note", "")[:200] if body.get("user_note") else None
    playback_progress_ms = body.get("playback_progress_ms")
    listening_context = body.get("listening_context", "unknown")

    # Determine the primary BPM value to grade
    primary_bpm = guessed_bpm if guessed_bpm is not None else tap_estimated_bpm
    if primary_bpm is None:
        return jsonify({"error": "guessed_bpm or tap_estimated_bpm is required"}), 400

    # Fetch track identity for annotation lookup
    from portfolio.models import TrackIdentity

    identity = db.session.get(TrackIdentity, track_identity_id) if track_identity_id else None
    annotation = resolve_bpm_for_track(identity) if identity else None

    # Grading
    grade = None
    was_gradable = False
    if annotation and annotation.confidence != "unknown":
        was_gradable = True
        grade = compute_grade(primary_bpm, annotation, metrical_multiplier)

    attempt = SpotifyListeningAttempt(
        user_id=user_id,
        track_id=identity.id if identity else None,
        tempo_annotation_id=annotation.id if annotation else None,
        guessed_bpm=guessed_bpm,
        tap_estimated_bpm=tap_estimated_bpm,
        tap_stability_ms=tap_stability_ms,
        input_method=input_method,
        confidence=confidence,
        metrical_multiplier=metrical_multiplier,
        half_double_flag=half_double_flag,
        user_note=user_note,
        was_gradable=was_gradable,
        percent_error=grade["percent_error"] if grade else None,
        is_anchor_adjacent=grade["is_anchor_adjacent"] if grade else False,
        anchor_bpm_near=grade["anchor_bpm_near"] if grade else None,
        playback_progress_ms=playback_progress_ms,
        listening_context=listening_context,
    )
    db.session.add(attempt)
    db.session.commit()

    return jsonify(
        {
            "success": True,
            "attempt_id": attempt.id,
            "was_gradable": was_gradable,
            "grade": grade,
            "bpm_annotation": _bpm_annotation_payload(annotation),
        }
    )


@spotify_bp.route("/api/recent")
def api_recent():
    """Return the user's 10 most recently played Spotify tracks."""
    user_id, err = _require_login()
    if err:
        return err

    access_token = _get_valid_token(user_id)
    if not access_token:
        return jsonify({"spotify_connected": False}), 200

    data = get_recently_played(access_token, limit=10)
    if not data:
        return jsonify({"spotify_connected": True, "tracks": []}), 200

    tracks = []
    for item in data.get("items", []):
        track_obj = item.get("track")
        if track_obj:
            tracks.append(parse_track_identity(track_obj))

    return jsonify({"spotify_connected": True, "tracks": tracks})


@spotify_bp.route("/api/submit-bpm", methods=["POST"])
def api_submit_bpm():
    """Accept a client-side Web Audio beat detection result.

    Called by bpm_detector.js after it analyzes an iTunes preview clip.
    Stores the estimate as a TrackTempoAnnotation with machine_low or
    machine_high confidence depending on the autocorrelation peak score.

    Expected JSON body:
      {
        "track_identity_id": int,
        "estimated_bpm": float,
        "confidence_score": float,   // 0.0–1.0 autocorrelation peak ratio
        "itunes_track_id": str | null,
        "itunes_preview_url": str | null
      }

    Response:
      {
        "success": bool,
        "annotation": { canonical_bpm, confidence, source, alternate_bpms }
      }
    """
    user_id, err = _require_login()
    if err:
        return err

    body = request.get_json(silent=True) or {}

    track_identity_id = body.get("track_identity_id")
    estimated_bpm = body.get("estimated_bpm")
    confidence_score = body.get("confidence_score", 0.0)

    if not track_identity_id or not estimated_bpm:
        return jsonify({"error": "track_identity_id and estimated_bpm are required"}), 400

    try:
        estimated_bpm = float(estimated_bpm)
        confidence_score = float(confidence_score)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid numeric values"}), 400

    # Sanity check: reject obviously wrong BPM values
    if not (40.0 <= estimated_bpm <= 300.0):
        return jsonify({"error": f"BPM {estimated_bpm} out of range 40–300"}), 400

    confidence_score = max(0.0, min(1.0, confidence_score))

    from portfolio.models import TrackIdentity

    identity = db.session.get(TrackIdentity, track_identity_id)
    if not identity:
        return jsonify({"error": "Track not found"}), 404

    annotation = create_machine_estimate(
        track_identity=identity,
        estimated_bpm=estimated_bpm,
        confidence_score=confidence_score,
        itunes_track_id=body.get("itunes_track_id"),
        itunes_preview_url=body.get("itunes_preview_url"),
    )

    return jsonify(
        {
            "success": True,
            "annotation": {
                "canonical_bpm": annotation.canonical_bpm,
                "confidence": annotation.confidence,
                "source": annotation.source,
                "alternate_bpms": annotation.alternate_bpms or [],
            },
        }
    )
