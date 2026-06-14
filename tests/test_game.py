import json
import unittest

from portfolio import create_app, db
from portfolio.models import Attempt, Challenge, Crate, User, seed_database


class GameTestCase(unittest.TestCase):
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

    def test_dashboard_route(self):
        """Test dashboard page renders successfully and seeds correctly."""
        response = self.client.get("/game/dashboard")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Count Me In", response.data)
        self.assertIn(b"House Crate", response.data)

        # Verify default Guest DJ user was created
        user = User.query.first()
        self.assertIsNotNone(user)
        self.assertEqual(user.display_name, "Guest DJ")

    def test_play_route_renders_recipe(self):
        """Test play route renders the challenge recipe JSON in the DOM."""
        # Get house crate ID
        crate = Crate.query.filter_by(genre="house").first()
        self.assertIsNotNone(crate)

        # Trigger play route
        response = self.client.get(f"/game/play/{crate.id}")
        self.assertEqual(response.status_code, 200)

        # Find the recipe metadata in the HTML response
        html = response.data.decode("utf-8")
        self.assertIn('id="recipe-meta"', html)

        # Locate the JSON block in DOM
        start_idx = html.find('data-recipe="') + len('data-recipe="')
        end_idx = html.find('"', start_idx)
        recipe_str = html[start_idx:end_idx].replace("&quot;", '"').replace("&#34;", '"')

        # Verify recipe JSON properties
        recipe = json.loads(recipe_str)
        self.assertEqual(recipe["genre"], "house")
        self.assertTrue(crate.min_bpm <= recipe["bpm"] <= crate.max_bpm)
        self.assertIn("kick", recipe["elements"])

    def test_submit_guess_flow(self):
        """Test guess submission calculations, scoring, and streaks."""
        crate = Crate.query.filter_by(genre="house").first()

        # Explicitly create a challenge with a fixed true BPM (e.g. 120 BPM)
        challenge = Challenge(
            crate_id=crate.id,
            true_bpm=120.0,
            genre="house",
            beat_recipe_json=json.dumps({"genre": "house", "bpm": 120.0, "elements": ["kick"]}),
        )
        db.session.add(challenge)
        db.session.commit()

        # 1. Test close guess (< 1.0% error) -> Rating 'Tempo Wizard'
        # Guess: 120.5 BPM. Error: +0.5 BPM. % Error: 0.5 / 120 * 100 = 0.42%
        response = self.client.post(
            "/game/submit",
            data=json.dumps({"challenge_id": challenge.id, "guess": 120.5}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data.decode("utf-8"))

        self.assertEqual(data["true_bpm"], 120.0)
        self.assertEqual(data["guessed_bpm"], 120.5)
        self.assertEqual(data["bpm_error"], 0.5)
        self.assertEqual(data["percent_error"], 0.42)
        self.assertEqual(data["rating"], "Tempo Wizard")
        self.assertEqual(data["score"], 100)
        self.assertEqual(data["streak"], 1)

        # 2. Test another close guess to increment streak (e.g., 119.0) -> % Error: 1/120 * 100 = 0.83%
        response2 = self.client.post(
            "/game/submit",
            data=json.dumps({"challenge_id": challenge.id, "guess": 119.0}),
            content_type="application/json",
        )
        data2 = json.loads(response2.data.decode("utf-8"))
        self.assertEqual(data2["streak"], 2)

        # 3. Test a bad guess (e.g., 150.0 BPM) -> Resets streak to 0
        response3 = self.client.post(
            "/game/submit",
            data=json.dumps({"challenge_id": challenge.id, "guess": 150.0}),
            content_type="application/json",
        )
        data3 = json.loads(response3.data.decode("utf-8"))
        self.assertEqual(data3["streak"], 0)
        self.assertEqual(data3["max_streak"], 2)  # Max streak remains 2
        self.assertEqual(data3["rating"], "Needs Practice")

        # Verify attempts are persisted
        attempts = Attempt.query.all()
        self.assertEqual(len(attempts), 3)

    def test_submit_attempt_unauthenticated(self):
        """Test that unauthenticated requests to /game/api/attempt return 401."""
        response = self.client.post(
            "/game/api/attempt",
            data=json.dumps({"guess": 120.0, "challenge_token": "fake-token"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data.decode("utf-8"))
        self.assertIn("error", data)

    def test_submit_attempt_missing_params(self):
        """Test that /game/api/attempt returns 400 on missing arguments."""
        user = User.query.first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        response = self.client.post(
            "/game/api/attempt",
            data=json.dumps({"guess": 120.0}), # missing challenge_token
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_submit_attempt_invalid_bounds(self):
        """Test that /game/api/attempt returns 400 on invalid guess value or clue level."""
        user = User.query.first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        # Guess out of bounds (< 1.0)
        response = self.client.post(
            "/game/api/attempt",
            data=json.dumps({"guess": 0.5, "challenge_token": "some-token"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_submit_attempt_invalid_token(self):
        """Test that /game/api/attempt returns 400 for an invalid/expired token."""
        user = User.query.first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        response = self.client.post(
            "/game/api/attempt",
            data=json.dumps({"guess": 120.0, "challenge_token": "invalid-token-signature"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data.decode("utf-8"))
        self.assertEqual(data["error"], "Invalid or expired challenge token.")

    def test_submit_attempt_success_and_duplicate(self):
        """Test successful direct attempt submission and duplicate prevention via UUID."""
        user = User.query.first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        from portfolio.utils.security import generate_challenge_token

        # Generate a valid token for 120.0 BPM
        token = generate_challenge_token(120.0, "House Crate")

        # Submit close guess (120.5 BPM) -> error = 0.5 BPM (0.42%) -> Wizard (100 pts)
        payload = {
            "guess": 120.5,
            "challenge_token": token,
            "clue_level": 4,
            "client_uuid": "test-attempt-uuid-123"
        }

        response = self.client.post(
            "/game/api/attempt",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data.decode("utf-8"))

        self.assertEqual(data["true_bpm"], 120.0)
        self.assertEqual(data["guessed_bpm"], 120.5)
        self.assertEqual(data["bpm_error"], 0.5)
        self.assertEqual(data["percent_error"], 0.42)
        self.assertEqual(data["rating"], "Tempo Wizard")
        self.assertEqual(data["score"], 100)
        self.assertEqual(data["streak"], 1)

        # Check attempt was saved in database
        attempt = Attempt.query.filter_by(client_uuid="test-attempt-uuid-123").first()
        self.assertIsNotNone(attempt)
        self.assertEqual(attempt.user_id, user.id)
        self.assertEqual(attempt.crate_name, "House Crate")
        self.assertIsNone(attempt.challenge_id) # Direct attempts have no challenge_id

        # Submit the same uuid again -> should fail with 409 Conflict
        response_dup = self.client.post(
            "/game/api/attempt",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response_dup.status_code, 409)
        data_dup = json.loads(response_dup.data.decode("utf-8"))
        self.assertEqual(data_dup["error"], "Attempt already recorded.")

    def test_metrical_match_scoring_and_streak(self):
        """Test that half/double BPM guesses within 3% score 50, rating is 'Metrical Match', and streak is preserved."""
        crate = Crate.query.filter_by(genre="house").first()
        challenge = Challenge(
            crate_id=crate.id,
            true_bpm=120.0,
            genre="house",
            beat_recipe_json=json.dumps({"genre": "house", "bpm": 120.0, "elements": ["kick"]}),
        )
        db.session.add(challenge)
        db.session.commit()

        # 1. Half-time guess: 60.5 BPM (target: 60.0 BPM). Error relative to 60.0 is 0.5 / 60.0 = 0.83% (< 3%)
        response_half = self.client.post(
            "/game/submit",
            data=json.dumps({"challenge_id": challenge.id, "guess": 60.5}),
            content_type="application/json",
        )
        self.assertEqual(response_half.status_code, 200)
        data_half = json.loads(response_half.data.decode("utf-8"))
        self.assertEqual(data_half["rating"], "Metrical Match")
        self.assertEqual(data_half["score"], 50)
        self.assertEqual(data_half["streak"], 1)

        # 2. Double-time guess: 238.0 BPM (target: 240.0 BPM). Error relative to 240.0 is 2.0 / 240.0 = 0.83% (< 3%)
        response_double = self.client.post(
            "/game/submit",
            data=json.dumps({"challenge_id": challenge.id, "guess": 238.0}),
            content_type="application/json",
        )
        self.assertEqual(response_double.status_code, 200)
        data_double = json.loads(response_double.data.decode("utf-8"))
        self.assertEqual(data_double["rating"], "Metrical Match")
        self.assertEqual(data_double["score"], 50)
        self.assertEqual(data_double["streak"], 2) # Streak should continue!

        # Check database records
        attempts = Attempt.query.order_by(Attempt.created_at.desc()).limit(2).all()
        # The latest attempt (index 0 in desc order) is double-time
        self.assertEqual(attempts[0].metrical_multiplier, 2.0)
        self.assertEqual(attempts[1].metrical_multiplier, 0.5)

    def test_sync_with_metrical_match(self):
        """Test syncing local attempts that contain Metrical Match guesses."""
        user = User.query.first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        # Local storage payload
        payload = {
            "attempts": [
                {
                    "client_uuid": "sync-metrical-1",
                    "guessed_bpm": 60.5,
                    "true_bpm": 120.0,
                    "bpm_error": 0.5,
                    "percent_error": 0.83,
                    "score": 50,
                    "rating": "Metrical Match",
                    "crate_name": "House Crate",
                    "metrical_multiplier": 0.5,
                    "created_at": "2026-06-14T10:00:00Z"
                },
                {
                    "client_uuid": "sync-metrical-2",
                    "guessed_bpm": 238.0,
                    "true_bpm": 120.0,
                    "bpm_error": -2.0,
                    "percent_error": 0.83,
                    "score": 50,
                    "rating": "Metrical Match",
                    "crate_name": "House Crate",
                    "metrical_multiplier": 2.0,
                    "created_at": "2026-06-14T10:05:00Z"
                }
            ]
        }

        response = self.client.post(
            "/game/api/sync",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data.decode("utf-8"))
        self.assertEqual(data["synced_count"], 2)
        self.assertEqual(data["current_streak"], 2) # Streak should be computed correctly

        # Check DB persistence
        a1 = Attempt.query.filter_by(client_uuid="sync-metrical-1").first()
        self.assertIsNotNone(a1)
        self.assertEqual(a1.metrical_multiplier, 0.5)
        self.assertEqual(a1.rating, "Metrical Match")

        a2 = Attempt.query.filter_by(client_uuid="sync-metrical-2").first()
        self.assertIsNotNone(a2)
        self.assertEqual(a2.metrical_multiplier, 2.0)

    def test_tap_stability_validation_and_persistence(self):
        """Test tap_stability checks in direct submission (bounds, NaN, Inf, and saving)."""
        user = User.query.first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        from portfolio.utils.security import generate_challenge_token
        token = generate_challenge_token(120.0, "House Crate")

        # 1. Reject NaN
        payload = {
            "guess": 120.0,
            "challenge_token": token,
            "clue_level": 4,
            "client_uuid": "stability-test-nan",
            "tap_stability": "NaN"
        }
        res_nan = self.client.post("/game/api/attempt", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res_nan.status_code, 400)

        # 2. Reject negative value
        payload["tap_stability"] = -15.5
        payload["client_uuid"] = "stability-test-neg"
        res_neg = self.client.post("/game/api/attempt", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res_neg.status_code, 400)

        # 3. Reject too large value
        payload["tap_stability"] = 6000.0
        payload["client_uuid"] = "stability-test-large"
        res_large = self.client.post("/game/api/attempt", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res_large.status_code, 400)

        # 4. Accept valid value, verify rounding and database storage
        payload["tap_stability"] = 12.3456
        payload["client_uuid"] = "stability-test-valid"
        res_valid = self.client.post("/game/api/attempt", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res_valid.status_code, 201)

        saved = Attempt.query.filter_by(client_uuid="stability-test-valid").first()
        self.assertIsNotNone(saved)
        self.assertEqual(saved.tap_stability, 12.35) # Rounds to 2 decimal places

    def test_sync_tap_stability_sanitization(self):
        """Test syncing local storage attempts with tap_stability, verifying sanitization."""
        user = User.query.first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        payload = {
            "attempts": [
                {
                    "client_uuid": "sync-valid-stability",
                    "guessed_bpm": 120.0,
                    "true_bpm": 120.0,
                    "bpm_error": 0.0,
                    "percent_error": 0.0,
                    "score": 100,
                    "rating": "Tempo Wizard",
                    "crate_name": "House Crate",
                    "tap_stability": 22.456,
                    "created_at": "2026-06-14T10:00:00Z"
                },
                {
                    "client_uuid": "sync-invalid-stability",
                    "guessed_bpm": 120.0,
                    "true_bpm": 120.0,
                    "bpm_error": 0.0,
                    "percent_error": 0.0,
                    "score": 100,
                    "rating": "Tempo Wizard",
                    "crate_name": "House Crate",
                    "tap_stability": "Infinity", # Should be rejected
                    "created_at": "2026-06-14T10:05:00Z"
                }
            ]
        }

        res = self.client.post("/game/api/sync", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data.decode("utf-8"))
        self.assertEqual(data["synced_count"], 1) # Only the valid one should sync

        a_valid = Attempt.query.filter_by(client_uuid="sync-valid-stability").first()
        self.assertIsNotNone(a_valid)
        self.assertEqual(a_valid.tap_stability, 22.46)

        a_invalid = Attempt.query.filter_by(client_uuid="sync-invalid-stability").first()
        self.assertIsNone(a_invalid)

    def test_dashboard_stats_with_mixed_stability(self):
        """Test stats calculation filters out None/null values and averages correctly without errors."""
        user = User.query.first()
        # Seed attempts
        a1 = Attempt(user_id=user.id, guessed_bpm=120.0, true_bpm=120.0, bpm_error=0.0, percent_error=0.0, score=100, rating="Tempo Wizard", tap_stability=10.0)
        a2 = Attempt(user_id=user.id, guessed_bpm=120.0, true_bpm=120.0, bpm_error=0.0, percent_error=0.0, score=100, rating="Tempo Wizard", tap_stability=20.0)
        a3 = Attempt(user_id=user.id, guessed_bpm=120.0, true_bpm=120.0, bpm_error=0.0, percent_error=0.0, score=100, rating="Tempo Wizard", tap_stability=None) # keyboard attempt
        db.session.add_all([a1, a2, a3])
        db.session.commit()

        from portfolio.routes.game import calculate_user_stats
        attempts = Attempt.query.filter_by(user_id=user.id).all()
        stats = calculate_user_stats(user, attempts)

        self.assertEqual(stats["total_attempts"], 3)
        self.assertEqual(stats["avg_stability"], 15.0) # Average of [10.0, 20.0]


if __name__ == "__main__":
    unittest.main()
