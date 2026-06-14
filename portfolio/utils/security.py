import time
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask import current_app


def generate_challenge_token(true_bpm, crate_name):
    """Generate a timed, cryptographically signed token containing true BPM and crate name."""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    return serializer.dumps({
        "true_bpm": float(true_bpm),
        "crate_name": str(crate_name),
        "timestamp": time.time()
    })


def verify_challenge_token(token, max_age=600):
    """Verify and decode a challenge token. Returns decrypted data dict or None if invalid/expired."""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    try:
        # Check signature and enforce maximum token age (default 10 minutes)
        data = serializer.loads(token, max_age=max_age)
        return data
    except (SignatureExpired, BadSignature, TypeError, ValueError):
        return None
