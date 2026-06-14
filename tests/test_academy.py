import unittest
from datetime import datetime, timedelta, timezone

from portfolio import create_app, db
from portfolio.models import Attempt, User, seed_database
from portfolio.utils.academy_stats import calculate_skills_mastery, get_user_academy_stats


class AcademyTestCase(unittest.TestCase):
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

    def test_authentication_gating(self):
        # Unauthenticated request to /academy redirects to login
        response = self.client.get("/academy/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/auth/login?next=/academy/", response.headers.get("Location"))

        # Unauthenticated request to JSON API returns 401
        response = self.client.get("/academy/api/skills")
        self.assertEqual(response.status_code, 401)

    def test_redirect_next_parameter(self):
        # Create a user in database
        user = User(display_name="Test User", email="test@example.com")
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()

        # Connect session (POST request with next parameter)
        response = self.client.post(
            "/auth/login",
            data={"email": "test@example.com", "password": "password123", "next": "/academy/"},
        )
        self.assertEqual(response.status_code, 302)
        # Should redirect to next path (/academy/)
        self.assertEqual(response.headers.get("Location"), "/academy/")

        # Test malicious open redirects
        response2 = self.client.post(
            "/auth/login",
            data={
                "email": "test@example.com",
                "password": "password123",
                "next": "http://evil-attacker.com",
            },
        )
        # Should fallback to default dashboard redirect
        self.assertEqual(response2.status_code, 302)
        self.assertEqual(response2.headers.get("Location"), "/game/dashboard")

    def test_skills_calculation_and_progression(self):
        # Create user
        user = User(display_name="Progression User")
        db.session.add(user)
        db.session.commit()

        user_id = user.id

        # Verify initial stats (all 0 since no attempts exist)
        stats = get_user_academy_stats(user_id)
        self.assertEqual(stats["skills"]["pulse_entrainment"], 0.0)
        self.assertEqual(stats["progression"][0], "unlocked")
        self.assertEqual(stats["progression"][1], "locked")

        # 1. Log 5 attempts for Level 0: Find Pulse (skill_tag='find_pulse')
        # We need these to span 2 separate days
        day1 = datetime.now(timezone.utc) - timedelta(days=2)
        day2 = datetime.now(timezone.utc) - timedelta(days=1)

        for i in range(3):
            att = Attempt(
                user_id=user_id,
                guessed_bpm=120.0,
                true_bpm=120.0,
                bpm_error=0.0,
                percent_error=0.0,
                score=100,
                rating="Tempo Wizard",
                client_uuid=f"uuid-find-pulse-{i}",
                tap_stability=28.0,  # <= 30.0 -> score = 100
                skill_tag="find_pulse",
                created_at=day1,
            )
            db.session.add(att)

        for i in range(3, 6):
            att = Attempt(
                user_id=user_id,
                guessed_bpm=120.0,
                true_bpm=120.0,
                bpm_error=0.0,
                percent_error=0.0,
                score=100,
                rating="Tempo Wizard",
                client_uuid=f"uuid-find-pulse-{i}",
                tap_stability=35.0,  # 35 <= 50 -> score = 100 - (35-30) = 95
                skill_tag="find_pulse",
                created_at=day2,
            )
            db.session.add(att)

        db.session.commit()

        # Verify skill calculation (rolling average / piecewise formula)
        # avg tap_stability over the last 50 is ~32
        # score = 100 - (31.5 - 30) * 1.0 = 98.5
        skills = calculate_skills_mastery(user_id)
        self.assertTrue(skills["pulse_entrainment"] > 90.0)

        # Verify Level 0 is mastered and Level 1 unlocks
        stats = get_user_academy_stats(user_id)
        self.assertEqual(stats["progression"][0], "mastered")
        self.assertEqual(stats["progression"][1], "unlocked")
