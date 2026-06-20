"""BPM resolver — determines the best available BPM annotation for a track.

Resolution order:
  1. Verified admin annotation in TrackTempoAnnotation
  2. machine_high confidence annotation
  3. machine_low confidence annotation
  4. metadata_candidate annotation (unverified third-party)
  5. None (unresolved — attempt saved as ungraded)

Auto-population (no external calls needed):
  When a new Spotify track is first seen, we immediately check our own
  ReferenceTrack table for a normalized title+artist match. If found, a
  "verified" TrackTempoAnnotation is created automatically. This gives
  instant grading for all ~100 songs already seeded in the DB.

Machine estimates (client-side, submitted back via API):
  The bpm_detector.js module fetches an iTunes preview for the track,
  runs Web Audio autocorrelation, and POSTs the result to
  /spotify/api/submit-bpm. We store these as machine_low or machine_high
  depending on the detector's confidence score.

Third-party API stub:
  Implement _fetch_from_metadata_api() to add GetSongBPM or similar.
"""

from __future__ import annotations

import os
import re
import tempfile
import threading
import unicodedata
import urllib.parse
from datetime import datetime, timezone

import requests

try:
    import librosa

    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False

from portfolio import db
from portfolio.models import ReferenceTrack, TrackIdentity, TrackTempoAnnotation

# Anchor BPMs used by Count Me In for proximity detection
ANCHOR_BPMS = [95, 120, 128, 140]

# Confidence tiers in priority order (lower index = higher priority)
_CONFIDENCE_PRIORITY = [
    "verified",
    "machine_high",
    "machine_low",
    "metadata_candidate",
    "community",
]


# ---------------------------------------------------------------------------
# Text normalization for fuzzy title/artist matching
# ---------------------------------------------------------------------------


def _normalize_for_matching(text: str) -> str:
    """Normalize a title or artist string for fuzzy comparison.

    Strips accents, punctuation, featured-artist fragments, and lowercases.
    Examples:
      "Nuthin' but a 'G' Thang"  → "nuthin but a g thang"
      "Jay-Z ft. Alicia Keys"    → "jayz alicia keys"
      "Yeah! (Club Mix)"         → "yeah"
      "Beyoncé"                  → "beyonce"
    """
    if not text:
        return ""

    # Normalize unicode (strip accents: é → e)
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")

    text = text.lower()

    # Remove parenthetical suffixes: (Club Mix), (feat. X), (Remix), etc.
    text = re.sub(r"\(.*?\)", "", text)
    text = re.sub(r"\[.*?\]", "", text)

    # Remove feat/ft/featuring fragments
    text = re.sub(r"\bft\.?\b|\bfeat\.?\b|\bfeaturing\b", "", text)

    # Strip punctuation (keep spaces and alphanumerics)
    text = re.sub(r"[^\w\s]", "", text)

    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()

    return text


def _titles_match(a: str, b: str) -> bool:
    """Return True if two title strings match after normalization."""
    na, nb = _normalize_for_matching(a), _normalize_for_matching(b)
    if na == nb:
        return True
    # Also check if one is a substring of the other (handles "feat." tails)
    return na in nb or nb in na


def _artists_match(a: str, b: str) -> bool:
    """Return True if two artist strings share at least one common token.

    Reference tracks may have "Dr. Dre ft. Snoop Dogg" vs Spotify's
    "Dr. Dre" as the primary artist. We match if any significant word
    from the reference artist appears in the Spotify artist string.
    """
    na, nb = _normalize_for_matching(a), _normalize_for_matching(b)
    if na == nb:
        return True
    # Either string contained in the other (e.g. "dr dre" in "dr dre ft snoop dogg")
    if na in nb or nb in na:
        return True
    # Token overlap: any word longer than 2 chars that appears in both
    tokens_a = {w for w in na.split() if len(w) > 2}
    tokens_b = {w for w in nb.split() if len(w) > 2}
    return bool(tokens_a & tokens_b)


# ---------------------------------------------------------------------------
# Core resolver
# ---------------------------------------------------------------------------


def resolve_bpm_for_track(track_identity: TrackIdentity) -> TrackTempoAnnotation | None:
    """Return the highest-confidence BPM annotation for a given TrackIdentity.

    Args:
        track_identity: A TrackIdentity ORM object (must already be committed).

    Returns:
        The best TrackTempoAnnotation for this track, or None if no annotation exists.
    """
    annotations = (
        TrackTempoAnnotation.query.filter_by(track_id=track_identity.id)
        .filter(TrackTempoAnnotation.confidence != "unknown")
        .all()
    )

    if not annotations:
        return None

    def priority_key(ann: TrackTempoAnnotation) -> int:
        try:
            return _CONFIDENCE_PRIORITY.index(ann.confidence)
        except ValueError:
            return len(_CONFIDENCE_PRIORITY)

    return min(annotations, key=priority_key)


# ---------------------------------------------------------------------------
# Track identity upsert with auto reference-track lookup
# ---------------------------------------------------------------------------


def get_or_create_track_identity(track_data: dict) -> TrackIdentity:
    """Upsert a TrackIdentity from parsed Spotify track data.

    On first sight of a new track, automatically attempts to match it
    against the existing ReferenceTrack table and seed a verified
    TrackTempoAnnotation if a match is found.

    Args:
        track_data: Normalized dict from client.parse_track_identity().

    Returns:
        Existing or newly created TrackIdentity (committed to session).
    """
    spotify_id = track_data["spotify_track_id"]
    identity = TrackIdentity.query.filter_by(spotify_track_id=spotify_id).first()

    is_new = identity is None

    if is_new:
        identity = TrackIdentity(
            spotify_track_id=spotify_id,
            isrc=track_data.get("isrc"),
            title=track_data["title"],
            artist=track_data["artist"],
            album=track_data.get("album"),
            album_art_url=track_data.get("album_art_url"),
            duration_ms=track_data.get("duration_ms"),
        )
        db.session.add(identity)
        db.session.commit()
    else:
        # Refresh metadata fields if we now have them and didn't before
        updated = False
        if not identity.album_art_url and track_data.get("album_art_url"):
            identity.album_art_url = track_data["album_art_url"]
            updated = True
        if not identity.isrc and track_data.get("isrc"):
            identity.isrc = track_data["isrc"]
            updated = True
        if updated:
            db.session.commit()

    # For new tracks, attempt an immediate reference-track match.
    # This populates a verified annotation at zero cost for any track
    # that's already in our ReferenceTrack seed data.
    if is_new:
        matched = _seed_from_reference_tracks(identity)
        if not matched and HAS_LIBROSA:
            from flask import current_app

            app = current_app._get_current_object()
            t = threading.Thread(
                target=analyze_track_in_background,
                args=(app, identity.id, identity.artist, identity.title),
            )
            t.daemon = True
            t.start()

    return identity


def _seed_from_reference_tracks(identity: TrackIdentity) -> TrackTempoAnnotation | None:
    """Check our ReferenceTrack table for a title+artist match.

    If found, create a 'verified' TrackTempoAnnotation immediately.
    This covers all ~100 songs already manually seeded in the DB at no cost.

    The match is intentionally fuzzy: we normalize both sides so that
    "Nuthin' but a 'G' Thang" matches "Nuthin but a G Thang", and
    "Dr. Dre ft. Snoop Dogg" matches Spotify's "Dr. Dre".

    Args:
        identity: A newly committed TrackIdentity.

    Returns:
        The created TrackTempoAnnotation, or None if no match found.
    """
    # Skip if we already have a verified annotation somehow
    existing = TrackTempoAnnotation.query.filter_by(
        track_id=identity.id, confidence="verified"
    ).first()
    if existing:
        return existing

    # Load all reference tracks and do in-memory fuzzy matching.
    # The table is small (~100 rows), so this is fine without a DB-level
    # full-text index. If the table grows large, add a proper search index.
    all_refs = ReferenceTrack.query.all()

    best_match = None
    for ref in all_refs:
        if _titles_match(identity.title, ref.title) and _artists_match(identity.artist, ref.artist):
            best_match = ref
            break

    if best_match is None:
        return None

    annotation = TrackTempoAnnotation(
        track_id=identity.id,
        canonical_bpm=float(best_match.bpm),
        alternate_bpms=None,
        time_signature="4/4",  # All seeded tracks are 4/4
        confidence="verified",
        source="reference_track_db",
        needs_review=False,
        notes=f"Auto-matched from ReferenceTrack id={best_match.id}: "
        f"'{best_match.title}' by '{best_match.artist}'",
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(annotation)
    db.session.commit()

    return annotation


# ---------------------------------------------------------------------------
# Machine estimate ingestion (from client-side iTunes beat detector)
# ---------------------------------------------------------------------------


def create_machine_estimate(
    track_identity: TrackIdentity,
    estimated_bpm: float,
    confidence_score: float,
    itunes_track_id: str | None = None,
    itunes_preview_url: str | None = None,
) -> TrackTempoAnnotation:
    """Store a client-side Web Audio beat detection result.

    Called by POST /spotify/api/submit-bpm after the browser runs
    onset-detection on an iTunes preview clip.

    Confidence tier mapping:
      score >= 0.75  → machine_high
      score >= 0.40  → machine_low
      below 0.40     → metadata_candidate (treated as weak estimate)

    Alternate BPMs are automatically computed: half and double of the
    estimate are stored so the half/double-time toggle works correctly.

    Args:
        track_identity: The TrackIdentity this estimate belongs to.
        estimated_bpm: Raw BPM value from the detector (float).
        confidence_score: 0.0-1.0 score from the autocorrelation peak ratio.
        itunes_track_id: iTunes trackId for auditing (optional).
        itunes_preview_url: Source preview URL used for analysis (optional).

    Returns:
        The newly created or updated TrackTempoAnnotation.
    """
    # Don't overwrite a verified annotation
    existing_verified = TrackTempoAnnotation.query.filter_by(
        track_id=track_identity.id, confidence="verified"
    ).first()
    if existing_verified:
        return existing_verified

    # Determine confidence tier
    if confidence_score >= 0.75:
        confidence = "machine_high"
    elif confidence_score >= 0.40:
        confidence = "machine_low"
    else:
        confidence = "metadata_candidate"

    # Compute standard alternates (half/double)
    half_bpm = round(estimated_bpm / 2.0, 1)
    double_bpm = round(estimated_bpm * 2.0, 1)
    alternate_bpms = [half_bpm, double_bpm]

    # Build audit note
    notes_parts = [f"iTunes beat detection: score={confidence_score:.3f}"]
    if itunes_track_id:
        notes_parts.append(f"itunes_track_id={itunes_track_id}")
    if itunes_preview_url:
        notes_parts.append(f"preview={itunes_preview_url[:80]}")

    # Check if we already have a machine estimate — update it rather than duplicate
    existing_machine = TrackTempoAnnotation.query.filter_by(
        track_id=track_identity.id, source="itunes_beat_detection"
    ).first()

    if existing_machine:
        # Only update if new confidence is higher
        old_priority = (
            _CONFIDENCE_PRIORITY.index(existing_machine.confidence)
            if existing_machine.confidence in _CONFIDENCE_PRIORITY
            else 99
        )
        new_priority = (
            _CONFIDENCE_PRIORITY.index(confidence) if confidence in _CONFIDENCE_PRIORITY else 99
        )
        if new_priority <= old_priority:
            existing_machine.canonical_bpm = estimated_bpm
            existing_machine.alternate_bpms = alternate_bpms
            existing_machine.confidence = confidence
            existing_machine.notes = "; ".join(notes_parts)
            db.session.commit()
        return existing_machine

    annotation = TrackTempoAnnotation(
        track_id=track_identity.id,
        canonical_bpm=estimated_bpm,
        alternate_bpms=alternate_bpms,
        time_signature="4/4",
        confidence=confidence,
        source="itunes_beat_detection",
        needs_review=(confidence != "machine_high"),
        notes="; ".join(notes_parts),
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(annotation)
    db.session.commit()
    return annotation


# ---------------------------------------------------------------------------
# Grading
# ---------------------------------------------------------------------------


def compute_grade(
    guessed_bpm: float,
    annotation: TrackTempoAnnotation,
    metrical_multiplier: float = 1.0,
) -> dict:
    """Compute grading results for a listening attempt.

    Applies the same metrical-multiplier logic as the main CMI challenge grader:
    the user's guess is compared against canonical_bpm * metrical_multiplier,
    so a "correct" half-time guess (multiplier=0.5) isn't penalized.

    Args:
        guessed_bpm: The user's numeric BPM guess.
        annotation: The resolved TrackTempoAnnotation.
        metrical_multiplier: 0.5 for half-time, 1.0 for normal, 2.0 for double.

    Returns:
        dict with: percent_error, rating, feedback_label, is_anchor_adjacent,
                   anchor_bpm_near, effective_bpm
    """
    effective_bpm = annotation.canonical_bpm * metrical_multiplier
    bpm_error = abs(guessed_bpm - effective_bpm)
    percent_error = (bpm_error / effective_bpm) * 100.0 if effective_bpm else 0.0

    # Rating thresholds (mirrors existing CMI logic)
    if percent_error <= 1.0:
        rating = "Perfect"
        feedback_label = "🎯 Locked in"
    elif percent_error <= 3.0:
        rating = "Excellent"
        feedback_label = "✅ Very close"
    elif percent_error <= 6.0:
        rating = "Good"
        feedback_label = "👍 Decent ear"
    elif percent_error <= 12.0:
        rating = "Fair"
        feedback_label = "🔍 Getting there"
    else:
        rating = "Miss"
        feedback_label = "🎓 Keep training"

    # Anchor proximity detection
    is_anchor_adjacent = False
    anchor_bpm_near = None
    for anchor in ANCHOR_BPMS:
        if abs(guessed_bpm - anchor) <= 3.0:
            is_anchor_adjacent = True
            anchor_bpm_near = anchor
            break

    return {
        "percent_error": round(percent_error, 2),
        "rating": rating,
        "feedback_label": feedback_label,
        "is_anchor_adjacent": is_anchor_adjacent,
        "anchor_bpm_near": anchor_bpm_near,
        "effective_bpm": round(effective_bpm, 1),
    }


# ---------------------------------------------------------------------------
# Background Librosa analysis
# ---------------------------------------------------------------------------


def analyze_track_in_background(app, track_identity_id: int, artist: str, title: str):  # noqa: C901
    """Background task to query iTunes, download preview, and analyze with Librosa."""
    if not HAS_LIBROSA:
        return

    with app.app_context():
        # Clean title to improve iTunes search accuracy
        clean_title = re.sub(r"\(.*?\)|\[.*?\]", "", title).strip()
        query = f"{artist} {clean_title}"
        encoded_query = urllib.parse.quote(query)
        search_url = f"https://itunes.apple.com/search?term={encoded_query}&media=music&limit=1"

        try:
            r = requests.get(search_url, timeout=5)
            if r.status_code != 200:
                return
            data = r.json()
            results = data.get("results")
            if not results:
                return

            result = results[0]
            preview_url = result.get("previewUrl")
            itunes_id = str(result.get("trackId"))

            if not preview_url:
                return

            # Apple CDN domain check
            parsed_url = urllib.parse.urlparse(preview_url)
            if not parsed_url.netloc.endswith(".apple.com"):
                app.logger.warning(
                    "Rejected iTunes preview URL with non-Apple domain: %s", preview_url
                )
                return

            # Download preview with 10MB limit
            preview_resp = requests.get(preview_url, stream=True, timeout=10)
            if preview_resp.status_code != 200:
                return

            # Check Content-Length header first
            cl = preview_resp.headers.get("content-length")
            if cl and int(cl) > 10 * 1024 * 1024:
                app.logger.warning(
                    "Rejected iTunes preview due to content-length exceeding 10MB: %s", cl
                )
                return

            # Download chunks with size limit
            content = b""
            for chunk in preview_resp.iter_content(chunk_size=65536):
                content += chunk
                if len(content) > 10 * 1024 * 1024:
                    app.logger.warning("Aborted download: iTunes preview exceeds 10MB limit.")
                    return

            # Write to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".m4a") as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                # Load and analyze
                y, sr = librosa.load(tmp_path, sr=None)
                tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
                if hasattr(tempo, "item"):
                    tempo = tempo.item()

                estimated_bpm = round(float(tempo), 1)
                if not (40.0 <= estimated_bpm <= 300.0):
                    return

                # Chroma key detection using KS pitch-class profile matching
                import numpy as np

                y_harmonic = librosa.effects.harmonic(y)
                chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr)
                chroma_mean = chroma.mean(axis=1)

                major_profile = np.array(
                    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
                )
                minor_profile = np.array(
                    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
                )

                # Normalize profiles
                major_profile = (major_profile - np.mean(major_profile)) / np.std(major_profile)
                minor_profile = (minor_profile - np.mean(minor_profile)) / np.std(minor_profile)

                # Normalize chroma_mean
                chroma_mean = np.array(chroma_mean)
                if np.std(chroma_mean) > 0:
                    chroma_mean = (chroma_mean - np.mean(chroma_mean)) / np.std(chroma_mean)

                best_corr = -2.0
                best_key = 0
                best_mode = 1

                for key_candidate in range(12):
                    major_rotated = np.roll(major_profile, key_candidate)
                    corr_major = np.corrcoef(chroma_mean, major_rotated)[0, 1]

                    minor_rotated = np.roll(minor_profile, key_candidate)
                    corr_minor = np.corrcoef(chroma_mean, minor_rotated)[0, 1]

                    if corr_major > best_corr:
                        best_corr = corr_major
                        best_key = key_candidate
                        best_mode = 1
                    if corr_minor > best_corr:
                        best_corr = corr_minor
                        best_key = key_candidate
                        best_mode = 0

                estimated_key = best_key
                estimated_mode = best_mode

                def _to_camelot(k: int, m: int) -> str:
                    if m == 1:
                        num = (k * 7 + 8) % 12
                        letter = "B"
                    else:
                        num = (k * 7 + 5) % 12
                        letter = "A"
                    if num == 0:
                        num = 12
                    return f"{num}{letter}"

                camelot_key = _to_camelot(estimated_key, estimated_mode)
                key_confidence = max(0.0, float(best_corr))

                # Store annotation
                identity = db.session.get(TrackIdentity, track_identity_id)
                if identity:
                    # Check if there is already an annotation
                    existing = TrackTempoAnnotation.query.filter_by(track_id=identity.id).first()
                    if not existing:
                        half_bpm = round(estimated_bpm / 2.0, 1)
                        double_bpm = round(estimated_bpm * 2.0, 1)
                        alternate_bpms = [half_bpm, double_bpm]

                        annotation = TrackTempoAnnotation(
                            track_id=identity.id,
                            canonical_bpm=estimated_bpm,
                            alternate_bpms=alternate_bpms,
                            time_signature="4/4",
                            confidence="machine_low",  # Changed from machine_high per plan
                            source="librosa_beat_detection",
                            needs_review=True,
                            notes=f"Librosa automatic beat detection on iTunes preview: itunes_track_id={itunes_id}",
                            created_at=datetime.now(timezone.utc),
                            musical_key=estimated_key,
                            key_mode=estimated_mode,
                            camelot_key=camelot_key,
                            key_confidence=key_confidence,
                        )
                        db.session.add(annotation)
                        db.session.commit()
                    else:
                        # Update key if missing
                        if existing.camelot_key is None:
                            existing.musical_key = estimated_key
                            existing.key_mode = estimated_mode
                            existing.camelot_key = camelot_key
                            existing.key_confidence = key_confidence
                            db.session.commit()
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        except Exception as e:
            # Safe fail in background thread to prevent thread crash propagation
            app.logger.error("Error analyzing track in background: %s", str(e), exc_info=True)
            try:
                db.session.rollback()
            except Exception:
                pass
        finally:
            db.session.remove()


# ---------------------------------------------------------------------------
# Third-party API stub
# ---------------------------------------------------------------------------


def _fetch_from_metadata_api(track_identity: TrackIdentity) -> TrackTempoAnnotation | None:
    """Stub: query a third-party BPM metadata service (e.g. GetSongBPM).

    NOT implemented in MVP. To integrate a service:
    1. Make an HTTP request using track_identity.isrc or title/artist
    2. Create and commit a TrackTempoAnnotation with confidence="metadata_candidate"
    3. Return the annotation

    Return None to indicate the lookup did not produce a result.
    """
    return None
