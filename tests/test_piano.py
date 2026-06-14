import unittest
from datetime import datetime, timedelta, timezone
from portfolio import create_app, db
from portfolio.models import User, Attempt, AnchorSchedule, seed_database
from portfolio.utils.srs import update_schedule_after_attempt


class PianoTestCase(unittest.TestCase):
    def setUp(self):
        """Set up context and in-memory DB."""
        self.app = create_app("testing")
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()
        seed_database()

    def tearDown(self):
        """Clean up database."""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_public_routes(self):
        # Piano Lab homepage should be accessible publicly without login (returns 200)
        response = self.client.get("/piano/")
        self.assertEqual(response.status_code, 200)

    def test_anonymous_post_attempt_returns_401(self):
        # Anonymous POST to piano API returns 401
        payload = {
            "client_uuid": "piano_uuid_anon",
            "skill_tag": "subdivision",
            "tap_stability": 30.0
        }
        response = self.client.post("/piano/api/attempts", json=payload)
        self.assertEqual(response.status_code, 401)

    def test_authenticated_post_attempt(self):
        # Create a user
        user = User(display_name="Piano Student", email="student@piano.com")
        user.set_password("piano123")
        db.session.add(user)
        db.session.commit()

        # Connect session
        self.client.post("/auth/login", data={
            "email": "student@piano.com",
            "password": "piano123"
        })

        # Submit attempt
        payload = {
            "client_uuid": "piano_uuid_auth",
            "skill_tag": "subdivision",
            "tap_stability": 30.0,
            "input_method": "midi",
            "hand": "both"
        }
        response = self.client.post("/piano/api/attempts", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["score"], 100)
        self.assertEqual(data["rating"], "Tempo Wizard")

        # Verify DB entry
        attempt = Attempt.query.filter_by(client_uuid="piano_uuid_auth").first()
        self.assertIsNotNone(attempt)
        self.assertEqual(attempt.user_id, user.id)
        self.assertEqual(attempt.module, "piano_lab")
        self.assertEqual(attempt.skill_tag, "subdivision")
        self.assertEqual(attempt.tap_stability, 30.0)
        self.assertEqual(attempt.input_method, "midi")
        self.assertEqual(attempt.hand, "both")

    def test_sync_endpoint_for_piano_attempts(self):
        # Create a user
        user = User(display_name="Sync User", email="sync@piano.com")
        user.set_password("sync123")
        db.session.add(user)
        db.session.commit()

        # Connect session
        self.client.post("/auth/login", data={
            "email": "sync@piano.com",
            "password": "sync123"
        })

        # Payload includes both CMI and Piano attempts
        payload = {
            "attempts": [
                {
                    "client_uuid": "uuid_cmi_1",
                    "guessed_bpm": 120.0,
                    "true_bpm": 120.0,
                    "module": "count_me_in",
                    "created_at": "2026-06-14T12:00:00Z"
                },
                {
                    "client_uuid": "uuid_piano_1",
                    "guessed_bpm": 120.0,
                    "true_bpm": 120.0,
                    "module": "piano_lab",
                    "skill_tag": "phase_alignment",
                    "phase_error_ms": 15.0,
                    "created_at": "2026-06-14T12:01:00Z"
                }
            ]
        }
        response = self.client.post("/game/api/sync", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["synced_count"], 2)

        # Check that piano attempt has the correct score calculated on the server
        piano_att = Attempt.query.filter_by(client_uuid="uuid_piano_1").first()
        self.assertIsNotNone(piano_att)
        self.assertEqual(piano_att.module, "piano_lab")
        # 15ms error -> score 90 (100 - 15/30 * 20)
        self.assertEqual(piano_att.score, 90)
        self.assertEqual(piano_att.rating, "Tempo Wizard")

        # Check stats pollution (Piano attempts should not pollute DJ dashboard stats)
        from portfolio.routes.game import calculate_user_stats
        all_attempts = Attempt.query.filter_by(user_id=user.id).all()
        stats = calculate_user_stats(user, all_attempts)
        # Total attempts for CMI should only be 1
        self.assertEqual(stats["total_attempts"], 1)

    def test_srs_metrical_match_bug_fix(self):
        user = User(display_name="SRS User")
        db.session.add(user)
        db.session.commit()

        # Update schedule with Metrical Match rating
        # Metrical Match should map to Quality 3 (which allows repetitions and interval growth)
        update_schedule_after_attempt(user.id, 120, "Metrical Match")
        
        # Verify schedule exists
        schedule = AnchorSchedule.query.filter_by(user_id=user.id, anchor_bpm=120).first()
        self.assertIsNotNone(schedule)
        self.assertEqual(schedule.repetitions, 1)
        self.assertEqual(schedule.interval_days, 1)

        # Update again (after manual override of lockout time to make it eligible)
        schedule.last_reviewed_at = datetime.now(timezone.utc) - timedelta(hours=20)
        db.session.commit()

        update_schedule_after_attempt(user.id, 120, "Metrical Match")
        schedule = AnchorSchedule.query.filter_by(user_id=user.id, anchor_bpm=120).first()
        self.assertEqual(schedule.repetitions, 2)
        # Quality 3 for repetitions > 1 should grow the interval to 6
        self.assertEqual(schedule.interval_days, 6)
