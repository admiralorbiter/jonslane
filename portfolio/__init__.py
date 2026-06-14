import os

from flask import Flask
from flask_sqlalchemy import SQLAlchemy

# Initialize extensions
db = SQLAlchemy()


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

    # Register blueprints
    from portfolio.routes.auth import auth_bp
    from portfolio.routes.game import game_bp
    from portfolio.routes.main import main_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(game_bp)
    app.register_blueprint(auth_bp)

    # Inject current_user dynamically into all templates
    @app.context_processor
    def inject_current_user():
        from flask import session

        from portfolio.models import User

        user_id = session.get("user_id")
        current_user = User.query.get(user_id) if user_id else None
        return dict(current_user=current_user)

    return app
