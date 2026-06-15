import os

from flask import Flask
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData, event
from sqlalchemy.engine import Engine

# Define naming convention for SQLAlchemy metadata to support SQLite batch migrations
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# Initialize extensions
db = SQLAlchemy(metadata=MetaData(naming_convention=naming_convention))
migrate = Migrate()

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(key_func=get_remote_address, default_limits=[])



@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Set SQLite-specific pragmas for concurrency, timeouts, and foreign keys."""
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA busy_timeout=30000;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()
    except Exception:
        pass


def create_app(config_name="development"):
    """Application factory for the Flask portfolio site."""
    app = Flask(__name__, instance_relative_config=True)

    # Import configuration mapping
    from config import config_by_name

    app.config.from_object(config_by_name[config_name])

    # Ensure the instance folder exists for SQLite db storage
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db, render_as_batch=True)
    limiter.init_app(app)

    # Register blueprints
    from portfolio.routes.academy import academy_bp
    from portfolio.routes.auth import auth_bp
    from portfolio.routes.game import game_bp
    from portfolio.routes.main import main_bp
    from portfolio.routes.piano import piano_bp
    from portfolio.routes.settings import settings_bp
    from portfolio.spotify_bridge.routes import spotify_bp
    from portfolio.routes.roomba import roomba_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(game_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(academy_bp)
    app.register_blueprint(piano_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(spotify_bp)
    app.register_blueprint(roomba_bp)

    # Inject current_user dynamically into all templates
    @app.context_processor
    def inject_current_user():
        from flask import session

        from portfolio.models import User

        user_id = session.get("user_id")
        current_user = db.session.get(User, user_id) if user_id else None
        return dict(current_user=current_user)

    return app
