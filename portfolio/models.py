from datetime import datetime, timezone

from sqlalchemy.orm import validates

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
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=True)
    current_streak = db.Column(db.Integer, nullable=False, default=0)
    max_streak = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password):
        """Hash and set the user's password."""
        from werkzeug.security import generate_password_hash

        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verify the user's password."""
        from werkzeug.security import check_password_hash

        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

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

    challenges = db.relationship(
        "Challenge", backref="crate", lazy=True, cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self):
        return f"<Crate {self.name}>"


class Challenge(db.Model):
    """Database model for generated game challenges."""

    __tablename__ = "challenges"

    id = db.Column(db.Integer, primary_key=True)
    crate_id = db.Column(
        db.Integer, db.ForeignKey("crates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    true_bpm = db.Column(db.Float, nullable=False)
    genre = db.Column(db.String(50), nullable=False)
    beat_recipe_json = db.Column(db.Text, nullable=True)  # custom JSON for synthesizers
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    attempts = db.relationship(
        "Attempt", backref="challenge", lazy=True, cascade="all", passive_deletes=True
    )

    def __repr__(self):
        return f"<Challenge true_bpm={self.true_bpm}>"


class Attempt(db.Model):
    """Database model for user challenge attempts."""

    __tablename__ = "attempts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    challenge_id = db.Column(
        db.Integer, db.ForeignKey("challenges.id", ondelete="SET NULL"), nullable=True, index=True
    )
    guessed_bpm = db.Column(db.Float, nullable=False)
    true_bpm = db.Column(db.Float, nullable=False)
    bpm_error = db.Column(db.Float, nullable=False)
    percent_error = db.Column(db.Float, nullable=False)
    score = db.Column(db.Integer, nullable=False, default=0)
    rating = db.Column(db.String(50), nullable=False)
    response_time_ms = db.Column(db.Integer, nullable=True)
    client_uuid = db.Column(db.String(100), unique=True, nullable=True)
    crate_name = db.Column(db.String(100), nullable=True)
    metrical_multiplier = db.Column(db.Float, nullable=False, default=1.0)
    tap_stability = db.Column(db.Float, nullable=True)
    is_anchor = db.Column(db.Boolean, nullable=False, default=False)
    anchor_bpm = db.Column(db.Integer, nullable=True)
    anchor_level = db.Column(db.Integer, nullable=True)
    module = db.Column(db.String(50), nullable=False, server_default="count_me_in")
    skill_tag = db.Column(db.String(50), nullable=True)
    input_method = db.Column(db.String(20), nullable=True)
    phase_error_ms = db.Column(db.Float, nullable=True)
    hand = db.Column(db.String(10), nullable=True)
    phrase_length = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    @validates("tap_stability")
    def validate_tap_stability(self, key, value):
        if value is None:
            return None

        try:
            val_float = float(value)
        except (TypeError, ValueError) as e:
            raise ValueError("tap_stability must be a valid float.") from e

        import math

        if math.isnan(val_float) or math.isinf(val_float):
            raise ValueError("tap_stability cannot be NaN or Infinity.")

        if not (0.0 <= val_float <= 5000.0):
            raise ValueError("tap_stability must be between 0.0 and 5000.0 ms.")

        return val_float

    __table_args__ = (
        db.Index("idx_attempts_user_created", "user_id", "created_at"),
        db.Index("idx_attempts_ari", "user_id", "is_anchor", "anchor_bpm", "created_at"),
        db.Index("idx_attempts_skill_profile", "user_id", "module", "skill_tag", "percent_error"),
        db.Index("idx_attempts_client_uuid", "client_uuid"),
    )


class ReferenceTrack(db.Model):
    """Database model for reference songs within DJ crates."""

    __tablename__ = "reference_tracks"

    id = db.Column(db.Integer, primary_key=True)
    crate_id = db.Column(
        db.Integer, db.ForeignKey("crates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = db.Column(db.String(150), nullable=False)
    artist = db.Column(db.String(150), nullable=False)
    bpm = db.Column(db.Integer, nullable=False)

    crate = db.relationship(
        "Crate",
        backref=db.backref(
            "reference_tracks", lazy=True, cascade="all, delete-orphan", passive_deletes=True
        ),
    )

    def __repr__(self):
        return f"<ReferenceTrack {self.title} - {self.artist}>"


class AnchorSchedule(db.Model):
    """Database model for user spaced repetition schedule per anchor BPM."""

    __tablename__ = "anchor_schedules"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    anchor_bpm = db.Column(db.Integer, nullable=False)
    ease_factor = db.Column(db.Float, nullable=False, default=2.5)
    interval_days = db.Column(db.Integer, nullable=False, default=1)
    repetitions = db.Column(db.Integer, nullable=False, default=0)
    next_review_at = db.Column(db.DateTime, nullable=True)
    last_reviewed_at = db.Column(db.DateTime, nullable=True)
    metrical_match_streak = db.Column(db.Integer, nullable=False, default=0)

    __table_args__ = (
        db.UniqueConstraint("user_id", "anchor_bpm"),
        db.Index("idx_schedules_due", "user_id", "next_review_at"),
    )

    def __repr__(self):
        return f"<AnchorSchedule user={self.user_id} anchor={self.anchor_bpm}>"


def seed_database():
    """Seed the database with initial Crates, Reference Songs, and a default guest user if needed."""
    from portfolio import db
    from portfolio.models import Crate, ReferenceTrack, User

    # Seed Default User if not exists
    if not User.query.first():
        default_user = User(display_name="Guest DJ")
        db.session.add(default_user)

    # Self-healing check to expand existing Dance-Pop & R&B Crate max BPM range from 120 to 136 (L3)
    dance_pop_exist = Crate.query.filter_by(name="Dance-Pop & R&B Crate").first()
    if dance_pop_exist and dance_pop_exist.max_bpm == 120:
        dance_pop_exist.max_bpm = 136
        db.session.commit()

    # Seed default Crates and Reference Tracks
    if not Crate.query.filter_by(name="Boom-Bap Hip Hop Crate").first():
        # Clear legacy crates to prevent key conflicts
        ReferenceTrack.query.delete()
        Crate.query.delete()

        hip_hop = Crate(
            name="Boom-Bap Hip Hop Crate",
            description="Mid-tempo classic and modern boom-bap grooves. Train your pocket rhythm on iconic hip hop beats.",
            min_bpm=90,
            max_bpm=99,
            genre="hip-hop",
            difficulty="Easy",
        )
        dance_pop = Crate(
            name="Dance-Pop & R&B Crate",
            description="Mainstream 2000s/2010s radio and club hits. Detect minor variations on driving pop/R&B rhythms.",
            min_bpm=100,
            max_bpm=136,
            genre="dance-pop",
            difficulty="Medium",
        )
        trap = Crate(
            name="Dubstep & Trap Crate",
            description="Bass-heavy half-time and double-time syncopation. Spot the metrical ambiguity between 135 and 145 BPM.",
            min_bpm=135,
            max_bpm=145,
            genre="trap",
            difficulty="Hard",
        )
        pop_punk = Crate(
            name="Pop-Punk & Indie Rock Crate",
            description="High-energy, fast-tempo rock and punk anthems. Focus on driving rhythms between 140 and 180 BPM.",
            min_bpm=140,
            max_bpm=180,
            genre="pop-punk",
            difficulty="Hard",
        )

        db.session.add_all([hip_hop, dance_pop, trap, pop_punk])
        db.session.flush()  # Populate IDs

        # 1. Hip Hop Tracks
        hip_hop_tracks = [
            {"title": "Nuthin' but a 'G' Thang", "artist": "Dr. Dre ft. Snoop Dogg", "bpm": 95},
            {"title": "C.R.E.A.M.", "artist": "Wu-Tang Clan", "bpm": 95},
            {"title": "Ms. Jackson", "artist": "Outkast", "bpm": 95},
            {"title": "Gangsta's Paradise", "artist": "Coolio", "bpm": 95},
            {"title": "99 Problems", "artist": "Jay-Z", "bpm": 95},
            {"title": "Shook Ones, Pt. II", "artist": "Mobb Deep", "bpm": 94},
            {"title": "Sure Shot", "artist": "Beastie Boys", "bpm": 98},
            {"title": "Gin and Juice", "artist": "Snoop Dogg", "bpm": 95},
            {"title": "Killing Me Softly", "artist": "The Fugees", "bpm": 92},
            {"title": "No Diggity", "artist": "Blackstreet", "bpm": 93},
            {"title": "Gold Digger", "artist": "Kanye West ft. Jamie Foxx", "bpm": 93},
            {"title": "Empire State of Mind", "artist": "Jay-Z ft. Alicia Keys", "bpm": 93},
            {"title": "Drop It Like It's Hot", "artist": "Snoop Dogg ft. Pharrell", "bpm": 93},
            {
                "title": "Buy U a Drank (Shawty Snappin')",
                "artist": "T-Pain ft. Yung Joc",
                "bpm": 93,
            },
            {"title": "Hate It or Love It", "artist": "The Game ft. 50 Cent", "bpm": 98},
            {"title": "Thrift Shop", "artist": "Macklemore & Ryan Lewis", "bpm": 95},
            {"title": "Nice For What", "artist": "Drake", "bpm": 95},
            {"title": "Blue World", "artist": "Mac Miller", "bpm": 95},
            {"title": "Lean Back", "artist": "Terror Squad", "bpm": 96},
            {"title": "Locked Up", "artist": "Akon", "bpm": 96},
            {"title": "Touch It", "artist": "Busta Rhymes", "bpm": 97},
            {"title": "Just A Lil Bit", "artist": "50 Cent", "bpm": 97},
            {"title": "Stand Up", "artist": "Ludacris", "bpm": 96},
            {"title": "Ass Like That", "artist": "Eminem", "bpm": 95},
            {"title": "Beautiful", "artist": "Snoop Dogg ft. Pharrell", "bpm": 97},
        ]
        for t in hip_hop_tracks:
            db.session.add(
                ReferenceTrack(
                    crate_id=hip_hop.id, title=t["title"], artist=t["artist"], bpm=t["bpm"]
                )
            )

        # 2. Dance-Pop & R&B Tracks
        dance_pop_tracks = [
            {"title": "Yeah!", "artist": "Usher ft. Lil Jon & Ludacris", "bpm": 105},
            {"title": "Party Rock Anthem", "artist": "LMFAO", "bpm": 130},
            {"title": "Shots", "artist": "LMFAO ft. Lil Jon", "bpm": 128},
            {"title": "Sandstorm", "artist": "Darude", "bpm": 136},
            {"title": "Hollaback Girl", "artist": "Gwen Stefani", "bpm": 110},
            {"title": "SexyBack", "artist": "Justin Timberlake", "bpm": 117},
            {"title": "Promiscuous", "artist": "Nelly Furtado ft. Timbaland", "bpm": 114},
            {"title": "Hips Don't Lie", "artist": "Shakira ft. Wyclef Jean", "bpm": 100},
            {"title": "Crazy In Love", "artist": "Beyoncé", "bpm": 99},
            {"title": "Can't Feel My Face", "artist": "The Weeknd", "bpm": 108},
            {"title": "Rude Boy", "artist": "Rihanna", "bpm": 102},
            {"title": "Gimme More", "artist": "Britney Spears", "bpm": 113},
            {"title": "1, 2 Step", "artist": "Ciara ft. Petey Pablo", "bpm": 113},
            {"title": "Uptown Funk", "artist": "Mark Ronson ft. Bruno Mars", "bpm": 115},
            {"title": "Let's Get It Started", "artist": "Black Eyed Peas", "bpm": 105},
            {"title": "Bootylicious", "artist": "Destiny's Child", "bpm": 104},
            {"title": "Want to Want Me", "artist": "Jason Derulo", "bpm": 114},
            {"title": "Sorry", "artist": "Justin Bieber", "bpm": 100},
            {"title": "Telephone", "artist": "Lady Gaga ft. Beyoncé", "bpm": 122},
            {"title": "Get Busy", "artist": "Sean Paul", "bpm": 100},
            {"title": "One Dance", "artist": "Drake ft. Wizkid & Kyla", "bpm": 104},
            {"title": "Get Lucky", "artist": "Daft Punk ft. Pharrell Williams", "bpm": 116},
            {"title": "Can't Stop the Feeling!", "artist": "Justin Timberlake", "bpm": 113},
            {"title": "Fade", "artist": "Kanye West", "bpm": 120},
            {"title": "Levels", "artist": "Avicii", "bpm": 128},
        ]
        for t in dance_pop_tracks:
            db.session.add(
                ReferenceTrack(
                    crate_id=dance_pop.id, title=t["title"], artist=t["artist"], bpm=t["bpm"]
                )
            )

        # 3. Dubstep & Trap Tracks
        trap_tracks = [
            {"title": "Scary Monsters and Nice Sprites", "artist": "Skrillex", "bpm": 140},
            {"title": "Harlem Shake", "artist": "Baauer", "bpm": 140},
            {"title": "I Can't Stop", "artist": "Flux Pavilion", "bpm": 140},
            {"title": "Promises", "artist": "Nero", "bpm": 140},
            {"title": "Cinema (Skrillex Remix)", "artist": "Benny Benassi", "bpm": 140},
            {"title": "Too Close", "artist": "Alex Clare", "bpm": 140},
            {"title": "Bonfire", "artist": "Knife Party", "bpm": 140},
            {"title": "Where Are Ü Now", "artist": "Jack Ü ft. Justin Bieber", "bpm": 140},
            {"title": "Who Gon Stop Me", "artist": "Kanye West & Jay-Z", "bpm": 140},
            {
                "title": "Crave You (Adventure Club Remix)",
                "artist": "Flight Facilities",
                "bpm": 140,
            },
            {"title": "Mosh Pit", "artist": "Flosstradamus", "bpm": 140},
            {"title": "Core", "artist": "RL Grime", "bpm": 140},
            {"title": "Mask Off", "artist": "Future", "bpm": 150},
            {"title": "Panda", "artist": "Desiigner", "bpm": 145},
            {"title": "Alone", "artist": "Marshmello", "bpm": 142},
            {"title": "Like A Bitch", "artist": "Zomboy", "bpm": 140},
            {"title": "Centipede", "artist": "Knife Party", "bpm": 140},
            {"title": "Sweet Shop", "artist": "Doctor P", "bpm": 140},
            {"title": "Shotgun", "artist": "Yellow Claw", "bpm": 140},
            {"title": "Higher Ground", "artist": "TNGHT", "bpm": 142},
            {"title": "Dum Dee Dum", "artist": "Keys N Krates", "bpm": 140},
            {"title": "Lullabies (Adventure Club Remix)", "artist": "Yuna", "bpm": 140},
            {"title": "Take Ü There", "artist": "Jack Ü ft. Kiesza", "bpm": 140},
            {"title": "Eyes on Fire (Zeds Dead Remix)", "artist": "Blue Foundation", "bpm": 140},
            {"title": "Bangarang", "artist": "Skrillex ft. Sirah", "bpm": 110},
        ]
        for t in trap_tracks:
            db.session.add(
                ReferenceTrack(crate_id=trap.id, title=t["title"], artist=t["artist"], bpm=t["bpm"])
            )

        # 4. Pop-Punk Tracks
        pop_punk_tracks = [
            {"title": "Mr. Brightside", "artist": "The Killers", "bpm": 148},
            {"title": "Sugar, We're Goin Down", "artist": "Fall Out Boy", "bpm": 162},
            {"title": "Thnks fr th Mmrs", "artist": "Fall Out Boy", "bpm": 155},
            {"title": "That's What You Get", "artist": "Paramore", "bpm": 165},
            {"title": "All The Small Things", "artist": "Blink-182", "bpm": 149},
            {"title": "What's My Age Again?", "artist": "Blink-182", "bpm": 158},
            {"title": "Holiday", "artist": "Green Day", "bpm": 147},
            {"title": "The Middle", "artist": "Jimmy Eat World", "bpm": 162},
            {"title": "Dear Maria, Count Me In", "artist": "All Time Low", "bpm": 181},
            {"title": "Sk8er Boi", "artist": "Avril Lavigne", "bpm": 150},
            {"title": "Girlfriend", "artist": "Avril Lavigne", "bpm": 164},
            {"title": "Ocean Avenue", "artist": "Yellowcard", "bpm": 174},
            {"title": "Take Me Out", "artist": "Franz Ferdinand", "bpm": 142},
            {"title": "1901", "artist": "Phoenix", "bpm": 144},
            {"title": "Dirty Little Secret", "artist": "The All-American Rejects", "bpm": 144},
            {
                "title": "My Songs Know What You Did in the Dark",
                "artist": "Fall Out Boy",
                "bpm": 152,
            },
            {"title": "I Write Sins Not Tragedies", "artist": "Panic! At The Disco", "bpm": 170},
            {"title": "American Idiot", "artist": "Green Day", "bpm": 186},
            {"title": "Fat Lip", "artist": "Sum 41", "bpm": 170},
            {"title": "I'm Not Okay (I Promise)", "artist": "My Chemical Romance", "bpm": 179},
            {"title": "Somebody Told Me", "artist": "The Killers", "bpm": 138},
            {"title": "Lifestyles of the Rich & Famous", "artist": "Good Charlotte", "bpm": 171},
            {"title": "The Anthem", "artist": "Good Charlotte", "bpm": 176},
            {"title": "Welcome to the Black Parade", "artist": "My Chemical Romance", "bpm": 97},
            {"title": "Seven Nation Army", "artist": "The White Stripes", "bpm": 124},
        ]
        for t in pop_punk_tracks:
            db.session.add(
                ReferenceTrack(
                    crate_id=pop_punk.id, title=t["title"], artist=t["artist"], bpm=t["bpm"]
                )
            )

    db.session.commit()
