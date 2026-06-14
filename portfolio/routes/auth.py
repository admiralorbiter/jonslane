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
    next_page = request.args.get("next") or request.form.get("next") or ""

    # Secure validation of next redirect target to prevent Open Redirects
    is_safe = (
        next_page.startswith("/")
        and not next_page.startswith("//")
        and not next_page.startswith("\\")
    )
    redirect_target = next_page if is_safe else url_for("game.dashboard")

    if session.get("user_id"):
        return redirect(redirect_target)

    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")

        if not email or not password:
            flash("Email and password are required.", "error")
            return render_template("auth/login.html", next=next_page)

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            flash("Invalid email or password.", "error")
            return render_template("auth/login.html", next=next_page)

        # Establish session
        session.clear()
        session["user_id"] = user.id
        session.permanent = True

        flash(f"Connected as {user.display_name}!", "success")
        return redirect(redirect_target)

    return render_template("auth/login.html", next=next_page)


@auth_bp.route("/logout")
def logout():
    """Log out the current user session."""
    session.clear()
    flash("Disconnected successfully.", "info")
    return redirect(url_for("main.index"))
