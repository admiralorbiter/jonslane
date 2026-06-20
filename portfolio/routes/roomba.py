"""DJ Roomba Blueprint — /music/roomba prefix."""

import re
import threading
from datetime import datetime, timedelta, timezone

from flask import (
    Blueprint,
    current_app,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from sqlalchemy.orm import joinedload

from portfolio import db, limiter
from portfolio.models import (
    PlaylistImport,
    PlaylistTrack,
    SpotifyToken,
    TrackFeatureAnnotation,
    TrackIdentity,
    TrackTempoAnnotation,
    TransitionCandidate,
)
from portfolio.routes.roomba_scoring import bucket_candidates, score_transition
from portfolio.spotify_bridge.bpm_resolver import analyze_track_in_background
from portfolio.spotify_bridge.client import (
    get_playlist_tracks_all,
    get_user_playlists,
    validate_spotify_id,
)
from portfolio.spotify_bridge.routes import _get_valid_token

roomba_bp = Blueprint("roomba", __name__, url_prefix="/music/roomba")


# ---------------------------------------------------------------------------
# Auth Guard and helpers
# ---------------------------------------------------------------------------


@roomba_bp.before_request
def require_spotify_with_playlist_scope():
    user_id = session.get("user_id")
    if not user_id:
        if request.path.startswith("/music/api/roomba/"):
            return jsonify({"error": "Authentication required"}), 401
        return redirect(url_for("auth.login", next=request.path))

    # We only enforce strict checks for API calls.
    # The landing page will load even if not connected so we can show a connect button.
    if request.path.startswith("/music/api/roomba/"):
        token_rec = SpotifyToken.query.filter_by(user_id=user_id).first()
        if not token_rec:
            return jsonify({"error": "spotify_required", "reconnect": True}), 403

        required = {"playlist-read-private", "playlist-read-collaborative"}
        granted = set((token_rec.scope or "").split())
        if not required.issubset(granted):
            return jsonify(
                {
                    "error": "reconnect_spotify_required",
                    "reason": "Missing playlist-read-private scope",
                }
            ), 403


def get_resolved_features(track_id: int) -> dict:
    """Helper to merge TrackTempoAnnotation and TrackFeatureAnnotation for scoring."""
    tempo = TrackTempoAnnotation.query.filter_by(track_id=track_id).first()
    manual_feat = TrackFeatureAnnotation.query.filter_by(track_id=track_id, source="manual").first()
    librosa_feat = TrackFeatureAnnotation.query.filter_by(
        track_id=track_id, source="librosa"
    ).first()

    resolved_bpm = tempo.canonical_bpm if tempo else None
    bpm_confidence = tempo.confidence if tempo else "unknown"

    resolved_key = None
    key_confidence = 0.0

    if manual_feat and manual_feat.camelot_key:
        resolved_key = manual_feat.camelot_key
        key_confidence = 1.0
    elif tempo and tempo.camelot_key:
        resolved_key = tempo.camelot_key
        key_confidence = tempo.key_confidence or 0.5
    elif librosa_feat and librosa_feat.camelot_key:
        resolved_key = librosa_feat.camelot_key
        key_confidence = librosa_feat.confidence or 0.5

    resolved_energy = None
    energy_tag = None

    if manual_feat and (manual_feat.energy_tag or manual_feat.energy_score is not None):
        energy_tag = manual_feat.energy_tag
        if manual_feat.energy_score is not None:
            resolved_energy = manual_feat.energy_score * 100.0
        elif manual_feat.energy_tag:
            mapping = {"low": 20.0, "medium": 45.0, "high": 70.0, "very_high": 90.0}
            resolved_energy = mapping.get(manual_feat.energy_tag)
    elif librosa_feat and (librosa_feat.energy_tag or librosa_feat.energy_score is not None):
        energy_tag = librosa_feat.energy_tag
        if librosa_feat.energy_score is not None:
            resolved_energy = librosa_feat.energy_score * 100.0

    if resolved_energy is None:
        resolved_energy = 45.0
        energy_tag = "medium"

    return {
        "bpm": resolved_bpm,
        "bpm_confidence": bpm_confidence,
        "camelot_key": resolved_key,
        "key_confidence": key_confidence,
        "energy": resolved_energy,
        "energy_tag": energy_tag,
    }


def get_resolved_features_cached(
    track_id: int, tempos: dict, manual_feats: dict, librosa_feats: dict
) -> dict:
    """Helper to merge TrackTempoAnnotation and TrackFeatureAnnotation using pre-fetched caches."""
    tempo = tempos.get(track_id)
    manual_feat = manual_feats.get(track_id)
    librosa_feat = librosa_feats.get(track_id)

    resolved_bpm = tempo.canonical_bpm if tempo else None
    bpm_confidence = tempo.confidence if tempo else "unknown"

    resolved_key = None
    key_confidence = 0.0

    if manual_feat and manual_feat.camelot_key:
        resolved_key = manual_feat.camelot_key
        key_confidence = 1.0
    elif tempo and tempo.camelot_key:
        resolved_key = tempo.camelot_key
        key_confidence = tempo.key_confidence or 0.5
    elif librosa_feat and librosa_feat.camelot_key:
        resolved_key = librosa_feat.camelot_key
        key_confidence = librosa_feat.confidence or 0.5

    resolved_energy = None
    energy_tag = None

    if manual_feat and (manual_feat.energy_tag or manual_feat.energy_score is not None):
        energy_tag = manual_feat.energy_tag
        if manual_feat.energy_score is not None:
            resolved_energy = manual_feat.energy_score * 100.0
        elif manual_feat.energy_tag:
            mapping = {"low": 20.0, "medium": 45.0, "high": 70.0, "very_high": 90.0}
            resolved_energy = mapping.get(manual_feat.energy_tag)
    elif librosa_feat and (librosa_feat.energy_tag or librosa_feat.energy_score is not None):
        energy_tag = librosa_feat.energy_tag
        if librosa_feat.energy_score is not None:
            resolved_energy = librosa_feat.energy_score * 100.0

    if resolved_energy is None:
        resolved_energy = 45.0
        energy_tag = "medium"

    return {
        "bpm": resolved_bpm,
        "bpm_confidence": bpm_confidence,
        "camelot_key": resolved_key,
        "key_confidence": key_confidence,
        "energy": resolved_energy,
        "energy_tag": energy_tag,
    }


def playlist_import_worker(app, playlist_import_id: int, track_infos: list):
    """Background thread worker to run Librosa analysis on new tracks."""
    with app.app_context():
        try:
            playlist_import = db.session.get(PlaylistImport, playlist_import_id)
            if not playlist_import:
                return

            from portfolio.models import TrackTempoAnnotation

            # Analyze tracks sequentially to avoid SQLite concurrent write locks
            for track_id, artist, title in track_infos:
                try:
                    annot = TrackTempoAnnotation.query.filter_by(track_id=track_id).first()
                    if not annot:
                        analyze_track_in_background(app, track_id, artist, title)
                except Exception as e:
                    app.logger.error(
                        "Error in background track analysis loop for track %s: %s", track_id, str(e)
                    )
                    try:
                        db.session.rollback()
                    except Exception:
                        pass
                finally:
                    db.session.remove()

            # Re-fetch the playlist import record in the current session
            playlist_import = db.session.get(PlaylistImport, playlist_import_id)
            if playlist_import:
                playlist_import.status = "complete"
                db.session.commit()
        except Exception as e:
            app.logger.error("Error in playlist_import_worker: %s", str(e))
            try:
                db.session.rollback()
            except Exception:
                pass
        finally:
            db.session.remove()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@roomba_bp.route("/")
def index():
    """Render the DJ Roomba landing page."""
    user_id = session.get("user_id")
    token_rec = SpotifyToken.query.filter_by(user_id=user_id).first()

    spotify_connected = False
    reconnect_required = False

    if token_rec:
        spotify_connected = True
        required = {"playlist-read-private", "playlist-read-collaborative"}
        granted = set((token_rec.scope or "").split())
        if not required.issubset(granted):
            reconnect_required = True

    return render_template(
        "roomba/index.html",
        spotify_connected=spotify_connected,
        reconnect_required=reconnect_required,
    )


@roomba_bp.route("/api/roomba/playlists")
@limiter.limit("20 per minute")
def api_playlists():
    """Fetch the logged-in user's Spotify playlists."""
    user_id = session.get("user_id")
    access_token = _get_valid_token(user_id)
    if not access_token:
        return jsonify({"error": "spotify_required"}), 403

    # Check session cache
    cache = session.get("spotify_playlists_cache")
    if cache:
        fetched_at = cache.get("fetched_at", 0)
        if datetime.now(timezone.utc).timestamp() - fetched_at < 300:
            return jsonify(cache["data"])

    playlists_data = get_user_playlists(access_token, limit=50)
    if not playlists_data:
        return jsonify({"error": "Failed to fetch playlists from Spotify"}), 502

    if "_error" in playlists_data:
        return jsonify({"error": "spotify_required"}), 403

    # Cache in session
    session["spotify_playlists_cache"] = {
        "fetched_at": datetime.now(timezone.utc).timestamp(),
        "data": playlists_data,
    }

    return jsonify(playlists_data)


@roomba_bp.route("/api/roomba/import", methods=["POST"])
@limiter.limit("5 per minute")
def api_import():  # noqa: C901
    """Import a playlist by ID."""
    user_id = session.get("user_id")
    body = request.get_json(silent=True) or {}
    playlist_id = body.get("playlist_id")
    playlist_name = body.get("playlist_name", "Spotify Playlist")

    if not playlist_id:
        return jsonify({"error": "playlist_id is required"}), 400

    if not validate_spotify_id(playlist_id):
        return jsonify({"error": "Invalid playlist ID format"}), 400

    # Idempotency check: reject if imported in last 5 minutes
    recent = (
        PlaylistImport.query.filter_by(user_id=user_id, source_playlist_id=playlist_id)
        .order_by(PlaylistImport.imported_at.desc())
        .first()
    )
    if recent and (
        datetime.now(timezone.utc) - recent.imported_at.replace(tzinfo=timezone.utc)
    ) < timedelta(minutes=5):
        return jsonify(
            {
                "error": "This playlist was imported recently. Please wait a few minutes before importing again."
            }
        ), 429

    access_token = _get_valid_token(user_id)
    if not access_token:
        return jsonify({"error": "spotify_required"}), 403

    # Fetch all tracks from Spotify (max 200 tracks)
    tracks, was_truncated = get_playlist_tracks_all(access_token, playlist_id, max_tracks=200)

    if was_truncated:
        return jsonify({"error": "Playlist exceeds the 200-track limit."}), 422

    if not tracks:
        return jsonify({"error": "Playlist contains no tracks or could not be loaded."}), 422

    # Check if we have an inactive import to reuse, or create new
    playlist_import = PlaylistImport.query.filter_by(
        user_id=user_id, source_playlist_id=playlist_id
    ).first()
    if playlist_import:
        playlist_import.status = "importing"
        playlist_import.is_active = True
        playlist_import.playlist_name = playlist_name
        playlist_import.imported_at = datetime.now(timezone.utc)
        # Clear existing playlist tracks
        PlaylistTrack.query.filter_by(playlist_id=playlist_import.id).delete()
    else:
        playlist_import = PlaylistImport(
            user_id=user_id,
            source_playlist_id=playlist_id,
            playlist_name=playlist_name,
            status="importing",
            is_active=True,
        )
        db.session.add(playlist_import)
        db.session.flush()

    track_infos = []
    for idx, track_data in enumerate(tracks):
        spotify_id = track_data.get("id")
        if not spotify_id:
            continue

        # Get or create TrackIdentity
        identity = TrackIdentity.query.filter_by(spotify_track_id=spotify_id).first()
        if not identity:
            artists = track_data.get("artists", [])
            artist_str = ", ".join(a.get("name", "") for a in artists)
            images = track_data.get("album", {}).get("images", [])
            art_url = (
                images[1].get("url")
                if len(images) > 1
                else (images[0].get("url") if images else None)
            )

            identity = TrackIdentity(
                spotify_track_id=spotify_id,
                title=track_data.get("name", "Unknown Track"),
                artist=artist_str or "Unknown Artist",
                album=track_data.get("album", {}).get("name"),
                album_art_url=art_url,
                duration_ms=track_data.get("duration_ms"),
            )
            db.session.add(identity)
            db.session.flush()

        # Create PlaylistTrack
        pt = PlaylistTrack(playlist_id=playlist_import.id, track_id=identity.id, position=idx)
        db.session.add(pt)
        track_infos.append((identity.id, identity.artist, identity.title))

    db.session.commit()

    # Spawn background thread for librosa key/BPM analysis
    app = current_app._get_current_object()
    thread = threading.Thread(
        target=playlist_import_worker, args=(app, playlist_import.id, track_infos)
    )
    thread.daemon = True
    thread.start()

    return jsonify(
        {
            "success": True,
            "playlist_import_id": playlist_import.id,
            "message": "Playlist import started. Background analysis is active.",
        }
    ), 202


@roomba_bp.route("/api/roomba/playlist/<int:playlist_id>")
def api_playlist_detail(playlist_id):
    """Fetch detail for a specific playlist import, including all tracks."""
    user_id = session.get("user_id")
    playlist = PlaylistImport.query.filter_by(
        id=playlist_id, user_id=user_id, is_active=True
    ).first()
    if not playlist:
        return jsonify({"error": "Playlist import not found"}), 404

    # Eager load tracks to avoid N+1
    playlist_tracks = (
        PlaylistTrack.query.filter_by(playlist_id=playlist_id)
        .order_by(PlaylistTrack.position)
        .all()
    )
    track_ids = [pt.track_id for pt in playlist_tracks]

    identities = {
        t.id: t for t in TrackIdentity.query.filter(TrackIdentity.id.in_(track_ids)).all()
    }

    # Batch load annotations to prevent N+1
    tempos = {
        t.track_id: t
        for t in TrackTempoAnnotation.query.filter(
            TrackTempoAnnotation.track_id.in_(track_ids)
        ).all()
    }
    tfas = TrackFeatureAnnotation.query.filter(TrackFeatureAnnotation.track_id.in_(track_ids)).all()

    manual_feats = {}
    librosa_feats = {}
    for f in tfas:
        if f.source == "manual":
            manual_feats[f.track_id] = f
        elif f.source == "librosa":
            librosa_feats[f.track_id] = f

    # Build track response objects
    tracks_list = []
    for pt in playlist_tracks:
        identity = identities.get(pt.track_id)
        if not identity:
            continue

        features = get_resolved_features_cached(identity.id, tempos, manual_feats, librosa_feats)
        tracks_list.append(
            {
                "id": identity.id,
                "spotify_track_id": identity.spotify_track_id,
                "title": identity.title,
                "artist": identity.artist,
                "album": identity.album,
                "album_art_url": identity.album_art_url,
                "duration_ms": identity.duration_ms,
                "position": pt.position,
                "features": features,
            }
        )

    return jsonify(
        {
            "id": playlist.id,
            "playlist_name": playlist.playlist_name,
            "source_playlist_id": playlist.source_playlist_id,
            "status": playlist.status,
            "imported_at": playlist.imported_at.isoformat(),
            "tracks": tracks_list,
        }
    )


@roomba_bp.route("/api/roomba/track/<int:track_id>/features", methods=["PUT"])
def api_update_features(track_id):  # noqa: C901
    """Update manual features (BPM, key, energy) for a track."""
    user_id = session.get("user_id")
    body = request.get_json(silent=True) or {}

    # Ownership verification: must exist in at least one of the user's playlists
    exists = (
        db.session.query(PlaylistTrack)
        .join(PlaylistImport)
        .filter(PlaylistImport.user_id == user_id, PlaylistTrack.track_id == track_id)
        .first()
    )
    if not exists:
        return jsonify({"error": "Track access denied or track not in user playlist"}), 403

    manual_key = body.get("camelot_key")
    manual_bpm = body.get("bpm")
    manual_energy = body.get("energy_tag")

    # Input validation
    if manual_key:
        if not re.match(r"^(1[0-2]|[1-9])[AB]$", manual_key):
            return jsonify({"error": f"Invalid Camelot key: {manual_key}"}), 400

    if manual_energy:
        allowed = {"low", "medium", "high", "very_high"}
        if manual_energy not in allowed:
            return jsonify({"error": f"Invalid energy tag: {manual_energy}"}), 400

    if manual_bpm is not None:
        try:
            manual_bpm = float(manual_bpm)
            if not (40.0 <= manual_bpm <= 300.0):
                raise ValueError()
        except (TypeError, ValueError):
            return jsonify({"error": "BPM must be a number between 40 and 300"}), 400

    # Update TrackTempoAnnotation for BPM and base key
    tempo = TrackTempoAnnotation.query.filter_by(track_id=track_id).first()
    if manual_bpm is not None:
        if tempo:
            tempo.canonical_bpm = manual_bpm
            tempo.confidence = "verified"
            tempo.source = "manual"
        else:
            half_bpm = round(manual_bpm / 2.0, 1)
            double_bpm = round(manual_bpm * 2.0, 1)
            tempo = TrackTempoAnnotation(
                track_id=track_id,
                canonical_bpm=manual_bpm,
                alternate_bpms=[half_bpm, double_bpm],
                confidence="verified",
                source="manual",
                time_signature="4/4",
            )
            db.session.add(tempo)

    # Update manual TrackFeatureAnnotation for key/energy overrides
    tfa = TrackFeatureAnnotation.query.filter_by(track_id=track_id, source="manual").first()
    if not tfa:
        tfa = TrackFeatureAnnotation(track_id=track_id, source="manual", confidence=1.0)
        db.session.add(tfa)

    if manual_key:
        tfa.camelot_key = manual_key
        # Also update basic key fields in TrackTempoAnnotation if present
        if tempo:
            tempo.camelot_key = manual_key
            # Derive musical_key/key_mode from Camelot key
            num = int(manual_key[:-1])
            letter = manual_key[-1]
            tempo.key_mode = 1 if letter == "B" else 0
            # Inverse of Camelot: (num - 8) * 7 % 12 for major, (num - 5) * 7 % 12 for minor
            if letter == "B":
                tempo.musical_key = ((num - 8) * 7) % 12
            else:
                tempo.musical_key = ((num - 5) * 7) % 12

    if manual_energy:
        tfa.energy_tag = manual_energy

    # Mark transition candidates as stale
    TransitionCandidate.query.filter(
        (TransitionCandidate.from_track_id == track_id)
        | (TransitionCandidate.to_track_id == track_id)
    ).update(
        {
            TransitionCandidate.status: "stale",
            TransitionCandidate.stale_reason: "Track features manually updated",
        }
    )

    db.session.commit()

    return jsonify({"success": True, "features": get_resolved_features(track_id)})


@roomba_bp.route("/api/roomba/transitions/<int:playlist_id>/<int:track_id>")
def api_transitions(playlist_id, track_id):  # noqa: C901
    """Fetch transitions from the selected track to all other tracks in the playlist."""
    user_id = session.get("user_id")
    preset_name = request.args.get("preset", "Beatmatcher")
    if preset_name not in ("Beatmatcher", "Harmonic Mixer", "Open Format"):
        preset_name = "Beatmatcher"

    # Verify playlist ownership
    playlist = PlaylistImport.query.filter_by(
        id=playlist_id, user_id=user_id, is_active=True
    ).first()
    if not playlist:
        return jsonify({"error": "Playlist access denied or not found"}), 403

    # Verify source track belongs to playlist
    src_pt = PlaylistTrack.query.filter_by(playlist_id=playlist_id, track_id=track_id).first()
    if not src_pt:
        return jsonify({"error": "Source track not in playlist"}), 404

    # Get all other tracks in this playlist
    all_pts = PlaylistTrack.query.filter_by(playlist_id=playlist_id).all()
    candidate_ids = [pt.track_id for pt in all_pts if pt.track_id != track_id]

    all_track_ids = [track_id, *candidate_ids]

    # Batch load annotations
    tempos = {
        t.track_id: t
        for t in TrackTempoAnnotation.query.filter(
            TrackTempoAnnotation.track_id.in_(all_track_ids)
        ).all()
    }
    tfas = TrackFeatureAnnotation.query.filter(
        TrackFeatureAnnotation.track_id.in_(all_track_ids)
    ).all()

    manual_feats = {}
    librosa_feats = {}
    for f in tfas:
        if f.source == "manual":
            manual_feats[f.track_id] = f
        elif f.source == "librosa":
            librosa_feats[f.track_id] = f

    # Batch load existing TransitionCandidate records
    existing_tcs = {
        tc.to_track_id: tc
        for tc in TransitionCandidate.query.filter_by(
            playlist_id=playlist_id, from_track_id=track_id
        ).all()
    }

    features_a = get_resolved_features_cached(track_id, tempos, manual_feats, librosa_feats)

    # Compute on demand using cached maps
    for candidate_id in candidate_ids:
        tc = existing_tcs.get(candidate_id)

        needs_compute = tc is None or tc.status == "stale"
        if needs_compute:
            features_b = get_resolved_features_cached(
                candidate_id, tempos, manual_feats, librosa_feats
            )
            scores = score_transition(features_a, features_b, preset_name)

            if tc:
                tc.total_score = scores["total_score"]
                tc.tempo_score = scores["tempo_score"]
                tc.harmonic_score = scores["harmonic_score"]
                tc.energy_score = scores["energy_score"]
                tc.risk_flags_json = scores["risk_flags"]
                tc.explanation_json = scores["explanation"]
                tc.status = "computed"
                tc.stale_reason = None
                tc.computed_at = datetime.now(timezone.utc)
            else:
                tc = TransitionCandidate(
                    playlist_id=playlist_id,
                    from_track_id=track_id,
                    to_track_id=candidate_id,
                    total_score=scores["total_score"],
                    tempo_score=scores["tempo_score"],
                    harmonic_score=scores["harmonic_score"],
                    energy_score=scores["energy_score"],
                    risk_flags_json=scores["risk_flags"],
                    explanation_json=scores["explanation"],
                    status="computed",
                )
                db.session.add(tc)

    db.session.commit()

    # Fetch all computed candidates with eager loaded to_track
    candidates = (
        TransitionCandidate.query.filter_by(
            playlist_id=playlist_id, from_track_id=track_id, status="computed"
        )
        .options(joinedload(TransitionCandidate.to_track))
        .all()
    )

    # Group into buckets
    bucketed_candidates = []
    for c in candidates:
        feat_b = get_resolved_features_cached(c.to_track_id, tempos, manual_feats, librosa_feats)
        bucketed_candidates.append(
            {
                "track": {
                    "id": c.to_track.id,
                    "spotify_track_id": c.to_track.spotify_track_id,
                    "title": c.to_track.title,
                    "artist": c.to_track.artist,
                    "album": c.to_track.album,
                    "album_art_url": c.to_track.album_art_url,
                    "duration_ms": c.to_track.duration_ms,
                    "features": feat_b,
                },
                "score_data": {
                    "total_score": c.total_score,
                    "tempo_score": c.tempo_score,
                    "tempo_label": c.explanation_json.get("tempo_label", "unknown")
                    if c.explanation_json
                    else "unknown",
                    "harmonic_score": c.harmonic_score,
                    "harmonic_label": c.explanation_json.get("harmonic_label", "unknown")
                    if c.explanation_json
                    else "unknown",
                    "energy_score": c.energy_score,
                    "energy_direction": c.explanation_json.get("energy_direction", "unknown")
                    if c.explanation_json
                    else "unknown",
                    "risk_flags": c.risk_flags_json or [],
                    "explanation": c.explanation_json,
                },
            }
        )

    return jsonify(bucket_candidates(bucketed_candidates))
