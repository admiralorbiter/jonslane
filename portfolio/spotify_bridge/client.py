"""Spotify Web API client wrapper.

All functions accept an access_token string and return parsed JSON dicts
(or None on error / no content). Token refresh is handled at the route level
via get_valid_token() in routes.py.

Policy note: We only read metadata and playback state. We do NOT:
- Analyze the Spotify audio stream
- Synchronize visual media to Spotify playback
- Download or cache audio
- Request Audio Features or Audio Analysis endpoints
"""

import re

import requests
from flask import current_app

_API_BASE = "https://api.spotify.com/v1"


def _headers(access_token: str) -> dict:
    """Return the Authorization header for Spotify API calls."""
    return {"Authorization": f"Bearer {access_token}"}


def get_currently_playing(access_token: str) -> dict | None:
    """Fetch the user's current playback state.

    Endpoint: GET /me/player/currently-playing
    Scopes: user-read-currently-playing

    Returns:
        Parsed JSON dict if something is playing, or None if:
        - 204 No Content (nothing playing / no active device)
        - 401 Unauthorized (token needs refresh — caller should handle)
        - any other error
    """
    resp = requests.get(
        f"{_API_BASE}/me/player/currently-playing",
        headers=_headers(access_token),
        params={"additional_types": "track"},
        timeout=8,
    )
    if resp.status_code == 204:
        return None  # Nothing currently playing
    if resp.status_code == 401:
        return {"_error": "token_expired"}
    if not resp.ok:
        current_app.logger.warning(
            "Spotify now-playing error: %s %s", resp.status_code, resp.text[:200]
        )
        return None
    return resp.json()


def get_track(access_token: str, track_id: str) -> dict | None:
    """Fetch full track metadata including external IDs (ISRC).

    Endpoint: GET /tracks/{id}
    Scopes: none required beyond basic access

    Args:
        track_id: Spotify track ID (22-character base-62 string).
    """
    resp = requests.get(
        f"{_API_BASE}/tracks/{track_id}",
        headers=_headers(access_token),
        timeout=8,
    )
    if resp.status_code == 401:
        return {"_error": "token_expired"}
    if not resp.ok:
        current_app.logger.warning(
            "Spotify get-track error: %s %s", resp.status_code, resp.text[:200]
        )
        return None
    return resp.json()


def get_recently_played(access_token: str, limit: int = 10) -> dict | None:
    """Fetch the user's recently played tracks.

    Endpoint: GET /me/player/recently-played
    Scopes: user-read-recently-played

    Args:
        limit: Number of tracks to return (1-50).
    """
    resp = requests.get(
        f"{_API_BASE}/me/player/recently-played",
        headers=_headers(access_token),
        params={"limit": min(50, max(1, limit))},
        timeout=8,
    )
    if resp.status_code == 401:
        return {"_error": "token_expired"}
    if not resp.ok:
        current_app.logger.warning(
            "Spotify recently-played error: %s %s", resp.status_code, resp.text[:200]
        )
        return None
    return resp.json()


def parse_track_identity(track_obj: dict) -> dict:
    """Extract a normalized TrackIdentity-shaped dict from a Spotify track object.

    Works on both full track objects (from /tracks/{id}) and the item
    sub-object inside a currently-playing or recently-played response.

    Returns:
        dict with keys: spotify_track_id, isrc, title, artist, album,
                        album_art_url, duration_ms
    """
    artists = track_obj.get("artists", [])
    artist_str = ", ".join(a.get("name", "") for a in artists)

    images = track_obj.get("album", {}).get("images", [])
    # Prefer medium image (index 1), fallback to first available
    if len(images) > 1:
        art_url = images[1].get("url")
    elif images:
        art_url = images[0].get("url")
    else:
        art_url = None

    external_ids = track_obj.get("external_ids", {})
    isrc = external_ids.get("isrc")

    return {
        "spotify_track_id": track_obj.get("id", ""),
        "isrc": isrc,
        "title": track_obj.get("name", "Unknown Track"),
        "artist": artist_str or "Unknown Artist",
        "album": track_obj.get("album", {}).get("name"),
        "album_art_url": art_url,
        "duration_ms": track_obj.get("duration_ms"),
    }


_SPOTIFY_ID_RE = re.compile(r"^[A-Za-z0-9]{22}$")


def validate_spotify_id(spotify_id: str) -> bool:
    """Validate that the given string is a valid Spotify base62 ID."""
    if not spotify_id:
        return False
    return bool(_SPOTIFY_ID_RE.match(spotify_id))


def get_user_playlists(access_token: str, limit: int = 50) -> dict | None:
    """Fetch the user's Spotify playlists.

    Endpoint: GET /me/playlists
    Scopes: playlist-read-private, playlist-read-collaborative
    """
    resp = requests.get(
        f"{_API_BASE}/me/playlists",
        headers=_headers(access_token),
        params={"limit": min(50, max(1, limit))},
        timeout=8,
    )
    if resp.status_code == 401:
        return {"_error": "token_expired"}
    if not resp.ok:
        current_app.logger.warning(
            "Spotify user-playlists error: %s %s", resp.status_code, resp.text[:200]
        )
        return None
    return resp.json()


def get_playlist_tracks_all(
    access_token: str, playlist_id: str, max_tracks: int = 200
) -> tuple[list[dict], bool]:
    """Fetch all tracks from a playlist with full pagination.

    Spotify paginates at 100 items/page. Returns a tuple: (tracks, was_truncated).
    """
    tracks = []
    url = f"{_API_BASE}/playlists/{playlist_id}/tracks"
    params = {
        "limit": 50,
        "fields": "next,total,items(track(id,name,artists,album,duration_ms,external_ids))",
    }
    total = 0
    while url and len(tracks) < max_tracks:
        resp = requests.get(url, headers=_headers(access_token), params=params, timeout=10)
        if resp.status_code == 401:
            # Token expired mid-request, return what we have and mark as truncated or expired
            return tracks, True
        if not resp.ok:
            current_app.logger.warning(
                "Spotify playlist-tracks error: %s %s", resp.status_code, resp.text[:200]
            )
            break
        data = resp.json()
        total = data.get("total", 0)
        items = data.get("items", [])
        for item in items:
            track = item.get("track")
            if track and track.get("id"):
                tracks.append(track)
                if len(tracks) >= max_tracks:
                    break
        url = data.get("next")
        params = {}  # Next URL already has query parameters

    was_truncated = total > len(tracks)
    return tracks[:max_tracks], was_truncated
