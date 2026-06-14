import json
import random
from datetime import datetime, timezone

from flask import Blueprint, jsonify, render_template, request

from portfolio import db
from portfolio.models import Attempt, Challenge, Crate, ReferenceTrack, User
from portfolio.utils.security import generate_challenge_token, verify_challenge_token

game_bp = Blueprint("game", __name__, url_prefix="/game")


# Module Constants
VALID_ANCHOR_BPMS = [95, 120, 128, 140]


class DummyCrate:
    """Dummy Crate class to mimic Crate model properties in templates."""
    def __init__(self, c_id, name, desc, diff, min_b, max_b, gen, ref_tracks):
        self.id = c_id
        self.name = name
        self.description = desc
        self.difficulty = diff
        self.min_bpm = min_b
        self.max_bpm = max_b
        self.genre = gen
        self.reference_tracks = ref_tracks


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


def get_unlocked_level(user_id, anchor_bpm, preloaded_attempts=None):
    """Determine the highest unlocked progression level (1-4) for a given user and anchor tempo."""
    if preloaded_attempts is not None:
        attempts = preloaded_attempts
    else:
        attempts = (
            Attempt.query.filter_by(user_id=user_id, is_anchor=True, anchor_bpm=anchor_bpm)
            .order_by(Attempt.created_at.desc())
            .all()
        )

    # Calculate ARI over the last 10 attempts
    last_10 = attempts[:10]
    ari = None
    if last_10:
        avg_pct_err = sum(a.percent_error for a in last_10) / len(last_10)
        ari = max(0.0, 100.0 - (avg_pct_err * 10.0))

    # To find streak achievements, scan chronologically (oldest to newest)
    attempts_chrono = list(reversed(attempts))

    l1_streak = 0
    l2_streak = 0
    l3_streak = 0

    has_unlocked_l2 = False
    has_unlocked_l3 = False
    has_unlocked_l4 = False

    for a in attempts_chrono:
        if a.anchor_level == 1:
            if a.percent_error <= 3.0:
                l1_streak += 1
                if l1_streak >= 3:
                    has_unlocked_l2 = True
            else:
                l1_streak = 0
        elif a.anchor_level == 2:
            if a.percent_error <= 3.0:
                l2_streak += 1
                if l2_streak >= 3:
                    has_unlocked_l3 = True
            else:
                l2_streak = 0
        elif a.anchor_level == 3:
            if a.percent_error <= 3.0:
                l3_streak += 1
                if l3_streak >= 5:
                    has_unlocked_l4 = True
            else:
                l3_streak = 0

    # Apply ARI fallback
    if ari is not None and ari >= 85.0:
        has_unlocked_l3 = True
        has_unlocked_l4 = True

    if has_unlocked_l4:
        return 4
    if has_unlocked_l3:
        return 3
    if has_unlocked_l2:
        return 2
    return 1


def calculate_user_stats(user, attempts):
    """Calculate and format statistical performance for a user's attempts."""
    # Filter out None values and anchor attempts for general stats
    non_anchor_attempts = [
        a
        for a in attempts
        if not getattr(a, "is_anchor", False)
        and a.bpm_error is not None
        and a.percent_error is not None
    ]
    total_attempts = len(non_anchor_attempts)
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
            "Metrical Match": 0,
            "Getting There": 0,
            "Needs Practice": 0,
        },
        "avg_stability": None,
        "anchor_stats": {},
    }

    if total_attempts > 0:
        total_error = sum(abs(a.bpm_error) for a in non_anchor_attempts)
        total_pct_error = sum(a.percent_error for a in non_anchor_attempts)
        stats["avg_error"] = round(total_error / total_attempts, 2)
        stats["avg_percent_error"] = round(total_pct_error / total_attempts, 2)

        tapped_stabilities = [
            a.tap_stability
            for a in non_anchor_attempts
            if getattr(a, "tap_stability", None) is not None
        ]
        if tapped_stabilities:
            stats["avg_stability"] = round(sum(tapped_stabilities) / len(tapped_stabilities), 2)

        # Count ratings
        for a in non_anchor_attempts:
            if a.rating in stats["rating_breakdown"]:
                stats["rating_breakdown"][a.rating] += 1

        # Analyze ranges
        ranges = {
            "Slow (60-90 BPM)": [],
            "Mid (90-120 BPM)": [],
            "Dance (120-140 BPM)": [],
            "Fast (140+ BPM)": [],
        }
        for a in non_anchor_attempts:
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

    # Compute anchor stats dynamically in memory to prevent N+4 query storm
    anchor_attempts = [
        a for a in attempts
        if getattr(a, "is_anchor", False)
    ]
    anchor_attempts_desc = sorted(anchor_attempts, key=lambda x: x.created_at, reverse=True)

    for bpm in VALID_ANCHOR_BPMS:
        bpm_attempts_desc = [a for a in anchor_attempts_desc if a.anchor_bpm == bpm]
        last_10 = bpm_attempts_desc[:10]
        ari = None
        if last_10:
            avg_pct_err = sum(a.percent_error for a in last_10) / len(last_10)
            ari = round(max(0.0, 100.0 - (avg_pct_err * 10.0)), 1)

        unlocked_level = get_unlocked_level(user.id, bpm, bpm_attempts_desc)

        # High streak for this anchor
        attempts_anchor = list(reversed(bpm_attempts_desc))
        high_streak = 0
        current_streak = 0
        for a in attempts_anchor:
            if a.percent_error <= 5.0 or a.rating == "Metrical Match":
                current_streak += 1
                if current_streak > high_streak:
                    high_streak = current_streak
            else:
                current_streak = 0

        stats["anchor_stats"][bpm] = {
            "ari": ari if ari is not None else "N/A",
            "unlocked_level": unlocked_level,
            "high_streak": high_streak,
        }

    return stats


def calculate_score_and_rating(guess, true_bpm, clue_level=4):
    """Return (score, rating, is_success, percent_error, bpm_error, metrical_multiplier) for a guess."""
    multipliers = {1: 0.5, 2: 0.6, 3: 0.75, 4: 1.0}
    multiplier = multipliers.get(clue_level, 1.0)

    # Standard metrics
    percent_error = (abs(guess - true_bpm) / true_bpm) * 100
    bpm_error = guess - true_bpm
    metrical_multiplier = 1.0

    # Symmetric metrical deviations relative to target rates
    half_time_err = (abs(guess - (true_bpm / 2.0)) / (true_bpm / 2.0)) * 100
    double_time_err = (abs(guess - (true_bpm * 2.0)) / (true_bpm * 2.0)) * 100

    if percent_error < 1.0:
        base_score, rating, is_success = 100, "Tempo Wizard", True
    elif percent_error <= 3.0:
        base_score, rating, is_success = 75, "DJ-Ready", True
    elif percent_error <= 5.0:
        base_score, rating, is_success = 50, "Solid Ear", True
    elif half_time_err <= 3.0:
        base_score, rating, is_success = 50, "Metrical Match", True
        percent_error = half_time_err
        bpm_error = guess - (true_bpm / 2.0)
        metrical_multiplier = 0.5
    elif double_time_err <= 3.0:
        base_score, rating, is_success = 50, "Metrical Match", True
        percent_error = double_time_err
        bpm_error = guess - (true_bpm * 2.0)
        metrical_multiplier = 2.0
    elif percent_error <= 8.0:
        base_score, rating, is_success = 25, "Getting There", False
    else:
        base_score, rating, is_success = 10, "Needs Practice", False

    return (
        round(base_score * multiplier),
        rating,
        is_success,
        round(percent_error, 2),
        round(bpm_error, 1),
        metrical_multiplier,
    )


def validate_and_parse_attempt_data(att_data):
    """Validate and parse a single raw attempt data dict, returning parsed fields or None."""
    client_uuid = att_data.get("client_uuid")
    if not client_uuid:
        return None

    try:
        guessed = float(att_data.get("guessed_bpm"))
        true_bpm = float(att_data.get("true_bpm"))
        crate_name = str(att_data.get("crate_name", "Unknown Crate"))

        # Parse anchor fields
        is_anchor = bool(att_data.get("is_anchor", False))
        anchor_bpm = att_data.get("anchor_bpm")
        if anchor_bpm is not None:
            anchor_bpm = int(float(anchor_bpm))
            if anchor_bpm not in VALID_ANCHOR_BPMS:
                return None
        anchor_level = att_data.get("anchor_level")
        if anchor_level is not None:
            anchor_level = int(anchor_level)
            if anchor_level not in [1, 2, 3, 4]:
                return None

        # Support upper bound up to 400.0 BPM (e.g. Drum & Bass double-tempo)
        if not (1.0 <= guessed <= 400.0) or not (1.0 <= true_bpm <= 400.0):
            return None

        # Parse tap_stability securely for guests
        tap_stability = None
        tap_stability_val = att_data.get("tap_stability")
        if tap_stability_val is not None:
            import math

            val = float(tap_stability_val)
            if math.isnan(val) or math.isinf(val) or not (0.0 <= val <= 5000.0):
                return None
            tap_stability = round(val, 2)

        # Parse clue_level (so we can calculate the score accurately)
        clue_level = att_data.get("clue_level")
        if clue_level is not None:
            clue_level = int(clue_level)
            if clue_level not in [1, 2, 3, 4]:
                return None
        else:
            clue_level = 4
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
        "crate_name": crate_name,
        "tap_stability": tap_stability,
        "is_anchor": is_anchor,
        "anchor_bpm": anchor_bpm,
        "anchor_level": anchor_level,
        "clue_level": clue_level,
        "created_at": created_at_dt,
    }


def recalculate_user_streaks(user):
    """Recalculate and persist chronological streaks for a user. Callers must commit transaction."""
    # Bounded query to avoid full-table scan on huge histories.
    recent_attempts = Attempt.query.filter_by(user_id=user.id)\
        .order_by(Attempt.created_at.desc())\
        .limit(500)\
        .all()

    current_streak = 0
    for a in recent_attempts:
        if a.percent_error <= 5.0 or a.rating == "Metrical Match":
            current_streak += 1
        else:
            break

    max_streak = user.max_streak
    temp_streak = 0
    for a in reversed(recent_attempts):
        if a.percent_error <= 5.0 or a.rating == "Metrical Match":
            temp_streak += 1
            if temp_streak > max_streak:
                max_streak = temp_streak
        else:
            temp_streak = 0

    user.current_streak = current_streak
    user.max_streak = max_streak


@game_bp.route("/play/anchor/<int:anchor_bpm>")
def play_anchor(anchor_bpm):
    if anchor_bpm not in VALID_ANCHOR_BPMS:
        from flask import abort

        abort(400, "Unsupported anchor tempo.")

    level_val = request.args.get("level", 1)
    try:
        level = int(level_val)
        if level not in [1, 2, 3, 4]:
            level = 1
    except ValueError:
        level = 1

    from flask import session

    user_id = session.get("user_id")
    user = db.session.get(User, user_id) if user_id else None

    # Check unlocked level
    if user:
        unlocked = get_unlocked_level(user.id, anchor_bpm)
        if level > unlocked:
            level = unlocked
    else:
        # Guests can access up to level 2
        if level > 2:
            level = 2

    percent_limits = {1: 5.0, 2: 10.0, 3: 15.0, 4: 15.0}
    limit = percent_limits.get(level, 5.0)

    if level == 4:
        base_target = round(random.uniform(anchor_bpm * 0.85, anchor_bpm * 1.15), 1)
        r = random.random()
        if r < 0.25:
            true_bpm = round(base_target / 2.0, 1)
        elif r < 0.50:
            true_bpm = round(base_target * 2.0, 1)
        else:
            true_bpm = base_target
    else:
        delta = anchor_bpm * (limit / 100.0)
        true_bpm = round(random.uniform(anchor_bpm - delta, anchor_bpm + delta), 1)

    genre_map = {95: "hip-hop", 120: "dance-pop", 128: "dance-pop", 140: "trap"}
    genre = genre_map.get(anchor_bpm, "beginner")

    # Select random active track matching anchor BPM
    ref_tracks_anchor = ReferenceTrack.query.filter_by(bpm=anchor_bpm).all()
    active_track = random.choice(ref_tracks_anchor) if ref_tracks_anchor else None

    # Query all reference tracks of the corresponding crate to show in the drawer
    actual_crate = Crate.query.filter_by(genre=genre).first()
    ref_tracks = actual_crate.reference_tracks if actual_crate else []

    crate_name = f"Anchor {anchor_bpm} BPM"
    challenge_token = generate_challenge_token(
        true_bpm=true_bpm,
        crate_name=crate_name,
        is_anchor=True,
        anchor_bpm=anchor_bpm,
        anchor_level=level,
    )

    recipe = {
        "genre": genre,
        "bpm": true_bpm,
        "elements": ["kick", "snare", "hihat"],
    }
    if genre == "house" or genre == "dance-pop":
        recipe["elements"] = ["kick", "snare", "hihat", "bass"]
    elif genre == "trap":
        recipe["elements"] = ["kick", "snare", "hihat_roll", "clap"]
        recipe["half_time"] = True
    elif genre == "pop-punk":
        recipe["elements"] = ["kick", "snare", "hihat", "bass"]

    if active_track:
        recipe["originalBpm"] = active_track.bpm

    crate_obj = DummyCrate(
        0,
        crate_name,
        f"Anchor Tempo Training for {anchor_bpm} BPM. Level {level}.",
        "Easy" if level == 1 else ("Medium" if level == 2 else "Hard"),
        int(anchor_bpm * (1.0 - limit / 100.0)),
        int(anchor_bpm * (1.0 + limit / 100.0)),
        genre,
        ref_tracks,
    )

    return render_template(
        "game/play.html",
        recipe_json=json.dumps(recipe),
        crate=crate_obj,
        challenge_token=challenge_token,
        is_anchor=True,
        anchor_bpm=anchor_bpm,
        anchor_level=level,
        active_track=active_track,
    )


@game_bp.route("/dashboard")
def dashboard():
    from flask import session

    user_id = session.get("user_id")
    user = db.session.get(User, user_id) if user_id else None

    stats = None
    if user:
        attempts = Attempt.query.filter_by(user_id=user.id).all()
        stats = calculate_user_stats(user, attempts)

    crates = Crate.query.all()
    return render_template("game/dashboard.html", crates=crates, stats=stats)


@game_bp.route("/play/<int:crate_id>")
def play(crate_id):
    crate = db.session.get(Crate, crate_id)
    if not crate:
        from flask import abort

        abort(404)

    ref_tracks = crate.reference_tracks
    active_track = random.choice(ref_tracks) if ref_tracks else None

    # Generate random true BPM close to selected track's original BPM
    if active_track:
        min_b = max(crate.min_bpm, active_track.bpm * 0.94)
        max_b = min(crate.max_bpm, active_track.bpm * 1.06)
        if min_b > max_b:
            min_b = crate.min_bpm
            max_b = crate.max_bpm
        true_bpm = round(random.uniform(min_b, max_b), 1)
    else:
        true_bpm = round(random.uniform(crate.min_bpm, crate.max_bpm), 1)

    # Generate a timed, cryptographically signed play token
    challenge_token = generate_challenge_token(true_bpm, crate.name)

    # Generate a simple beat recipe JSON depending on genre
    recipe = {
        "genre": crate.genre,
        "bpm": true_bpm,
        "elements": ["kick", "snare", "hihat"],
    }
    if crate.genre == "house" or crate.genre == "dance-pop":
        recipe["elements"] = ["kick", "snare", "hihat", "bass"]
    elif crate.genre == "trap":
        recipe["elements"] = ["kick", "snare", "hihat_roll", "clap"]
        recipe["half_time"] = True
    elif crate.genre == "pop-punk":
        recipe["elements"] = ["kick", "snare", "hihat", "bass"]

    if active_track:
        recipe["originalBpm"] = active_track.bpm

    return render_template(
        "game/play.html",
        recipe_json=json.dumps(recipe),
        crate=crate,
        challenge_token=challenge_token,
        active_track=active_track,
    )


@game_bp.route("/submit", methods=["POST"])
def submit():
    """Legacy submission route used by automated test suites."""
    from flask import current_app, abort
    if not current_app.config.get("TESTING"):
        abort(404)

    data = request.get_json() or {}
    challenge_id = data.get("challenge_id")
    guess_val = data.get("guess")

    if not challenge_id or guess_val is None:
        return jsonify({"error": "Invalid request parameters"}), 400

    try:
        guess = float(guess_val)
    except ValueError:
        return jsonify({"error": "Guess must be a valid number"}), 400

    challenge = db.session.get(Challenge, challenge_id)
    if not challenge:
        return jsonify({"error": "Challenge not found"}), 404

    true_bpm = challenge.true_bpm

    # Score & Rating calculation (Legacy path)
    score, rating, is_success, percent_error, bpm_error, metrical_multiplier = (
        calculate_score_and_rating(guess, true_bpm)
    )

    # Get user
    from flask import session

    user_id = session.get("user_id")
    user = db.session.get(User, user_id) if user_id else None
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
        bpm_error=bpm_error,
        percent_error=percent_error,
        score=score,
        rating=rating,
        metrical_multiplier=metrical_multiplier,
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


@game_bp.route("/api/attempt", methods=["POST"])
def submit_attempt():
    """Submit a gameplay attempt directly to SQLite database for signed-in users."""
    from flask import session

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json() or {}
    guess_val = data.get("guess")
    challenge_token = data.get("challenge_token")
    clue_level_val = data.get("clue_level", 4)
    client_uuid = data.get("client_uuid")

    if not client_uuid:
        return jsonify({"error": "Missing client UUID."}), 400

    if guess_val is None or not challenge_token:
        return jsonify({"error": "Missing guess or challenge token."}), 400

    try:
        guess = float(guess_val)
        clue_level = int(clue_level_val)
        # Support bounds up to 400.0 BPM
        if not (1.0 <= guess <= 400.0) or clue_level not in [1, 2, 3, 4]:
            return jsonify({"error": "Invalid guess or clue level bounds."}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid data format."}), 400

    # Validate tap_stability (direct submits)
    tap_stability = None
    tap_stability_val = data.get("tap_stability")
    if tap_stability_val is not None:
        try:
            import math

            val = float(tap_stability_val)
            if math.isnan(val) or math.isinf(val) or not (0.0 <= val <= 5000.0):
                return jsonify({"error": "Invalid tap stability value."}), 400
            tap_stability = round(val, 2)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid tap stability format."}), 400

    # Cryptographically verify the play token
    challenge_data = verify_challenge_token(challenge_token)
    if not challenge_data:
        return jsonify({"error": "Invalid or expired challenge token."}), 400

    is_anchor = challenge_data.get("is_anchor", False)
    anchor_bpm = challenge_data.get("anchor_bpm")
    anchor_level = challenge_data.get("anchor_level")
    timestamp = challenge_data.get("timestamp")

    if is_anchor:
        import time

        if timestamp and (time.time() - timestamp > 120.0):
            return jsonify({"error": "Anchor challenge token expired."}), 400

    true_bpm = challenge_data["true_bpm"]
    crate_name = challenge_data["crate_name"]

    # Check for duplicate client UUID to prevent double submissions
    existing = Attempt.query.filter_by(client_uuid=client_uuid).first()
    if existing:
        return jsonify({"error": "Attempt already recorded."}), 409

    # Calculate metrics (API path)
    score, rating, is_success, percent_error, bpm_error, metrical_multiplier = (
        calculate_score_and_rating(guess, true_bpm, clue_level)
    )

    # Update user streak
    if is_success:
        user.current_streak += 1
        if user.current_streak > user.max_streak:
            user.max_streak = user.current_streak
    else:
        user.current_streak = 0

    try:
        attempt = Attempt(
            user_id=user.id,
            challenge_id=None,
            guessed_bpm=round(guess, 1),
            true_bpm=true_bpm,
            bpm_error=bpm_error,
            percent_error=percent_error,
            score=score,
            rating=rating,
            crate_name=crate_name,
            client_uuid=client_uuid,
            metrical_multiplier=metrical_multiplier,
            tap_stability=tap_stability,
            is_anchor=is_anchor,
            anchor_bpm=anchor_bpm,
            anchor_level=anchor_level,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(attempt)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Internal database transaction failure."}), 500

    return jsonify(
        {
            "true_bpm": true_bpm,
            "guessed_bpm": round(guess, 1),
            "bpm_error": bpm_error,
            "percent_error": percent_error,
            "rating": rating,
            "score": score,
            "streak": user.current_streak,
            "max_streak": user.max_streak,
        }
    ), 201


@game_bp.route("/api/sync", methods=["POST"])
def sync():
    """Sync client-side local storage attempts to database."""
    from flask import session

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required to sync data."}), 401

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json() or {}
    attempts_data = data.get("attempts", [])
    if not isinstance(attempts_data, list):
        return jsonify({"error": "Invalid attempts data format."}), 400

    synced_count = 0
    for att_data in attempts_data:
        if not isinstance(att_data, dict):
            continue

        parsed = validate_and_parse_attempt_data(att_data)
        if not parsed:
            continue

        # Prevent duplicate insertion
        existing = Attempt.query.filter_by(client_uuid=parsed["client_uuid"]).first()
        if existing:
            continue

        # Securely recalculate score and rating on the server side
        score, rating, is_success, percent_error, bpm_error, metrical_multiplier = (
            calculate_score_and_rating(parsed["guessed_bpm"], parsed["true_bpm"], parsed.get("clue_level", 4))
        )

        # Use nested transaction to save each attempt atomically
        try:
            with db.session.begin_nested():
                attempt = Attempt(
                    user_id=user.id,
                    challenge_id=None,
                    guessed_bpm=parsed["guessed_bpm"],
                    true_bpm=parsed["true_bpm"],
                    bpm_error=bpm_error,
                    percent_error=percent_error,
                    score=score,
                    rating=rating,
                    crate_name=parsed["crate_name"],
                    client_uuid=parsed["client_uuid"],
                    metrical_multiplier=metrical_multiplier,
                    tap_stability=parsed["tap_stability"],
                    is_anchor=parsed["is_anchor"],
                    anchor_bpm=parsed["anchor_bpm"],
                    anchor_level=parsed["anchor_level"],
                    created_at=parsed["created_at"],
                )
                db.session.add(attempt)
        except Exception:
            continue
        else:
            synced_count += 1

    if synced_count > 0:
        recalculate_user_streaks(user)
        db.session.commit()

    return jsonify(
        {
            "success": True,
            "synced_count": synced_count,
            "current_streak": user.current_streak,
            "max_streak": user.max_streak,
        }
    )
