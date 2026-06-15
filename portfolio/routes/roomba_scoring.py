"""DJ Roomba scoring engine.

Provides functions to compute tempo compatibility, harmonic compatibility,
energy compatibility, risk penalties, style presets, and bucket candidates.
"""

import math

PRESETS = {
    "Beatmatcher": {"tempo": 0.45, "harmonic": 0.35, "energy": 0.20},
    "Harmonic Mixer": {"tempo": 0.25, "harmonic": 0.55, "energy": 0.20},
    "Open Format": {"tempo": 0.35, "harmonic": 0.25, "energy": 0.40},
}


def score_tempo(bpm_a: float, bpm_b: float) -> tuple[float, str]:
    """Score tempo compatibility between track A and track B.
    
    Returns a tuple (score, label).
    """
    if not bpm_a or not bpm_b:
        return 10.0, "Reject"

    # Normal difference
    diff_pct = (abs(bpm_b - bpm_a) / bpm_a) * 100.0
    if diff_pct <= 1.0:
        score_normal = 100.0
        label_normal = "Locked"
    elif diff_pct <= 3.0:
        score_normal = 85.0
        label_normal = "DJ-Ready"
    elif diff_pct <= 5.0:
        score_normal = 65.0
        label_normal = "Workable"
    elif diff_pct <= 8.0:
        score_normal = 40.0
        label_normal = "Risky"
    else:
        score_normal = 10.0
        label_normal = "Reject"

    # Half-time match
    diff_half = (abs(bpm_b - 0.5 * bpm_a) / (0.5 * bpm_a)) * 100.0
    if diff_half <= 2.0:
        score_half = 90.0
        label_half = "Metrical — Tight"
    elif diff_half <= 5.0:
        score_half = 75.0
        label_half = "Metrical — Match"
    else:
        score_half = 0.0
        label_half = "Reject"

    # Double-time match
    diff_double = (abs(bpm_b - 2.0 * bpm_a) / (2.0 * bpm_a)) * 100.0
    if diff_double <= 2.0:
        score_double = 90.0
        label_double = "Metrical — Tight"
    elif diff_double <= 5.0:
        score_double = 75.0
        label_double = "Metrical — Match"
    else:
        score_double = 0.0
        label_double = "Reject"

    best_score = max(score_normal, score_half, score_double)
    if best_score == score_normal:
        return best_score, label_normal
    elif best_score == score_half:
        return best_score, label_half
    else:
        return best_score, label_double


def score_harmonic(camelot_a: str, camelot_b: str) -> tuple[float, str]:
    """Score harmonic compatibility between track A and track B.
    
    Returns a tuple (score, label/relationship).
    """
    if not camelot_a or not camelot_b:
        return 50.0, "Unknown (neutral)"

    try:
        num_a = int(camelot_a[:-1])
        mode_a = camelot_a[-1]
        num_b = int(camelot_b[:-1])
        mode_b = camelot_b[-1]
    except Exception:
        return 50.0, "Unknown (neutral)"

    diff_num = (num_b - num_a) % 12
    same_mode = (mode_a == mode_b)

    if diff_num == 0 and same_mode:
        return 100.0, "Same Key"
    elif diff_num == 0 and not same_mode:
        return 90.0, "Relative"
    elif (diff_num in (1, 11)) and same_mode:
        return 75.0, "Circle of 5ths"
    elif (diff_num in (1, 11)) and not same_mode:
        return 65.0, "Mediant"
    elif (diff_num in (3, 9)) and not same_mode:
        return 60.0, "Parallel Mode"
    elif (diff_num in (2, 10)) and same_mode:
        return 55.0, "Whole Tone"
    elif diff_num == 7 and same_mode:
        # Energy Boost move is specifically +7 steps (going up 7 positions on the wheel)
        return 40.0, "Tension Jump"
    elif diff_num == 6 and same_mode:
        return 25.0, "Tritone"
    elif diff_num == 5 and same_mode:
        # Semitone clash is -7 steps on wheel (which is +5 mod 12)
        return 15.0, "Semitone Clash"
    else:
        return 20.0, "Clash"


def score_energy(energy_a: float | None, energy_b: float | None) -> tuple[float, str, str]:
    """Score energy compatibility.
    
    Returns a tuple (score, direction_label, intent_label)
    """
    if energy_a is None or energy_b is None:
        return 70.0, "unknown", "Groove"

    diff = energy_b - energy_a
    if abs(diff) <= 10.0:
        return 85.0, "same", "Groove"
    elif 10.0 < diff <= 40.0:
        return 80.0, "build", "Build"
    elif -40.0 <= diff < -10.0:
        return 70.0, "reset", "Reset"
    elif diff > 40.0:
        return 60.0, "peak", "Peak (risky)"
    else:  # diff < -40.0
        return 35.0, "crash", "Crash"


def apply_risk_penalties(
    tempo_s: float,
    harmonic_s: float,
    energy_s: float,
    track_a_info: dict,
    track_b_info: dict,
) -> tuple[float, list[dict]]:
    """Apply risk penalties based on combinations of compatibility scores.
    
    Returns a tuple (penalty_deduction, list_of_risk_flags).
    """
    penalty = 0.0
    flags = []

    # Penalty 1: Two bad dimensions simultaneously
    if tempo_s < 40.0 and energy_s < 40.0:
        penalty += 10.0
        flags.append({
            "type": "two_bad_dimensions",
            "severity": 1.0,
            "label": "Tempo and energy dimensions both have poor compatibility."
        })

    # Penalty 2: Harmonic + tempo conflict
    if harmonic_s > 80.0 and tempo_s < 50.0:
        penalty += 8.0
        flags.append({
            "type": "harmonic_tempo_conflict",
            "severity": 0.8,
            "label": "Harmonically compatible but tempo difference is too wide; the clash will be highly audible."
        })

    # Penalty 3: Both tracks have unknown key
    if track_a_info.get("camelot_key") is None and track_b_info.get("camelot_key") is None:
        penalty += 5.0
        flags.append({
            "type": "both_keys_unknown",
            "severity": 0.5,
            "label": "Both tracks are missing key analysis."
        })

    # Penalty 4: BPM unknown on either track
    if (
        track_a_info.get("bpm_confidence") == "unknown"
        or track_b_info.get("bpm_confidence") == "unknown"
    ):
        penalty += 15.0
        flags.append({
            "type": "bpm_unknown",
            "severity": 0.9,
            "label": "BPM value is unknown for at least one track."
        })

    return penalty, flags


def score_transition(
    track_a: dict, track_b: dict, preset_name: str = "Beatmatcher"
) -> dict:
    """Score transition compatibility from track A to track B.
    
    Returns a dict with overall and component scores, flags, and explanation.
    """
    preset = PRESETS.get(preset_name, PRESETS["Beatmatcher"])
    
    tempo_s, tempo_lbl = score_tempo(track_a.get("bpm"), track_b.get("bpm"))
    harmonic_s, harmonic_lbl = score_harmonic(track_a.get("camelot_key"), track_b.get("camelot_key"))
    energy_s, energy_dir, energy_intent = score_energy(track_a.get("energy"), track_b.get("energy"))
    
    # Calculate base weighted score
    weighted_score = (
        preset["tempo"] * tempo_s +
        preset["harmonic"] * harmonic_s +
        preset["energy"] * energy_s
    )
    
    # Apply risk penalties
    penalty, flags = apply_risk_penalties(tempo_s, harmonic_s, energy_s, track_a, track_b)
    total_score = max(0.0, min(100.0, weighted_score - penalty))
    
    # Generate human explanations
    explanation = generate_explanation(
        {
            "total_score": total_score,
            "tempo_score": tempo_s,
            "tempo_label": tempo_lbl,
            "harmonic_score": harmonic_s,
            "harmonic_label": harmonic_lbl,
            "energy_score": energy_s,
            "energy_direction": energy_dir,
            "energy_intent": energy_intent,
        },
        track_a,
        track_b
    )
    
    return {
        "total_score": round(total_score, 1),
        "tempo_score": round(tempo_s, 1),
        "tempo_label": tempo_lbl,
        "harmonic_score": round(harmonic_s, 1),
        "harmonic_label": harmonic_lbl,
        "energy_score": round(energy_s, 1),
        "energy_direction": energy_dir,
        "energy_intent": energy_intent,
        "risk_flags": flags,
        "explanation": explanation
    }


def generate_explanation(scores: dict, track_a: dict, track_b: dict) -> dict:
    """Generate rule-based plain-English explanation for the transition."""
    why = ""
    watch_out = []
    try_this = ""
    
    # Harmonic explanation
    key_a = track_a.get("camelot_key") or "unknown"
    key_b = track_b.get("camelot_key") or "unknown"
    harmonic_lbl = scores["harmonic_label"]
    
    if harmonic_lbl == "Same Key":
        why += f"Both tracks are in the exact same key ({key_a}), creating a seamless harmonic blend."
    elif harmonic_lbl == "Relative":
        why += f"Key relationship is relative major/minor ({key_a} → {key_b}), which blends seamlessly."
    elif harmonic_lbl == "Circle of 5ths":
        why += f"An adjacent key change on the circle of fifths ({key_a} → {key_b}) allows a smooth energy glide."
    elif harmonic_lbl == "Mediant":
        why += f"A diagonal mediant shift ({key_a} → {key_b}) adds subtle color to the blend."
    elif harmonic_lbl == "Parallel Mode":
        why += f"A parallel major/minor mode shift ({key_a} → {key_b}) offers a dramatic mood shift."
    elif harmonic_lbl == "Whole Tone":
        why += f"A whole tone shift ({key_a} → {key_b}) lifts the energy and sounds highly musical."
    elif harmonic_lbl == "Tension Jump":
        why += f"An energy boost jump ({key_a} → {key_b}) lifts energy and builds tension."
    elif harmonic_lbl == "Tritone":
        why += f"A tritone move ({key_a} → {key_b}) creates an unsettling, edgy transition."
    elif harmonic_lbl == "Semitone Clash":
        why += f"A semitone shift ({key_a} → {key_b}) is a tight, tense transition."
    else:
        why += f"Transitions from {key_a} to {key_b}."

    # Tempo explanation
    bpm_a = track_a.get("bpm") or 0.0
    bpm_b = track_b.get("bpm") or 0.0
    tempo_lbl = scores["tempo_label"]
    
    if tempo_lbl == "Locked":
        why += f" Tempos are practically matched ({bpm_a:.1f} vs {bpm_b:.1f} BPM)."
    elif tempo_lbl == "DJ-Ready":
        why += f" Tempos are close ({bpm_a:.1f} vs {bpm_b:.1f} BPM), requiring only minor pitch adjustment."
    elif tempo_lbl == "Workable":
        why += f" Tempos are workable ({bpm_a:.1f} vs {bpm_b:.1f} BPM), needing moderate pitch bending."
    elif tempo_lbl == "Risky":
        why += f" Significant tempo difference ({bpm_a:.1f} vs {bpm_b:.1f} BPM)."
    elif "Metrical" in tempo_lbl:
        why += f" A {tempo_lbl.lower()} tempo relationship is detected (half/double speed match)."

    # Energy explanation
    energy_dir = scores["energy_direction"]
    if energy_dir == "same":
        why += " Energy levels are flat, keeping the dancefloor groove steady."
    elif energy_dir == "build":
        why += " A gradual rise in energy helps build tension on the dancefloor."
    elif energy_dir == "reset":
        why += " Energy drops slightly, providing a perfect reset or cool down."
    elif energy_dir == "peak":
        why += " A sharp energy surge will hype the crowd but might feel abrupt."
    elif energy_dir == "crash":
        why += " A major energy drop will cool down the room drastically."

    # Watch outs
    if scores["tempo_score"] < 40:
        watch_out.append(f"Large tempo gap ({abs(bpm_b - bpm_a):.1f} BPM). Avoid long beatmixes unless using sync/master-tempo.")
    if scores["harmonic_score"] <= 25 and scores["harmonic_label"] != "Unknown (neutral)":
        watch_out.append("Harmonic clash. Avoid overlapping melodic sections, vocals, or basslines.")
    if scores["energy_direction"] == "crash":
        watch_out.append("Severe energy drop. Best used after a peak song to reset the floor.")
    if not track_a.get("camelot_key") or not track_b.get("camelot_key"):
        watch_out.append("Missing key information. Rely on your ears to test the harmonic fit.")

    # Try suggestions
    if "Metrical" in tempo_lbl:
        try_this = "Perform a half-time or double-time drop mix. Bring B in directly at a transition point (e.g. chorus)."
    elif scores["tempo_score"] >= 85 and scores["harmonic_score"] >= 75:
        try_this = "Execute a long, smooth blend. Layer B's intro over A's outro, overlapping the beats."
    elif scores["harmonic_label"] == "Tension Jump":
        try_this = "Wait for a clean breakdown or chorus entry, then quickly drop B to maximize the tension jump."
    elif scores["harmonic_score"] <= 25:
        try_this = "Use a quick cut or drop mix on the one beat. Avoid blending overlapping melodies."
    else:
        try_this = "Start mixing B during the outro of A, using EQ/filtering to manage overlapping sounds."

    return {
        "why_it_works": why.strip(),
        "watch_out": watch_out if watch_out else ["No major risks detected. Mix with confidence!"],
        "suggested_experiment": try_this
    }


def bucket_candidates(candidates: list[dict]) -> dict:
    """Bucket a list of evaluated candidate tracks.
    
    Expected format of candidates elements:
    {
        "track": dict,
        "score_data": dict
    }
    """
    buckets = {
        "best_safe_blends": [],
        "energy_lifts": [],
        "energy_resets": [],
        "harmonic_tension": [],
        "metrical_match": [],
        "probably_reject": []
    }

    for c in candidates:
        score_data = c["score_data"]
        total_score = score_data["total_score"]
        tempo_s = score_data["tempo_score"]
        harmonic_lbl = score_data["harmonic_label"]
        energy_dir = score_data["energy_direction"]
        tempo_lbl = score_data["tempo_label"]
        risk_flags = score_data["risk_flags"]

        # 1. Probably Reject
        if total_score < 35.0:
            buckets["probably_reject"].append(c)
            continue  # don't put in other buckets if rejected

        # 2. Best Safe Blends: score >= 75 and no risk flags
        if total_score >= 75.0 and len(risk_flags) == 0:
            buckets["best_safe_blends"].append(c)

        # 3. Energy Lifts: energy_dir = build or peak, tempo_score >= 60
        if energy_dir in ("build", "peak") and tempo_s >= 60.0:
            buckets["energy_lifts"].append(c)

        # 4. Energy Resets: energy_dir = reset or crash, total_score >= 50
        if energy_dir in ("reset", "crash") and total_score >= 50.0:
            buckets["energy_resets"].append(c)

        # 5. Harmonic Tension Moves: harmonic = Tension Jump (+7) or Tritone, total_score >= 50
        if harmonic_lbl in ("Tension Jump", "Tritone") and total_score >= 50.0:
            buckets["harmonic_tension"].append(c)

        # 6. Half-time / Double-time: metrical match detected
        if "Metrical" in tempo_lbl:
            buckets["metrical_match"].append(c)

    return buckets
