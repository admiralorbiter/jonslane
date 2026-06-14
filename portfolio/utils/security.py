import time

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer


def generate_challenge_token(
    true_bpm, crate_name, is_anchor=False, anchor_bpm=None, anchor_level=None
):
    """Generate a timed, cryptographically signed token containing true BPM, crate name, and anchor metadata."""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    payload = {
        "true_bpm": float(true_bpm),
        "crate_name": str(crate_name) if crate_name is not None else None,
        "timestamp": time.time(),
        "is_anchor": bool(is_anchor),
        "anchor_bpm": float(anchor_bpm) if anchor_bpm is not None else None,
        "anchor_level": int(anchor_level) if anchor_level is not None else None,
    }
    return serializer.dumps(payload)


def verify_challenge_token(token, max_age=600):
    """Verify and decode a challenge token. Returns decrypted data dict or None if invalid/expired."""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    try:
        # Check signature and enforce maximum token age (default 10 minutes)
        data = serializer.loads(token, max_age=max_age)
        return data
    except (SignatureExpired, BadSignature, TypeError, ValueError):
        return None
