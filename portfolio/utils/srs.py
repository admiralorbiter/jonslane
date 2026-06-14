from datetime import datetime, timedelta, timezone

from portfolio import db
from portfolio.models import AnchorSchedule

RATING_QUALITY_MAP = {
    "Tempo Wizard": 5,
    "DJ-Ready": 4,
    "Solid Ear": 3,
    "Metrical Match": 3,
    "Getting There": 2,
    "Needs Practice": 0,
}


def get_due_anchors(user_id: int) -> list[dict]:
    """
    Return a list of due anchors for a given user.
    Each item is a dict: {'anchor_bpm': int, 'days_overdue': float}
    """
    now = datetime.now(timezone.utc)
    schedules = AnchorSchedule.query.filter(
        AnchorSchedule.user_id == user_id,
        (AnchorSchedule.next_review_at.is_(None)) | (AnchorSchedule.next_review_at <= now),
    ).all()

    due_list = []
    for s in schedules:
        days_overdue = 0.0
        if s.next_review_at:
            delta = now - s.next_review_at.replace(tzinfo=timezone.utc)
            days_overdue = max(0.0, delta.total_seconds() / 86400.0)
        due_list.append(
            {
                "anchor_bpm": s.anchor_bpm,
                "days_overdue": days_overdue,
                "interval_days": s.interval_days,
                "repetitions": s.repetitions,
            }
        )
    return due_list


def update_schedule_after_attempt(
    user_id: int,
    anchor_bpm: int,
    rating: str,
    attempt_time: datetime | None = None,
) -> None:
    """
    Update the Spaced Repetition (SRS) schedule for a user and anchor BPM based on attempt rating.
    Applies the SM-2 algorithm, 18-hour lockout window, and metrical-match streak capping.
    """
    if attempt_time is None:
        attempt_time = datetime.now(timezone.utc)
    elif attempt_time.tzinfo is None:
        attempt_time = attempt_time.replace(tzinfo=timezone.utc)

    quality = RATING_QUALITY_MAP.get(rating, 1)  # default to 1 if not matched

    schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()

    # 1. 18-Hour Spacing Lockout Check
    if schedule and schedule.last_reviewed_at:
        last_ref = schedule.last_reviewed_at.replace(tzinfo=timezone.utc)
        if attempt_time - last_ref < timedelta(hours=18):
            # Attempt is too close to last reviewed time, log it but don't advance the schedule
            return

    # 2. Initialize or extract schedule values
    if schedule is None:
        schedule = AnchorSchedule(
            user_id=user_id,
            anchor_bpm=anchor_bpm,
            ease_factor=2.5,
            interval_days=1,
            repetitions=0,
            metrical_match_streak=0,
        )
        db.session.add(schedule)

    ease_factor = schedule.ease_factor
    interval_days = schedule.interval_days
    repetitions = schedule.repetitions
    metrical_match_streak = schedule.metrical_match_streak

    # 3. Metrical Match Streak tracking
    if rating == "Metrical Match":
        metrical_match_streak += 1
    elif quality >= 4:
        metrical_match_streak = 0

    # 4. SM-2 Spaced Repetition Calculations
    if quality < 3:
        # Repetition fail (Quality 0, 1, 2)
        repetitions = 0
        interval_days = 1
        # Apply ease factor penalties
        if quality == 2:
            ease_factor -= 0.08
        else:  # Quality 0 or 1
            ease_factor -= 0.2
    else:
        # Repetition success (Quality 3, 4, 5)
        if repetitions == 0:
            interval_days = 1
        elif repetitions == 1:
            interval_days = 6
        else:
            interval_days = int(round(interval_days * ease_factor))

        repetitions += 1
        ease_factor = ease_factor + 0.1 - (5 - quality) * 0.08

    # Apply limits on ease factor
    ease_factor = max(1.3, min(ease_factor, 3.0))

    # 5. Metrical Match Streak Capping
    if metrical_match_streak >= 3:
        interval_days = min(interval_days, 7)
        ease_factor = min(ease_factor, 2.5)

    # Update schedule attributes
    schedule.ease_factor = ease_factor
    schedule.interval_days = interval_days
    schedule.repetitions = repetitions
    schedule.last_reviewed_at = attempt_time
    schedule.next_review_at = attempt_time + timedelta(days=interval_days)
    schedule.metrical_match_streak = metrical_match_streak

    db.session.commit()


def seed_schedule_from_history(user_id: int, anchor_bpm: int, avg_percent_error: float) -> None:
    """
    Seed an AnchorSchedule for a user starting today based on their average guest history error.
    """
    # Check if a schedule already exists
    schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
    if schedule:
        return

    # Calculate starting ease factor based on average percent error
    if avg_percent_error <= 3.0:
        ease_factor = 2.5
    elif avg_percent_error <= 8.0:
        ease_factor = 2.3
    else:
        ease_factor = 2.1

    schedule = AnchorSchedule(
        user_id=user_id,
        anchor_bpm=anchor_bpm,
        ease_factor=ease_factor,
        interval_days=1,
        repetitions=0,
        next_review_at=datetime.now(timezone.utc),  # due today
        last_reviewed_at=None,
        metrical_match_streak=0,
    )
    db.session.add(schedule)
    db.session.commit()
