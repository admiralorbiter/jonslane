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


@game_bp.route("/dashboard")
def dashboard():
    crates = Crate.query.all()
    return render_template("game/dashboard.html", crates=crates)


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
    if percent_error < 1.0:
        rating = "Tempo Wizard"
        score = 100
        is_success = True
    elif percent_error <= 3.0:
        rating = "DJ-Ready"
        score = 75
        is_success = True
    elif percent_error <= 5.0:
        rating = "Solid Ear"
        score = 50
        is_success = True
    elif percent_error <= 8.0:
        rating = "Getting There"
        score = 25
        is_success = False
    else:
        rating = "Needs Practice"
        score = 10
        is_success = False

    # Get user
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
    data = request.get_json() or {}
    attempts_data = data.get("attempts", [])

    user = User.query.first()
    if not user:
        user = User(display_name="Guest DJ")
        db.session.add(user)
        db.session.commit()

    synced_count = 0
    for att_data in attempts_data:
        client_uuid = att_data.get("client_uuid")
        if not client_uuid:
            continue

        # Prevent duplicate insertion
        existing = Attempt.query.filter_by(client_uuid=client_uuid).first()
        if existing:
            continue

        try:
            created_at_dt = datetime.fromisoformat(
                att_data.get("created_at").replace("Z", "+00:00")
            )
        except (ValueError, TypeError, AttributeError):
            created_at_dt = datetime.now(timezone.utc)

        attempt = Attempt(
            user_id=user.id,
            challenge_id=None,  # guest play does not require challenges in DB
            guessed_bpm=float(att_data.get("guessed_bpm")),
            true_bpm=float(att_data.get("true_bpm")),
            bpm_error=float(att_data.get("bpm_error")),
            percent_error=float(att_data.get("percent_error")),
            score=int(att_data.get("score")),
            rating=att_data.get("rating"),
            crate_name=att_data.get("crate_name"),
            client_uuid=client_uuid,
            created_at=created_at_dt,
        )
        db.session.add(attempt)
        synced_count += 1

    if synced_count > 0:
        db.session.commit()

        # Recalculate streak chronologically to keep database integrity
        all_attempts = (
            Attempt.query.filter_by(user_id=user.id).order_by(Attempt.created_at.asc()).all()
        )
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

    return jsonify(
        {
            "success": True,
            "synced_count": synced_count,
            "current_streak": user.current_streak,
            "max_streak": user.max_streak,
        }
    )
