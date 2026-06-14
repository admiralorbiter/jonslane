import os

from portfolio import create_app, db

# Determine the configuration to use
env = os.environ.get("FLASK_ENV", "development")
app = create_app(env)

# Ensure database tables exist before handling requests
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    # Host on 127.0.0.1 and port 5000 by default
    app.run(host="127.0.0.1", port=5000)
