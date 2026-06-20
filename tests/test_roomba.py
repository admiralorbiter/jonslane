import json
import unittest
from datetime import datetime, timedelta, timezone

from portfolio import create_app, db
from portfolio.models import (
    PlaylistImport,
    PlaylistTrack,
    SpotifyToken,
    TrackIdentity,
    TrackTempoAnnotation,
    TransitionCandidate,
    User,
)
from portfolio.routes.roomba_scoring import (
    apply_risk_penalties,
    score_energy,
    score_harmonic,
    score_tempo,
)
from portfolio.spotify_bridge.client import validate_spotify_id


class RoombaTestCase(unittest.TestCase):
    def setUp(self):
        """Set up in-memory database and client for testing."""
        self.app = create_app("testing")
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

        db.create_all()

        # Create two test users
        self.user_a = User(display_name="User A", email="usera@example.com")
        self.user_a.set_password("password")
        self.user_b = User(display_name="User B", email="userb@example.com")
        self.user_b.set_password("password")

        db.session.add_all([self.user_a, self.user_b])
        db.session.commit()

        # Create Spotify tokens for User A and B
        self.token_a = SpotifyToken(
            user_id=self.user_a.id,
            access_token="token_a_access",
            refresh_token="token_a_refresh",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            scope="playlist-read-private playlist-read-collaborative",
        )
        self.token_b = SpotifyToken(
            user_id=self.user_b.id,
            access_token="token_b_access",
            refresh_token="token_b_refresh",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            scope="playlist-read-private playlist-read-collaborative",
        )
        db.session.add_all([self.token_a, self.token_b])
        db.session.commit()

    def tearDown(self):
        """Clean up database and pop context."""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def login_user(self, email):
        """Helper to login a user."""
        return self.client.post("/auth/login", data={"email": email, "password": "password"})

    # ---------------------------------------------------------------------------
    # Unit tests for scoring engine
    # ---------------------------------------------------------------------------

    def test_tempo_score_buckets(self):
        """Validates all 7 BPM scoring tiers."""
        # 1. Locked: 0-1% difference
        score, label = score_tempo(120.0, 120.5)
        self.assertEqual(score, 100.0)
        self.assertEqual(label, "Locked")

        # 2. DJ-Ready: 1-3% difference
        score, label = score_tempo(120.0, 123.0)
        self.assertEqual(score, 85.0)
        self.assertEqual(label, "DJ-Ready")

        # 3. Workable: 3-5% difference
        score, label = score_tempo(120.0, 125.0)
        self.assertEqual(score, 65.0)
        self.assertEqual(label, "Workable")

        # 4. Risky: 5-8% difference
        score, label = score_tempo(120.0, 128.0)
        self.assertEqual(score, 40.0)
        self.assertEqual(label, "Risky")

        # 5. Reject: >8% difference
        score, label = score_tempo(120.0, 140.0)
        self.assertEqual(score, 10.0)
        self.assertEqual(label, "Reject")

        # 6. Half-time / Double-time: Metrical - Tight (within 2% of half/double)
        score, label = score_tempo(120.0, 60.5)
        self.assertEqual(score, 90.0)
        self.assertEqual(label, "Metrical — Tight")

        # 7. Half-time / Double-time: Metrical - Match (within 5% of half/double)
        score, label = score_tempo(120.0, 62.0)
        self.assertEqual(score, 75.0)
        self.assertEqual(label, "Metrical — Match")

    def test_harmonic_score_camelot(self):
        """Validates corrected Camelot table (9 relationships)."""
        # 1. Same key
        score, label = score_harmonic("8A", "8A")
        self.assertEqual(score, 100)
        self.assertEqual(label, "Same Key")

        # 2. Relative major/minor
        score, label = score_harmonic("8A", "8B")
        self.assertEqual(score, 90)
        self.assertEqual(label, "Relative")

        # 3. Adjacent circle of 5ths
        score, label = score_harmonic("8A", "9A")
        self.assertEqual(score, 75)
        self.assertEqual(label, "Circle of 5ths")

        # 4. Diagonal mediant
        score, label = score_harmonic("8A", "9B")
        self.assertEqual(score, 65)
        self.assertEqual(label, "Mediant")

        # 5. Parallel mode
        score, label = score_harmonic("8A", "11B")
        self.assertEqual(score, 60)
        self.assertEqual(label, "Parallel Mode")

        # 6. Whole tone move
        score, label = score_harmonic("8A", "10A")
        self.assertEqual(score, 55)
        self.assertEqual(label, "Whole Tone")

        # 7. Energy boost move (+7 steps)
        score, label = score_harmonic("8A", "3A")
        self.assertEqual(score, 40)
        self.assertEqual(label, "Tension Jump")

        # 8. Tritone
        score, label = score_harmonic("8A", "2A")
        self.assertEqual(score, 25)
        self.assertEqual(label, "Tritone")

        # 9. Semitone clash (-7 steps = +5 mod 12)
        score, label = score_harmonic("8A", "1A")
        self.assertEqual(score, 15)
        self.assertEqual(label, "Semitone Clash")

    def test_energy_score_sharp_fall(self):
        """Validates energy compatibility thresholds."""
        # 1. Same level: difference <= 10
        score, direction, intent = score_energy(50.0, 55.0)
        self.assertEqual(score, 85.0)
        self.assertEqual(direction, "same")
        self.assertEqual(intent, "Groove")

        # 2. Gradual rise: 10 < diff <= 40
        score, direction, intent = score_energy(50.0, 80.0)
        self.assertEqual(score, 80.0)
        self.assertEqual(direction, "build")
        self.assertEqual(intent, "Build")

        # 3. Gradual fall: -40 <= diff < -10
        score, direction, intent = score_energy(50.0, 20.0)
        self.assertEqual(score, 70.0)
        self.assertEqual(direction, "reset")
        self.assertEqual(intent, "Reset")

        # 4. Sharp rise: diff > 40
        score, direction, intent = score_energy(30.0, 80.0)
        self.assertEqual(score, 60.0)
        self.assertEqual(direction, "peak")
        self.assertEqual(intent, "Peak (risky)")

        # 5. Sharp fall: diff < -40
        score, direction, intent = score_energy(80.0, 30.0)
        self.assertEqual(score, 35.0)
        self.assertEqual(direction, "crash")
        self.assertEqual(intent, "Crash")

    def test_risk_penalties(self):
        """Validates the risk penalty deduction system."""
        # 1. Two bad dimensions: tempo < 40 and energy < 40 -> penalty 10
        track_info = {"bpm_confidence": "verified", "camelot_key": "8A"}
        penalty, flags = apply_risk_penalties(35.0, 50.0, 35.0, track_info, track_info)
        self.assertEqual(penalty, 10.0)
        self.assertEqual(flags[0]["type"], "two_bad_dimensions")

        # 2. Harmonic + tempo conflict: harmonic > 80 and tempo < 50 -> penalty 8
        penalty, flags = apply_risk_penalties(45.0, 90.0, 80.0, track_info, track_info)
        self.assertEqual(penalty, 8.0)
        self.assertEqual(flags[0]["type"], "harmonic_tempo_conflict")

        # 3. Both keys unknown -> penalty 5
        empty_info = {"bpm_confidence": "verified", "camelot_key": None}
        penalty, flags = apply_risk_penalties(100.0, 50.0, 80.0, empty_info, empty_info)
        self.assertEqual(penalty, 5.0)
        self.assertEqual(flags[0]["type"], "both_keys_unknown")

        # 4. BPM unknown -> penalty 15
        unkn_info = {"bpm_confidence": "unknown", "camelot_key": "8A"}
        penalty, flags = apply_risk_penalties(10.0, 50.0, 80.0, unkn_info, track_info)
        self.assertEqual(penalty, 15.0)
        self.assertEqual(flags[0]["type"], "bpm_unknown")

    # ---------------------------------------------------------------------------
    # Integration tests / Routes
    # ---------------------------------------------------------------------------

    def test_spotify_id_format_validation(self):
        """Validates Spotify base62 ID format regex helper."""
        self.assertTrue(validate_spotify_id("3n3Ppam7vgaVa1iaRUIOKE"))
        self.assertTrue(validate_spotify_id("0123456789abcdefghijkl"))
        self.assertFalse(validate_spotify_id("invalid_id_length"))
        self.assertFalse(validate_spotify_id("3n3Ppam7vgaVa1iaRUIOK!"))  # special char

    def test_playlist_import_idempotency(self):
        """Verifies 429 response when re-importing same playlist within 5 minutes."""
        self.login_user("usera@example.com")

        # Seed an import that happened 2 minutes ago
        pi = PlaylistImport(
            user_id=self.user_a.id,
            source_playlist_id="3n3Ppam7vgaVa1iaRUIOKE",
            playlist_name="Test Playlist",
            status="complete",
            imported_at=datetime.now(timezone.utc) - timedelta(minutes=2),
        )
        db.session.add(pi)
        db.session.commit()

        # Try to import again
        resp = self.client.post(
            "/music/roomba/api/roomba/import",
            data=json.dumps(
                {"playlist_id": "3n3Ppam7vgaVa1iaRUIOKE", "playlist_name": "Test Playlist"}
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 429)
        data = json.loads(resp.data.decode("utf-8"))
        self.assertIn("imported recently", data["error"])

    def test_playlist_import_ownership(self):
        """Verifies cross-user access to playlist detail is rejected."""
        # Setup playlist import for User B
        pi = PlaylistImport(
            user_id=self.user_b.id,
            source_playlist_id="3n3Ppam7vgaVa1iaRUIOKE",
            playlist_name="User B's Playlist",
            status="complete",
            is_active=True,
        )
        db.session.add(pi)
        db.session.commit()

        # Login as User A and attempt to fetch detail of User B's playlist import
        self.login_user("usera@example.com")
        resp = self.client.get(f"/music/roomba/api/roomba/playlist/{pi.id}")
        self.assertEqual(resp.status_code, 404)

    def test_transitions_ownership(self):
        """Verifies IDOR protection on transitions endpoint."""
        # Setup playlist and tracks for User B
        pi = PlaylistImport(
            user_id=self.user_b.id,
            source_playlist_id="3n3Ppam7vgaVa1iaRUIOKE",
            status="complete",
            is_active=True,
        )
        db.session.add(pi)
        db.session.flush()

        t1 = TrackIdentity(spotify_track_id="track1spotifyid", title="Track 1", artist="Artist 1")
        db.session.add(t1)
        db.session.flush()

        pt = PlaylistTrack(playlist_id=pi.id, track_id=t1.id, position=0)
        db.session.add(pt)
        db.session.commit()

        # Login as User A and request transitions for User B's playlist/track
        self.login_user("usera@example.com")
        resp = self.client.get(f"/music/roomba/api/roomba/transitions/{pi.id}/{t1.id}")
        self.assertEqual(resp.status_code, 403)

    def test_track_features_ownership(self):
        """Verifies that PUT features is scoped to user's playlist tracks."""
        # Setup track and playlist for User B only
        pi = PlaylistImport(
            user_id=self.user_b.id,
            source_playlist_id="3n3Ppam7vgaVa1iaRUIOKE",
            status="complete",
            is_active=True,
        )
        db.session.add(pi)
        db.session.flush()

        t1 = TrackIdentity(spotify_track_id="track1spotifyid", title="Track 1", artist="Artist 1")
        db.session.add(t1)
        db.session.flush()

        pt = PlaylistTrack(playlist_id=pi.id, track_id=t1.id, position=0)
        db.session.add(pt)
        db.session.commit()

        # Login as User A and try to update track features
        self.login_user("usera@example.com")
        resp = self.client.put(
            f"/music/roomba/api/roomba/track/{t1.id}/features",
            data=json.dumps({"camelot_key": "9A"}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 403)

    def test_camelot_key_validation(self):
        """Validates that Camelot key allowlist is enforced on updates."""
        # Setup playlist and track for User A
        pi = PlaylistImport(
            user_id=self.user_a.id,
            source_playlist_id="3n3Ppam7vgaVa1iaRUIOKE",
            status="complete",
            is_active=True,
        )
        db.session.add(pi)
        db.session.flush()

        t1 = TrackIdentity(spotify_track_id="track1spotifyid", title="Track 1", artist="Artist 1")
        db.session.add(t1)
        db.session.flush()

        pt = PlaylistTrack(playlist_id=pi.id, track_id=t1.id, position=0)
        db.session.add(pt)
        db.session.commit()

        self.login_user("usera@example.com")

        # Test invalid keys
        for invalid_key in ("13A", "8C", "abc", "0B", "12"):
            resp = self.client.put(
                f"/music/roomba/api/roomba/track/{t1.id}/features",
                data=json.dumps({"camelot_key": invalid_key}),
                content_type="application/json",
            )
            self.assertEqual(resp.status_code, 400)

        # Test valid key
        resp = self.client.put(
            f"/music/roomba/api/roomba/track/{t1.id}/features",
            data=json.dumps({"camelot_key": "11B"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)

    def test_n_plus_one_queries(self):
        """Asserts details API loads in batch (prevents N+1 query explosion)."""
        # Setup playlist with 10 tracks
        pi = PlaylistImport(
            user_id=self.user_a.id,
            source_playlist_id="3n3Ppam7vgaVa1iaRUIOKE",
            status="complete",
            is_active=True,
        )
        db.session.add(pi)
        db.session.flush()

        for idx in range(10):
            t = TrackIdentity(
                spotify_track_id=f"trackspotifyid{idx}", title=f"Track {idx}", artist="Artist"
            )
            db.session.add(t)
            db.session.flush()

            pt = PlaylistTrack(playlist_id=pi.id, track_id=t.id, position=idx)
            db.session.add(pt)

            # Seed annotations
            anno = TrackTempoAnnotation(
                track_id=t.id, canonical_bpm=120.0, confidence="verified", source="manual"
            )
            db.session.add(anno)

        db.session.commit()

        self.login_user("usera@example.com")

        # Count queries executed during the details call
        from sqlalchemy import event

        query_count = 0

        @event.listens_for(db.engine, "before_cursor_execute")
        def count_query(conn, cursor, statement, parameters, context, executemany):
            nonlocal query_count
            query_count += 1

        resp = self.client.get(f"/music/roomba/api/roomba/playlist/{pi.id}")
        self.assertEqual(resp.status_code, 200)

        # N+1 would cause >10 queries. Batch loading should be <= 6 queries (1 user query + 5 playlist queries).
        self.assertLessEqual(query_count, 6)

        # Clean listener
        event.remove(db.engine, "before_cursor_execute", count_query)

    def test_transition_candidate_compute_on_demand(self):
        """Verifies that transition candidates are computed on demand rather than at import."""
        # Setup playlist with 3 tracks for User A
        pi = PlaylistImport(
            user_id=self.user_a.id,
            source_playlist_id="3n3Ppam7vgaVa1iaRUIOKE",
            status="complete",
            is_active=True,
        )
        db.session.add(pi)
        db.session.flush()

        tracks = []
        for idx in range(3):
            t = TrackIdentity(
                spotify_track_id=f"trackspotifyid{idx}", title=f"Track {idx}", artist="Artist"
            )
            db.session.add(t)
            db.session.flush()
            tracks.append(t)

            pt = PlaylistTrack(playlist_id=pi.id, track_id=t.id, position=idx)
            db.session.add(pt)

            anno = TrackTempoAnnotation(
                track_id=t.id,
                canonical_bpm=120.0,
                camelot_key="8A",
                confidence="verified",
                source="manual",
            )
            db.session.add(anno)

        db.session.commit()

        # 1. Assert no candidates exist yet in DB
        self.assertEqual(TransitionCandidate.query.count(), 0)

        # 2. Trigger transitions for Track 0
        self.login_user("usera@example.com")
        resp = self.client.get(f"/music/roomba/api/roomba/transitions/{pi.id}/{tracks[0].id}")
        self.assertEqual(resp.status_code, 200)

        # 3. Assert candidates were created on demand (2 candidates: from 0->1, and 0->2)
        self.assertEqual(TransitionCandidate.query.count(), 2)

        # Assert both have from_track_id as tracks[0].id
        cands = TransitionCandidate.query.filter_by(from_track_id=tracks[0].id).all()
        self.assertEqual(len(cands), 2)
