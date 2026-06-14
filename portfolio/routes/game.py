import json
import random
from datetime import datetime, timezone

from flask import Blueprint, jsonify, render_template, request

from portfolio import db
from portfolio.models import Attempt, Challenge, Crate, User

game_bp = Blueprint("game", __name__, url_prefix="/game")


@game_bp.after_request
def add_header(response):
    """Add cache prevention headers to all game responses."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


def get_range_key(bpm):
    """Return the tempo category string for a given BPM."""
    if bpm < 90:
        return "Slow (60-90 BPM)"
    if bpm < 120:
        return "Mid (90-120 BPM)"
    if bpm < 140:
        return "Dance (120-140 BPM)"
    return "Fast (140+ BPM)"


def calculate_user_stats(user, attempts):
    """Calculate and format statistical performance for a user's attempts."""
    total_attempts = len(attempts)
    stats = {
        "total_attempts": total_attempts,
        "avg_error": 0.0,
        "avg_percent_error": 0.0,
        "best_range": "N/A",
        "streak": user.current_streak,
        "max_streak": user.max_streak,
        "rating_breakdown": {
            "Tempo Wizard": 0,
            "DJ-Ready": 0,
            "Solid Ear": 0,
            "Getting There": 0,
            "Needs Practice": 0,
        },
    }

    if total_attempts > 0:
        total_error = sum(abs(a.bpm_error) for a in attempts)
        total_pct_error = sum(a.percent_error for a in attempts)
        stats["avg_error"] = round(total_error / total_attempts, 2)
        stats["avg_percent_error"] = round(total_pct_error / total_attempts, 2)

        # Count ratings
        for a in attempts:
            if a.rating in stats["rating_breakdown"]:
                stats["rating_breakdown"][a.rating] += 1

        # Analyze ranges
        ranges = {
            "Slow (60-90 BPM)": [],
            "Mid (90-120 BPM)": [],
            "Dance (120-140 BPM)": [],
            "Fast (140+ BPM)": [],
        }
        for a in attempts:
            r_key = get_range_key(a.true_bpm)
            ranges[r_key].append(a.percent_error)

        best_avg = float("inf")
        best_name = "N/A"
        for range_name, errors in ranges.items():
            if errors:
                avg = sum(errors) / len(errors)
                if avg < best_avg:
                    best_avg = avg
                    best_name = f"{range_name} (avg error {round(avg, 1)}%)"
        stats["best_range"] = best_name

    return stats


def calculate_score_and_rating(percent_error):
    """Return (score, rating, is_success) for a given percent error."""
    if percent_error < 1.0:
        return 100, "Tempo Wizard", True
    if percent_error <= 3.0:
        return 75, "DJ-Ready", True
    if percent_error <= 5.0:
        return 50, "Solid Ear", True
    if percent_error <= 8.0:
        return 25, "Getting There", False
    return 10, "Needs Practice", False


def validate_and_parse_attempt_data(att_data):
    """Validate and parse a single raw attempt data dict, returning parsed fields or None."""
    client_uuid = att_data.get("client_uuid")
    if not client_uuid:
        return None

    try:
        guessed = float(att_data.get("guessed_bpm"))
        true_bpm = float(att_data.get("true_bpm"))
        bpm_error = float(att_data.get("bpm_error"))
        percent_error = float(att_data.get("percent_error"))
        score = int(att_data.get("score"))
        rating = str(att_data.get("rating"))
        crate_name = str(att_data.get("crate_name", "Unknown Crate"))

        if not (1.0 <= guessed <= 300.0) or not (1.0 <= true_bpm <= 300.0):
            return None
        if not (0 <= percent_error <= 100.0) or not (0 <= score <= 200):
            return None
    except (ValueError, TypeError):
        return None

    try:
        created_at_dt = datetime.fromisoformat(att_data.get("created_at").replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError):
        created_at_dt = datetime.now(timezone.utc)

    return {
        "client_uuid": client_uuid,
        "guessed_bpm": guessed,
        "true_bpm": true_bpm,
        "bpm_error": bpm_error,
        "percent_error": percent_error,
        "score": score,
        "rating": rating,
        "crate_name": crate_name,
        "created_at": created_at_dt,
    }


def recalculate_user_streaks(user):
    """Recalculate and persist chronological streaks for a user."""
    all_attempts = Attempt.query.filter_by(user_id=user.id).order_by(Attempt.created_at.asc()).all()
    current_streak = 0
    max_streak = user.max_streak

    for a in all_attempts:
        if a.percent_error <= 5.0:
            current_streak += 1
            if current_streak > max_streak:
                max_streak = current_streak
        else:
            current_streak = 0

    user.current_streak = current_streak
    user.max_streak = max_streak
    db.session.commit()


@game_bp.route("/dashboard")
def dashboard():
    from flask import session

    user_id = session.get("user_id")
    user = User.query.get(user_id) if user_id else None

    stats = None
    if user:
        attempts = Attempt.query.filter_by(user_id=user.id).all()
        stats = calculate_user_stats(user, attempts)

    crates = Crate.query.all()
    return render_template("game/dashboard.html", crates=crates, stats=stats)


@game_bp.route("/play/<int:crate_id>")
def play(crate_id):
    crate = Crate.query.get_or_404(crate_id)

    # Generate random true BPM
    true_bpm = round(random.uniform(crate.min_bpm, crate.max_bpm), 1)

    # Generate a simple beat recipe JSON depending on genre
    # In Tone.js, this tells it what instruments and notes to schedule
    recipe = {
        "genre": crate.genre,
        "bpm": true_bpm,
        "elements": ["kick", "snare", "hihat"],
    }
    if crate.genre == "house":
        recipe["elements"] = ["kick", "snare", "hihat", "bass"]
    elif crate.genre == "trap":
        recipe["elements"] = ["kick", "snare", "hihat_roll", "clap"]
        recipe["half_time"] = True

    return render_template("game/play.html", recipe_json=json.dumps(recipe), crate=crate)


@game_bp.route("/submit", methods=["POST"])
def submit():
    data = request.get_json() or {}
    challenge_id = data.get("challenge_id")
    guess_val = data.get("guess")

    if not challenge_id or guess_val is None:
        return jsonify({"error": "Invalid request parameters"}), 400

    try:
        guess = float(guess_val)
    except ValueError:
        return jsonify({"error": "Guess must be a valid number"}), 400

    challenge = Challenge.query.get_or_404(challenge_id)
    true_bpm = challenge.true_bpm

    bpm_error = guess - true_bpm
    abs_error = abs(bpm_error)
    percent_error = (abs_error / true_bpm) * 100

    # Score & Rating calculation
    score, rating, is_success = calculate_score_and_rating(percent_error)

    # Get user
    from flask import session

    user_id = session.get("user_id")
    user = User.query.get(user_id) if user_id else None
    if not user:
        user = User.query.first()
        if not user:
            user = User(display_name="Guest DJ")
            db.session.add(user)
            db.session.commit()

    # Update Streak
    if is_success:
        user.current_streak += 1
        if user.current_streak > user.max_streak:
            user.max_streak = user.current_streak
    else:
        user.current_streak = 0

    attempt = Attempt(
        user_id=user.id,
        challenge_id=challenge.id,
        guessed_bpm=round(guess, 1),
        true_bpm=true_bpm,
        bpm_error=round(bpm_error, 1),
        percent_error=round(percent_error, 2),
        score=score,
        rating=rating,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(attempt)
    db.session.commit()

    return jsonify(
        {
            "true_bpm": true_bpm,
            "guessed_bpm": round(guess, 1),
            "bpm_error": round(bpm_error, 1),
            "percent_error": round(percent_error, 2),
            "rating": rating,
            "score": score,
            "streak": user.current_streak,
            "max_streak": user.max_streak,
        }
    )


@game_bp.route("/api/sync", methods=["POST"])
def sync():
    """Sync client-side local storage attempts to database."""
    from flask import session

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required to sync data."}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json() or {}
    attempts_data = data.get("attempts", [])

    synced_count = 0
    for att_data in attempts_data:
        parsed = validate_and_parse_attempt_data(att_data)
        if not parsed:
            continue

        # Prevent duplicate insertion
        existing = Attempt.query.filter_by(client_uuid=parsed["client_uuid"]).first()
        if existing:
            continue

        attempt = Attempt(
            user_id=user.id,
            challenge_id=None,
            guessed_bpm=parsed["guessed_bpm"],
            true_bpm=parsed["true_bpm"],
            bpm_error=parsed["bpm_error"],
            percent_error=parsed["percent_error"],
            score=parsed["score"],
            rating=parsed["rating"],
            crate_name=parsed["crate_name"],
            client_uuid=parsed["client_uuid"],
            created_at=parsed["created_at"],
        )
        db.session.add(attempt)
        synced_count += 1

    if synced_count > 0:
        db.session.commit()
        recalculate_user_streaks(user)

    return jsonify(
        {
            "success": True,
            "synced_count": synced_count,
            "current_streak": user.current_streak,
            "max_streak": user.max_streak,
        }
    )
