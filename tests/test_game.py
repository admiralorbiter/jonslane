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


if __name__ == "__main__":
    unittest.main()
