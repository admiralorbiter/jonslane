from datetime import datetime, timezone

from flask import Blueprint, jsonify, render_template, request, session

from portfolio import db
from portfolio.models import Attempt, User
from portfolio.routes.game import calculate_piano_score_and_rating

piano_bp = Blueprint("piano", __name__, url_prefix="/piano")


@piano_bp.route("/")
def index():
    """Render the main Piano Lab SPA container."""
    return render_template("piano/piano_lab.html")


@piano_bp.route("/api/attempts", methods=["POST"])
def submit_attempt():
    """Submit a Piano Lab attempt to the database for authenticated users."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json() or {}
    client_uuid = data.get("client_uuid")
    if not client_uuid:
        return jsonify({"error": "Missing client UUID."}), 400

    # Prevent duplicates
    existing = Attempt.query.filter_by(client_uuid=client_uuid).first()
    if existing:
        return jsonify({"error": "Attempt already recorded."}), 409

    # Extract fields
    skill_tag = data.get("skill_tag")
    input_method = data.get("input_method", "tap")
    hand = data.get("hand")

    # Parse numeric timing fields
    try:
        guessed_bpm = float(data.get("guessed_bpm", 120.0))
        true_bpm = float(data.get("true_bpm", 120.0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid BPM format."}), 400

    tap_stability = None
    if data.get("tap_stability") is not None:
        try:
            tap_stability = float(data["tap_stability"])
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid tap stability format."}), 400

    phase_error_ms = None
    if data.get("phase_error_ms") is not None:
        try:
            phase_error_ms = float(data["phase_error_ms"])
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid phase error format."}), 400

    phrase_length = None
    if data.get("phrase_length") is not None:
        try:
            phrase_length = int(data["phrase_length"])
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid phrase length format."}), 400

    # Calculate metrics
    score, rating, is_success, percent_error, bpm_error, metrical_multiplier = (
        calculate_piano_score_and_rating(
            skill_tag, tap_stability=tap_stability, phase_error_ms=phase_error_ms
        )
    )

    try:
        attempt = Attempt(
            user_id=user.id,
            challenge_id=None,
            guessed_bpm=guessed_bpm,
            true_bpm=true_bpm,
            bpm_error=bpm_error,
            percent_error=percent_error,
            score=score,
            rating=rating,
            crate_name="Piano Lab",
            client_uuid=client_uuid,
            metrical_multiplier=metrical_multiplier,
            tap_stability=tap_stability,
            is_anchor=False,
            module="piano_lab",
            skill_tag=skill_tag,
            input_method=input_method,
            phase_error_ms=phase_error_ms,
            hand=hand,
            phrase_length=phrase_length,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(attempt)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to save attempt: {e!s}"}), 500

    return jsonify(
        {
            "success": True,
            "score": score,
            "rating": rating,
        }
    ), 201
