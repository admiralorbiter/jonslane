import getpass
import os
import sys

# Ensure the root project directory is at the front of the python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from portfolio import create_app, db
from portfolio.models import User


def main():
    print("=== Count Me In User Initialization Script ===")

    # Prompt for display name
    display_name = input("Enter Display Name / Alias [Default: Admin DJ]: ").strip()
    if not display_name:
        display_name = "Admin DJ"

    # Prompt for email
    email = input("Enter Email Address: ").strip()
    if not email:
        print("Error: Email address is required.")
        sys.exit(1)

    # Prompt for password securely using getpass
    password = getpass.getpass("Enter Password: ")
    if not password:
        print("Error: Password cannot be blank.")
        sys.exit(1)

    confirm_password = getpass.getpass("Confirm Password: ")
    if password != confirm_password:
        print("Error: Passwords do not match.")
        sys.exit(1)

    # Initialize app context to access DB session
    env = os.environ.get("FLASK_ENV", "development")
    app = create_app(env)

    with app.app_context():
        # Ensure database tables exist and schema upgrades (seed_database) are run
        db.create_all()
        from portfolio.models import seed_database

        seed_database()

        # Verify user uniqueness
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            print(f"Error: An account with email '{email}' already exists.")
            sys.exit(1)

        try:
            # Instantiate user
            new_user = User(email=email, display_name=display_name)
            new_user.set_password(password)

            db.session.add(new_user)
            db.session.commit()
            print(
                f"\n[Success] User '{display_name}' ({email}) successfully created in the database!"
            )
        except Exception as e:
            db.session.rollback()
            print(f"\n[Failure] Failed to write user to database: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
