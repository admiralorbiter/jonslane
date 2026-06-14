import math

from portfolio.models import Attempt, db

VALID_ANCHOR_BPMS = [95, 120, 128, 140]


def clamp(val, minimum, maximum):
    return max(minimum, min(val, maximum))


def get_skill_stats(user_id, skill_tag):
    """
    Query the last 50 attempts for a user and skill tag.
    Returns a dict with aggregated avg_error, sd_stability, and count.
    """
    rows = (
        db.session.query(Attempt.percent_error, Attempt.tap_stability, Attempt.phase_error_ms)
        .filter(Attempt.user_id == user_id, Attempt.skill_tag == skill_tag)
        .order_by(Attempt.created_at.desc())
        .limit(50)
        .all()
    )

    count = len(rows)
    if count == 0:
        return {
            "avg_percent_error": None,
            "avg_stability": None,
            "sd_stability": None,
            "avg_phase_error": None,
            "count": 0,
        }

    sum_pct = 0.0
    sum_stability = 0.0
    stability_vals = []
    sum_phase_error = 0.0
    phase_error_count = 0

    for pct, stability, phase_err in rows:
        if pct is not None:
            sum_pct += pct
        if stability is not None:
            sum_stability += stability
            stability_vals.append(stability)
        if phase_err is not None:
            sum_phase_error += abs(phase_err)
            phase_error_count += 1

    avg_pct = sum_pct / count if count > 0 else None
    avg_stability = sum_stability / len(stability_vals) if stability_vals else None
    avg_phase = sum_phase_error / phase_error_count if phase_error_count > 0 else None

    # Calculate Sample Standard Deviation (Bessel's correction: N-1)
    sd_stability = None
    if len(stability_vals) > 1:
        mean = avg_stability
        variance = sum((x - mean) ** 2 for x in stability_vals) / (len(stability_vals) - 1)
        sd_stability = math.sqrt(variance)
    elif len(stability_vals) == 1:
        sd_stability = 0.0

    return {
        "avg_percent_error": avg_pct,
        "avg_stability": avg_stability,
        "sd_stability": sd_stability,
        "avg_phase_error": avg_phase,
        "count": count,
    }


def calculate_skills_mastery(user_id):
    """
    Calculate 5 core skill mastery scores (0-100) on-demand using rolling-window queries.
    """
    # 1. Pulse Entrainment (skill_tag = 'find_pulse')
    pulse = get_skill_stats(user_id, "find_pulse")
    pulse_sd = pulse["sd_stability"] or pulse["avg_stability"]  # fallback if only 1 attempt
    if pulse_sd is None:
        pulse_score = 0.0
    else:
        if pulse_sd <= 30.0:
            pulse_score = 100.0
        elif pulse_sd <= 50.0:
            pulse_score = 100.0 - (pulse_sd - 30.0) * 1.0  # 100 to 80
        else:
            pulse_score = clamp(80.0 - (pulse_sd - 50.0) * 0.53, 0.0, 80.0)

    # 2. Downbeat Alignment (skill_tag = 'meter_downbeat')
    downbeat = get_skill_stats(user_id, "meter_downbeat")
    phase_err = downbeat["avg_phase_error"]
    if phase_err is None:
        downbeat_score = 0.0
    else:
        if phase_err <= 10.0:
            downbeat_score = 100.0
        elif phase_err <= 40.0:
            downbeat_score = 100.0 - (phase_err - 10.0) * 0.67  # 100 to 80
        else:
            downbeat_score = clamp(80.0 - (phase_err - 40.0) * 0.5, 0.0, 80.0)

    # 3. Subdivision Stability (skill_tag = 'subdivision')
    subdiv = get_skill_stats(user_id, "subdivision")
    subdiv_sd = subdiv["sd_stability"] or subdiv["avg_stability"]
    if subdiv_sd is None:
        subdiv_score = 0.0
    else:
        if subdiv_sd <= 25.0:
            subdiv_score = 100.0
        elif subdiv_sd <= 45.0:
            subdiv_score = 100.0 - (subdiv_sd - 25.0) * 1.0  # 100 to 80
        else:
            subdiv_score = clamp(80.0 - (subdiv_sd - 45.0) * 0.8, 0.0, 80.0)

    # 4. Metrical Ambiguity (skill_tag = 'metrical_ambiguity')
    metrical = get_skill_stats(user_id, "metrical_ambiguity")
    pct_err = metrical["avg_percent_error"]
    if pct_err is None:
        metrical_score = 0.0
    else:
        if pct_err <= 0.5:
            metrical_score = 100.0
        elif pct_err <= 3.0:
            metrical_score = 100.0 - (pct_err - 0.5) * 8.0  # 100 to 80
        else:
            metrical_score = clamp(80.0 - (pct_err - 3.0) * 10.0, 0.0, 80.0)

    # 5. Absolute Tempo Memory (is_anchor = True attempts)
    # Get last 10 attempts for each anchor
    anchor_scores = []
    for bpm in VALID_ANCHOR_BPMS:
        last_10 = (
            Attempt.query.filter_by(user_id=user_id, is_anchor=True, anchor_bpm=bpm)
            .order_by(Attempt.created_at.desc())
            .limit(10)
            .all()
        )
        if last_10:
            avg_pct = sum(a.percent_error for a in last_10) / len(last_10)
            ari = max(0.0, 100.0 - (avg_pct * 10.0))
            anchor_scores.append(ari)

    if anchor_scores:
        tempo_score = sum(anchor_scores) / len(anchor_scores)
    else:
        tempo_score = 0.0

    return {
        "pulse_entrainment": round(pulse_score, 1),
        "downbeat_alignment": round(downbeat_score, 1),
        "subdivision_stability": round(subdiv_score, 1),
        "metrical_ambiguity": round(metrical_score, 1),
        "absolute_tempo_memory": round(tempo_score, 1),
    }


def check_level_mastery(
    user_id, skill_tag, threshold, metric_name, min_attempts=5, percent_required=0.8
):
    """
    Check if the user has mastered a specific level by evaluating a rolling window.
    Requires that at least percent_required (e.g. 80%) of the last min_attempts
    satisfy the threshold, and that they span at least 2 distinct days.
    """
    attempts = (
        Attempt.query.filter_by(user_id=user_id, skill_tag=skill_tag)
        .order_by(Attempt.created_at.desc())
        .limit(min_attempts)
        .all()
    )

    if len(attempts) < min_attempts:
        return False

    qualifying_count = 0
    days = set()

    for a in attempts:
        val = getattr(a, metric_name, None)
        if val is not None:
            # For phase_error, check absolute error
            if metric_name == "phase_error_ms":
                val = abs(val)

            if val <= threshold:
                qualifying_count += 1
                if a.created_at:
                    days.add(a.created_at.date())

    has_enough_qualifying = (qualifying_count / len(attempts)) >= percent_required
    has_enough_sessions = len(days) >= 2

    return has_enough_qualifying and has_enough_sessions


def get_user_level_progression(user_id):
    """
    Evaluate lock status for all 8 levels.
    Returns a dict mapping level number to status: 'locked', 'unlocked', 'mastered'
    """
    progression = {
        0: "unlocked",  # Level 0 is always unlocked
        1: "locked",
        2: "locked",
        3: "locked",
        4: "locked",
        5: "locked",
        6: "locked",
        7: "locked",
    }

    # Evaluate mastery for Level 0
    l0_mastered = check_level_mastery(
        user_id=user_id,
        skill_tag="find_pulse",
        threshold=50.0,
        metric_name="tap_stability",
        min_attempts=5,
    )
    if l0_mastered:
        progression[0] = "mastered"
        progression[1] = "unlocked"

    # Evaluate mastery for Level 1 (Meter & Downbeat)
    l1_mastered = check_level_mastery(
        user_id=user_id,
        skill_tag="meter_downbeat",
        threshold=60.0,
        metric_name="phase_error_ms",
        min_attempts=5,
    )
    if l0_mastered and l1_mastered:
        progression[1] = "mastered"
        progression[2] = "unlocked"
        progression[3] = "unlocked"

    # Evaluate Level 2 (Subdivisions) and Level 3 (Metrical Ambiguity) in parallel
    l2_mastered = check_level_mastery(
        user_id=user_id,
        skill_tag="subdivision",
        threshold=45.0,
        metric_name="tap_stability",
        min_attempts=5,
    )
    l3_mastered = check_level_mastery(
        user_id=user_id,
        skill_tag="metrical_ambiguity",
        threshold=3.0,
        metric_name="percent_error",
        min_attempts=5,
    )

    if l2_mastered:
        progression[2] = "mastered"
    if l3_mastered:
        progression[3] = "mastered"

    # Level 4 (Tempo Anchors / Absolute Tempo Memory) unlocks if BOTH levels 2 and 3 are mastered
    if l2_mastered and l3_mastered:
        progression[4] = "unlocked"

        # Check Level 4 mastery: Average Anchor ARI >= 85.0
        # Check that they have at least 10 anchor attempts overall
        anchor_attempts = Attempt.query.filter_by(user_id=user_id, is_anchor=True).all()
        if len(anchor_attempts) >= 10:
            skills = calculate_skills_mastery(user_id)
            if skills["absolute_tempo_memory"] >= 85.0:
                progression[4] = "mastered"
                progression[5] = "unlocked"

    # Evaluate Level 5 (Groove & Syncopation)
    l5_mastered = check_level_mastery(
        user_id=user_id,
        skill_tag="groove",
        threshold=40.0,
        metric_name="tap_stability",
        min_attempts=5,
    )
    if progression[5] == "unlocked" and l5_mastered:
        progression[5] = "mastered"
        progression[6] = "unlocked"

    # Evaluate Level 6 (Phrasing)
    l6_mastered = check_level_mastery(
        user_id=user_id,
        skill_tag="phrasing",
        threshold=75.0,
        metric_name="phase_error_ms",
        min_attempts=5,
    )
    if progression[6] == "unlocked" and l6_mastered:
        progression[6] = "mastered"
        progression[7] = "unlocked"

    # Evaluate Level 7 (Beatmatch & Drift)
    l7_mastered = check_level_mastery(
        user_id=user_id,
        skill_tag="beatmatch",
        threshold=40.0,
        metric_name="phase_error_ms",
        min_attempts=5,
    )
    if progression[7] == "unlocked" and l7_mastered:
        progression[7] = "mastered"

    return progression


def get_user_academy_stats(user_id):
    """
    Return a unified stats dict containing level statuses, skill mastery ratings,
    and a summary of total reviews completed.
    """
    skills = calculate_skills_mastery(user_id)
    progression = get_user_level_progression(user_id)

    return {"skills": skills, "progression": progression}
