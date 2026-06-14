import unittest
from datetime import datetime, timedelta, timezone
from portfolio import create_app, db
from portfolio.models import User, AnchorSchedule, Attempt, seed_database
from portfolio.utils.srs import update_schedule_after_attempt, get_due_anchors, seed_schedule_from_history

class SRSTestCase(unittest.TestCase):
    def setUp(self):
        """Set up in-memory database and context."""
        self.app = create_app("testing")
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()
        seed_database()

    def tearDown(self):
        """Teardown database."""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_srs_algorithm_and_lockout(self):
        # Create a test user
        user = User(display_name="SRS Test User")
        db.session.add(user)
        db.session.commit()
        
        user_id = user.id
        anchor_bpm = 120
        
        # 1. First attempt: DJ-Ready (Quality 4)
        start_time = datetime.now(timezone.utc) - timedelta(days=5)
        update_schedule_after_attempt(user_id, anchor_bpm, "DJ-Ready", start_time)
        
        schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
        self.assertIsNotNone(schedule)
        self.assertEqual(schedule.repetitions, 1)
        self.assertEqual(schedule.interval_days, 1)
        self.assertAlmostEqual(schedule.ease_factor, 2.5 + 0.1 - (5 - 4) * 0.08) # 2.52
        
        # 2. Lockout test: Attempt after 2 hours (Quality 5) -> Should be ignored for schedule advancement
        lockout_time = start_time + timedelta(hours=2)
        update_schedule_after_attempt(user_id, anchor_bpm, "Tempo Wizard", lockout_time)
        
        # Reload schedule and verify parameters are unchanged
        schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
        self.assertEqual(schedule.repetitions, 1)
        self.assertEqual(schedule.interval_days, 1)
        self.assertAlmostEqual(schedule.ease_factor, 2.52)
        
        # 3. Lockout expired: Attempt after 19 hours (Quality 4) -> Should advance schedule
        next_attempt_time = start_time + timedelta(hours=19)
        update_schedule_after_attempt(user_id, anchor_bpm, "DJ-Ready", next_attempt_time)
        
        schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
        self.assertEqual(schedule.repetitions, 2)
        self.assertEqual(schedule.interval_days, 6)
        
        # 4. Success attempt: repetitions = 2 (Quality 4) -> Should calculate round(6 * ease_factor)
        # Advance 2 days to satisfy 18-hour lockout
        next_attempt_time_3 = start_time + timedelta(days=2)
        update_schedule_after_attempt(user_id, anchor_bpm, "DJ-Ready", next_attempt_time_3)
        
        schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
        self.assertEqual(schedule.repetitions, 3)
        # ease_factor before was ~2.54, so interval should be round(6 * 2.54) = 15
        self.assertTrue(schedule.interval_days >= 15)
        
        # 5. Check if it's due
        due = get_due_anchors(user_id)
        # Next review is scheduled 15 days from next_attempt_time_3, so it should not be due now
        self.assertEqual(len(due), 0)

    def test_metrical_match_streak_capping(self):
        user = User(display_name="Streak Capping User")
        db.session.add(user)
        db.session.commit()
        
        user_id = user.id
        anchor_bpm = 140
        
        # Run 3 consecutive Metrical Matches
        # Ensure we space them by 19 hours to avoid lockouts
        base_time = datetime.now(timezone.utc) - timedelta(days=10)
        
        update_schedule_after_attempt(user_id, anchor_bpm, "Metrical Match", base_time)
        schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
        self.assertEqual(schedule.metrical_match_streak, 1)
        self.assertEqual(schedule.repetitions, 0) # Reset due to quality < 3
        
        update_schedule_after_attempt(user_id, anchor_bpm, "Metrical Match", base_time + timedelta(hours=19))
        schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
        self.assertEqual(schedule.metrical_match_streak, 2)
        
        update_schedule_after_attempt(user_id, anchor_bpm, "Metrical Match", base_time + timedelta(hours=38))
        schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
        self.assertEqual(schedule.metrical_match_streak, 3)
        
        # Capping should restrict interval_days to <= 7 and ease_factor to <= 2.5
        self.assertTrue(schedule.interval_days <= 7)
        self.assertTrue(schedule.ease_factor <= 2.5)
        
        # Now hit a true success (Quality 4) -> streak should reset
        update_schedule_after_attempt(user_id, anchor_bpm, "DJ-Ready", base_time + timedelta(hours=57))
        schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
        self.assertEqual(schedule.metrical_match_streak, 0)

    def test_diagnostic_seeding(self):
        user = User(display_name="Seeding User")
        db.session.add(user)
        db.session.commit()
        
        user_id = user.id
        anchor_bpm = 95
        
        # Seed schedule based on average error: 2.5% (should get ease_factor = 2.5)
        seed_schedule_from_history(user_id, anchor_bpm, 2.5)
        schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
        self.assertIsNotNone(schedule)
        self.assertEqual(schedule.ease_factor, 2.5)
        self.assertEqual(schedule.repetitions, 0)
        
        # Check that duplicate seeding does not overwrite
        seed_schedule_from_history(user_id, anchor_bpm, 9.5)
        schedule = AnchorSchedule.query.filter_by(user_id=user_id, anchor_bpm=anchor_bpm).first()
        self.assertEqual(schedule.ease_factor, 2.5)
