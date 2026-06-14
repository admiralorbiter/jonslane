import os
from typing import ClassVar

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
    SQLALCHEMY_ENGINE_OPTIONS: ClassVar[dict] = {"connect_args": {"timeout": 15}}

    # Cookie security headers
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False

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

    DEBUG = False
    SESSION_COOKIE_SECURE = True

    # Enforce SECRET_KEY in production env
    if not os.environ.get("SECRET_KEY") and os.environ.get("FLASK_ENV") == "production":
        raise RuntimeError("CRITICAL: SECRET_KEY environment variable is required in production!")


# Map configuration keys to environment strings
config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
