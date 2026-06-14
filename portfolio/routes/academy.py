from flask import Blueprint, render_template, redirect, url_for, session, request, jsonify
from portfolio.models import User, Crate, db
from portfolio.utils.srs import get_due_anchors

academy_bp = Blueprint("academy", __name__, url_prefix="/academy")


@academy_bp.before_request
def require_login():
    """Globally enforce authentication for all Academy routes."""
    user_id = session.get("user_id")
    if not user_id:
        if request.path.startswith("/academy/api/"):
            return jsonify({"error": "Authentication required"}), 401
        return redirect(url_for("auth.login", next=request.path))

    # Stale session check: verify user exists in DB
    user = db.session.get(User, user_id)
    if not user:
        session.pop("user_id", None)
        if request.path.startswith("/academy/api/"):
            return jsonify({"error": "Authentication required"}), 401
        return redirect(url_for("auth.login", next=request.path))


@academy_bp.route("/")
def index():
    """Render the main Academy hub."""
    user_id = session.get("user_id")
    user = db.session.get(User, user_id)
    
    # Import stats dynamically to prevent early import cycles
    from portfolio.utils.academy_stats import get_user_academy_stats
    
    due_anchors = get_due_anchors(user_id)
    stats = get_user_academy_stats(user_id)
    crates = Crate.query.all()
    
    # Check if this is the user's first time (0 total attempts across both CMI and other modules)
    from portfolio.models import Attempt
    total_attempts = Attempt.query.filter_by(user_id=user_id).count()
    
    if total_attempts == 0:
        return redirect(url_for("academy.welcome"))
        
    return render_template(
        "academy/academy.html",
        user=user,
        due_anchors=due_anchors,
        stats=stats,
        crates=crates
    )


@academy_bp.route("/welcome")
def welcome():
    """Render the welcome onboarding page."""
    user_id = session.get("user_id")
    user = db.session.get(User, user_id)
    return render_template("academy/welcome.html", user=user)


@academy_bp.route("/api/skills")
def api_skills():
    """JSON API endpoint returning the raw 5-dimension skill profile."""
    user_id = session.get("user_id")
    from portfolio.utils.academy_stats import get_user_academy_stats
    stats = get_user_academy_stats(user_id)
    return jsonify(stats.get("skills", {}))
