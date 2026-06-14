import json
import unittest

from portfolio import create_app, db
from portfolio.models import Attempt, User, seed_database


class AuthTestCase(unittest.TestCase):
    def setUp(self):
        """Set up in-memory database and client for testing."""
        self.app = create_app("testing")
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

        db.create_all()
        seed_database()

    def tearDown(self):
        """Clean up database and pop context."""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_register_flow(self):
        """Test user registration process is disabled and returns 403."""
        # 1. Attempt to register a user via GET
        response_get = self.client.get("/auth/register")
        self.assertEqual(response_get.status_code, 403)
        self.assertIn(b"Public registration is disabled", response_get.data)

        # 2. Attempt to register a user via POST
        response_post = self.client.post(
            "/auth/register",
            data={
                "email": "test@example.com",
                "password": "securepassword123",
                "display_name": "Test DJ",
            },
        )
        self.assertEqual(response_post.status_code, 403)
        self.assertIn(b"Public registration is disabled", response_post.data)

        # Verify no user was inserted via web
        user = User.query.filter_by(email="test@example.com").first()
        self.assertIsNone(user)

    def test_login_logout_flow(self):
        """Test logging in and logging out."""
        # Create a user first
        user = User(email="login@example.com", display_name="Login DJ")
        user.set_password("mypassword")
        db.session.add(user)
        db.session.commit()

        # 1. Login with bad credentials
        response = self.client.post(
            "/auth/login",
            data={"email": "login@example.com", "password": "wrongpassword"},
            follow_redirects=True,
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Invalid email or password", response.data)

        # 2. Login with correct credentials
        response2 = self.client.post(
            "/auth/login",
            data={"email": "login@example.com", "password": "mypassword"},
            follow_redirects=True,
        )
        self.assertEqual(response2.status_code, 200)
        self.assertIn(b"Connected as Login DJ", response2.data)

        # 3. Logout
        response3 = self.client.get("/auth/logout", follow_redirects=True)
        self.assertEqual(response3.status_code, 200)
        self.assertIn(b"Disconnected successfully", response3.data)

    def test_sync_access_control(self):
        """Test that the sync endpoint is protected."""
        response = self.client.post(
            "/game/api/sync", data=json.dumps({"attempts": []}), content_type="application/json"
        )
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data.decode("utf-8"))
        self.assertEqual(data["error"], "Authentication required to sync data.")

    def test_sync_data_and_streak_calibration(self):
        """Test synchronization of local storage attempts and chronological streak calculations."""
        # Create user and log them in
        user = User(email="sync@example.com", display_name="Sync DJ")
        user.set_password("password")
        db.session.add(user)
        db.session.commit()

        # Log in the client
        self.client.post("/auth/login", data={"email": "sync@example.com", "password": "password"})

        # Guest attempts to sync (chronological sequence of 4 attempts)
        # 1. Correct (error <= 5% -> solid ear/dj-ready/wizard)
        # 2. Correct
        # 3. Incorrect (error > 5% -> getting there/needs practice)
        # 4. Correct
        # Resulting streak should calibrate to 1 (last one is correct, previous streak broken by attempt 3).
        # Max streak should be 2.
        attempts = [
            {
                "client_uuid": "uuid-1",
                "guessed_bpm": 120.0,
                "true_bpm": 120.0,
                "bpm_error": 0.0,
                "percent_error": 0.0,
                "score": 100,
                "rating": "Tempo Wizard",
                "crate_name": "House Crate",
                "created_at": "2026-06-14T00:00:00Z",
            },
            {
                "client_uuid": "uuid-2",
                "guessed_bpm": 122.0,
                "true_bpm": 120.0,
                "bpm_error": 2.0,
                "percent_error": 1.67,
                "score": 75,
                "rating": "DJ-Ready",
                "crate_name": "House Crate",
                "created_at": "2026-06-14T00:01:00Z",
            },
            {
                "client_uuid": "uuid-3",
                "guessed_bpm": 135.0,
                "true_bpm": 120.0,
                "bpm_error": 15.0,
                "percent_error": 12.5,
                "score": 10,
                "rating": "Needs Practice",
                "crate_name": "House Crate",
                "created_at": "2026-06-14T00:02:00Z",
            },
            {
                "client_uuid": "uuid-4",
                "guessed_bpm": 119.5,
                "true_bpm": 120.0,
                "bpm_error": -0.5,
                "percent_error": 0.42,
                "score": 100,
                "rating": "Tempo Wizard",
                "crate_name": "House Crate",
                "created_at": "2026-06-14T00:03:00Z",
            },
        ]

        response = self.client.post(
            "/game/api/sync",
            data=json.dumps({"attempts": attempts}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data.decode("utf-8"))

        self.assertTrue(data["success"])
        self.assertEqual(data["synced_count"], 4)
        self.assertEqual(data["current_streak"], 1)
        self.assertEqual(data["max_streak"], 2)

        # Check database records
        db_attempts = Attempt.query.filter_by(user_id=user.id).all()
        self.assertEqual(len(db_attempts), 4)

        # Check duplicate avoidance (posting same UUIDs again shouldn't insert duplicates)
        response_dup = self.client.post(
            "/game/api/sync",
            data=json.dumps({"attempts": attempts}),
            content_type="application/json",
        )
        self.assertEqual(response_dup.status_code, 200)
        data_dup = json.loads(response_dup.data.decode("utf-8"))
        self.assertEqual(data_dup["synced_count"], 0)


if __name__ == "__main__":
    unittest.main()
