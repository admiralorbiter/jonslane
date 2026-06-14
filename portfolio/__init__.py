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
    from portfolio.routes.game import game_bp
    from portfolio.routes.main import main_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(game_bp)

    return app
