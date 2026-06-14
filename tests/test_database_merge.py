import os
import sqlite3
import unittest

from portfolio import create_app, db
from portfolio.models import seed_database


class DatabaseMergeTestCase(unittest.TestCase):
    def setUp(self):
        """Set up testing context."""
        self.app = create_app("testing")
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()
        seed_database()

    def tearDown(self):
        """Teardown context."""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_database_merge_script(self):
        # Setup source database path inside tmp directory
        cmi_db_file = os.path.join(self.app.instance_path, "count_me_in_source_test.db")
        portfolio_db_file = os.path.join(self.app.instance_path, "portfolio_target_test.db")

        # Make sure directory exists
        os.makedirs(os.path.dirname(cmi_db_file), exist_ok=True)

        # Delete if exist
        for f in [cmi_db_file, portfolio_db_file]:
            if os.path.exists(f):
                os.remove(f)

        # 1. Create source database with dummy data
        source_conn = sqlite3.connect(cmi_db_file)
        source_cursor = source_conn.cursor()

        source_cursor.execute("""
            CREATE TABLE crates (
                id INTEGER PRIMARY KEY,
                name TEXT UNIQUE,
                description TEXT,
                min_bpm INTEGER,
                max_bpm INTEGER,
                genre TEXT,
                difficulty TEXT
            )
        """)
        source_cursor.execute("""
            CREATE TABLE attempts (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                challenge_id INTEGER,
                guessed_bpm REAL,
                true_bpm REAL,
                bpm_error REAL,
                percent_error REAL,
                score INTEGER,
                rating TEXT,
                response_time_ms INTEGER,
                client_uuid TEXT UNIQUE,
                crate_name TEXT,
                metrical_multiplier REAL,
                tap_stability REAL,
                is_anchor BOOLEAN,
                anchor_bpm REAL,
                anchor_level INTEGER,
                created_at TEXT
            )
        """)

        source_cursor.execute(
            "INSERT INTO crates VALUES (10, 'Sync Test Crate', 'Sync Crate Desc', 90, 100, 'house', 'Easy')"
        )
        source_cursor.execute(
            "INSERT INTO attempts VALUES (99, 1, NULL, 120.0, 120.0, 0.0, 0.0, 100, 'Tempo Wizard', NULL, 'test-uuid-999', 'Sync Test Crate', 1.0, NULL, 0, NULL, NULL, '2026-06-14T12:00:00')"
        )

        source_conn.commit()
        source_conn.close()

        # 2. Create target database (simulate portfolio.db)
        target_conn = sqlite3.connect(portfolio_db_file)
        target_cursor = target_conn.cursor()

        target_cursor.execute("""
            CREATE TABLE crates (
                id INTEGER PRIMARY KEY,
                name TEXT UNIQUE,
                description TEXT,
                min_bpm INTEGER,
                max_bpm INTEGER,
                genre TEXT,
                difficulty TEXT
            )
        """)
        target_cursor.execute("""
            CREATE TABLE attempts (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                challenge_id INTEGER,
                guessed_bpm REAL,
                true_bpm REAL,
                bpm_error REAL,
                percent_error REAL,
                score INTEGER,
                rating TEXT,
                response_time_ms INTEGER,
                client_uuid TEXT UNIQUE,
                crate_name TEXT,
                metrical_multiplier REAL,
                tap_stability REAL,
                is_anchor BOOLEAN,
                anchor_bpm INTEGER,  -- Int type in target
                anchor_level INTEGER,
                module TEXT DEFAULT 'count_me_in',
                skill_tag TEXT,
                input_method TEXT,
                phase_error_ms REAL,
                hand TEXT,
                phrase_length INTEGER,
                created_at TEXT
            )
        """)
        target_conn.commit()

        # 3. Execute the merge logic by attaching
        target_cursor.execute(f"ATTACH DATABASE '{cmi_db_file}' AS cmi")

        # Copy crates
        target_cursor.execute("INSERT OR IGNORE INTO main.crates SELECT * FROM cmi.crates")

        # Copy attempts (match columns explicitly because target has additional Academy columns)
        target_cursor.execute("PRAGMA cmi.table_info(attempts)")
        columns = [info[1] for info in target_cursor.fetchall()]
        cols_str = ", ".join(columns)

        target_cursor.execute(
            f"INSERT OR IGNORE INTO main.attempts ({cols_str}) SELECT {cols_str} FROM cmi.attempts"
        )
        target_conn.commit()

        # Verify copy succeeded
        target_cursor.execute("SELECT count(*) FROM main.crates")
        self.assertEqual(target_cursor.fetchone()[0], 1)

        target_cursor.execute("SELECT count(*) FROM main.attempts")
        self.assertEqual(target_cursor.fetchone()[0], 1)

        # Verify the record
        target_cursor.execute("SELECT client_uuid, rating, score FROM main.attempts WHERE id=99")
        row = target_cursor.fetchone()
        self.assertEqual(row[0], "test-uuid-999")
        self.assertEqual(row[1], "Tempo Wizard")
        self.assertEqual(row[2], 100)

        target_conn.close()

        # Clean up files
        for f in [cmi_db_file, portfolio_db_file]:
            if os.path.exists(f):
                os.remove(f)
