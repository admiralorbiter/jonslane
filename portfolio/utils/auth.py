from functools import wraps

from flask import abort, session


def login_required(f):
    """Decorator to protect endpoints by requiring user session authentication."""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id"):
            abort(403)
        return f(*args, **kwargs)

    return decorated
