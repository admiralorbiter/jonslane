import os

# Load .env file for local development (must happen before config is read)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed — rely on real environment variables

from portfolio import create_app, db

# Determine the configuration to use
env = os.environ.get("FLASK_ENV", "development")
app = create_app(env)

# Ensure database tables exist and are seeded before handling requests
with app.app_context():
    db.create_all()
    from portfolio.models import seed_database

    seed_database()

if __name__ == "__main__":
    # Host on 127.0.0.1 and port 5000 by default
    app.run(host="127.0.0.1", port=5000)
