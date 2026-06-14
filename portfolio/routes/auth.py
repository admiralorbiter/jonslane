from flask import Blueprint, flash, redirect, render_template, request, session, url_for

from portfolio.models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    """Registration is disabled. Users can only be created via the command-line script."""
    from flask import abort

    abort(403, description="Public registration is disabled. Only admins can create accounts.")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    """Log in an existing user."""
    if session.get("user_id"):
        return redirect(url_for("game.dashboard"))

    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")

        if not email or not password:
            flash("Email and password are required.", "error")
            return render_template("auth/login.html")

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            flash("Invalid email or password.", "error")
            return render_template("auth/login.html")

        # Establish session
        session.clear()
        session["user_id"] = user.id
        session.permanent = True

        flash(f"Connected as {user.display_name}!", "success")
        return redirect(url_for("game.dashboard"))

    return render_template("auth/login.html")


@auth_bp.route("/logout")
def logout():
    """Log out the current user session."""
    session.clear()
    flash("Disconnected successfully.", "info")
    return redirect(url_for("main.index"))
