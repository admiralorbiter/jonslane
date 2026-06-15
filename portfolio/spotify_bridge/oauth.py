"""Spotify OAuth helpers — Authorization Code Flow (server-side).

Usage:
    url = build_auth_url(state)
    tokens = exchange_code(code, redirect_uri)
    tokens = refresh_access_token(refresh_token)

All HTTP calls use the `requests` library. Credentials are pulled from
the Flask app config (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET).
"""

import base64
import secrets

import requests
from flask import current_app

_ACCOUNTS_BASE = "https://accounts.spotify.com"


def generate_state() -> str:
    """Generate a cryptographically random state string for CSRF protection."""
    return secrets.token_urlsafe(16)


def build_auth_url(state: str) -> str:
    """Build the Spotify OAuth authorization URL.

    Args:
        state: CSRF protection token stored in the user's session.

    Returns:
        Full authorization URL to redirect the user to.
    """
    params = {
        "client_id": current_app.config["SPOTIFY_CLIENT_ID"],
        "response_type": "code",
        "redirect_uri": current_app.config["SPOTIFY_REDIRECT_URI"],
        "scope": current_app.config["SPOTIFY_SCOPES"],
        "state": state,
        "show_dialog": "false",
    }
    from urllib.parse import urlencode

    return f"{_ACCOUNTS_BASE}/authorize?{urlencode(params)}"


def _auth_header() -> dict:
    """Return the Basic auth header required by Spotify token endpoints."""
    client_id = current_app.config["SPOTIFY_CLIENT_ID"]
    client_secret = current_app.config["SPOTIFY_CLIENT_SECRET"]
    creds = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    return {"Authorization": f"Basic {creds}"}


def exchange_code(code: str, redirect_uri: str) -> dict | None:
    """Exchange an authorization code for access + refresh tokens.

    Args:
        code: The authorization code returned by Spotify after user consent.
        redirect_uri: Must match the one registered in the Spotify developer app.

    Returns:
        dict with keys: access_token, refresh_token, expires_in, scope, token_type
        or None if the request failed.
    """
    resp = requests.post(
        f"{_ACCOUNTS_BASE}/api/token",
        headers={**_auth_header(), "Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        },
        timeout=10,
    )
    if not resp.ok:
        current_app.logger.warning(
            "Spotify token exchange failed: %s %s", resp.status_code, resp.text
        )
        return None
    return resp.json()


def refresh_access_token(refresh_token: str) -> dict | None:
    """Request a new access token using the stored refresh token.

    Args:
        refresh_token: The refresh token stored in SpotifyToken.

    Returns:
        dict with keys: access_token, expires_in, scope, token_type
        (Spotify may or may not return a new refresh_token — check before updating)
        or None if refresh failed (user should re-auth).
    """
    resp = requests.post(
        f"{_ACCOUNTS_BASE}/api/token",
        headers={**_auth_header(), "Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        timeout=10,
    )
    if not resp.ok:
        current_app.logger.warning(
            "Spotify token refresh failed: %s %s", resp.status_code, resp.text
        )
        return None
    return resp.json()
