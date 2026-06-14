import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Base configuration class."""

    # Security
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-key-change-this-in-production-198273"

    # Database (SQLite)
    SQLALCHEMY_DATABASE_URI = (
        os.environ.get("DATABASE_URL")
        or f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'portfolio.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # App options
    DEBUG = False
    TESTING = False


class DevelopmentConfig(Config):
    """Development configuration."""

    DEBUG = True


class TestingConfig(Config):
    """Testing configuration."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(Config):
    """Production configuration."""

    # In production, SECRET_KEY should be set in environment variables
    DEBUG = False


# Map configuration keys to environment strings
config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
