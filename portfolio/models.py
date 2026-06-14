from datetime import datetime, timezone

from portfolio import db


class Project(db.Model):
    """Database model for portfolio projects, research, and experiments."""

    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(
        db.String(50), nullable=False, default="Project"
    )  # e.g., 'Project', 'Research', 'Experiment'

    # Links
    url = db.Column(db.String(255), nullable=True)
    github_url = db.Column(db.String(255), nullable=True)

    # Metadata
    tags_string = db.Column(db.String(255), nullable=True)  # Comma-separated list of tags
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    @property
    def tags(self):
        """Helper to get tags as a Python list."""
        if not self.tags_string:
            return []
        return [tag.strip() for tag in self.tags_string.split(",") if tag.strip()]

    @tags.setter
    def tags(self, tag_list):
        """Helper to set tags from a Python list."""
        if not tag_list:
            self.tags_string = ""
        else:
            self.tags_string = ",".join(tag_list)

    def __repr__(self):
        return f"<Project {self.title}>"


class User(db.Model):
    """Database model for application users."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    display_name = db.Column(db.String(100), nullable=False, default="Guest DJ")
    current_streak = db.Column(db.Integer, nullable=False, default=0)
    max_streak = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    attempts = db.relationship("Attempt", backref="user", lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.display_name}>"


class Crate(db.Model):
    """Database model for gameplay Crates."""

    __tablename__ = "crates"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=False)
    min_bpm = db.Column(db.Integer, nullable=False)
    max_bpm = db.Column(db.Integer, nullable=False)
    genre = db.Column(db.String(50), nullable=False)  # house, hip-hop, trap, beginner
    difficulty = db.Column(db.String(50), nullable=False, default="Medium")

    challenges = db.relationship("Challenge", backref="crate", lazy=True)

    def __repr__(self):
        return f"<Crate {self.name}>"


class Challenge(db.Model):
    """Database model for generated game challenges."""

    __tablename__ = "challenges"

    id = db.Column(db.Integer, primary_key=True)
    crate_id = db.Column(db.Integer, db.ForeignKey("crates.id"), nullable=False)
    true_bpm = db.Column(db.Float, nullable=False)
    genre = db.Column(db.String(50), nullable=False)
    beat_recipe_json = db.Column(db.Text, nullable=True)  # custom JSON for synthesizers
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    attempts = db.relationship("Attempt", backref="challenge", lazy=True)

    def __repr__(self):
        return f"<Challenge true_bpm={self.true_bpm}>"


class Attempt(db.Model):
    """Database model for user challenge attempts."""

    __tablename__ = "attempts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    challenge_id = db.Column(db.Integer, db.ForeignKey("challenges.id"), nullable=True)
    guessed_bpm = db.Column(db.Float, nullable=False)
    true_bpm = db.Column(db.Float, nullable=False)
    bpm_error = db.Column(db.Float, nullable=False)
    percent_error = db.Column(db.Float, nullable=False)
    score = db.Column(db.Integer, nullable=False, default=0)
    rating = db.Column(db.String(50), nullable=False)
    response_time_ms = db.Column(db.Integer, nullable=True)
    client_uuid = db.Column(db.String(100), unique=True, nullable=True)
    crate_name = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<Attempt guess={self.guessed_bpm} true={self.true_bpm}>"


def seed_database():
    """Seed the database with initial Crates and a default guest user if needed."""
    from portfolio import db
    from portfolio.models import Crate, User

    # Seed Default User if not exists
    if not User.query.first():
        default_user = User(display_name="Guest DJ")
        db.session.add(default_user)

    # Seed default Crates if they don't exist
    if not Crate.query.first():
        crates = [
            Crate(
                name="Beginner Crate",
                description="A gentle introduction to tempo training. Straightforward metronomic grooves with a clearly defined pulse to help you get started.",
                min_bpm=100,
                max_bpm=120,
                genre="beginner",
                difficulty="Easy",
            ),
            Crate(
                name="House Crate",
                description="The backbone of dance music. Steady 4-to-the-floor rhythms between 118 and 132 BPM. Train your ear to feel minor tempo variations.",
                min_bpm=118,
                max_bpm=132,
                genre="house",
                difficulty="Medium",
            ),
            Crate(
                name="Half-Time Trap Crate",
                description="Warning: Syncopation ahead! Trap beats can feel like a slow 70 BPM drag or a double-time 140 BPM rush. Spot the ambiguity.",
                min_bpm=65,
                max_bpm=80,
                genre="trap",
                difficulty="Hard",
            ),
        ]
        for crate in crates:
            db.session.add(crate)

    db.session.commit()
