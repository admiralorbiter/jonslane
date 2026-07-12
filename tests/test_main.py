import pytest

from portfolio import create_app, db


@pytest.fixture
def client():
    app = create_app("testing")
    app.config["TESTING"] = True
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()


def test_home_page(client):
    """Verify that the home page renders successfully."""
    response = client.get("/")
    assert response.status_code == 200
    assert b"Jon's Lane" in response.data
    assert b"music / djon" in response.data
    assert b"AI Literacy Lab" in response.data


def test_music_page(client):
    """Verify that the music page renders successfully."""
    response = client.get("/music")
    assert response.status_code == 200
    assert b"djon's Space" in response.data
    assert b"Lil Jon" in response.data
    assert b"Still D.R.E. x Moonlight" in response.data


def test_ai_literacy_lab_page(client):
    """Verify that the AI Literacy Lab page renders successfully."""
    response = client.get("/ai-literacy-lab/")
    assert response.status_code == 200
    assert b"AI Literacy Lab" in response.data
    assert b"Same Song, Louder Dance" in response.data


def test_ai_lab_redirect(client):
    """Verify that shorthand /ai-lab redirects to canonical /ai-literacy-lab."""
    response = client.get("/ai-lab")
    assert response.status_code == 302
    assert response.location.endswith("/ai-literacy-lab/")


def test_same_song_essay_page(client):
    """Verify the flagship essay is served by the catch-all route (no dedicated route needed)."""
    response = client.get("/ai-literacy-lab/same-song-louder-dance")
    assert response.status_code == 200
    assert b"Same_Song_Louder_Dance.txt - Notepad" in response.data
    assert b"Artificial intelligence has always been molded" in response.data


def test_ai_lab_tools_page(client):
    """Verify that the tools section page renders with all content merged inline."""
    response = client.get("/ai-literacy-lab/tools")
    assert response.status_code == 200
    assert b"Tools" in response.data
    # All three formerly-separate sub-sections must appear on this one page
    assert b"Chatbots" in response.data
    assert b"gun ownership" in response.data  # gun metaphor from blockquote
    assert b"NotebookLM" in response.data


def test_ai_lab_dynamic_subpage_404(client):
    """Verify that visiting an invalid subpage path returns a 404."""
    response = client.get("/ai-literacy-lab/tools/invalid-filename")
    assert response.status_code == 404


def test_ai_lab_old_subpages_now_404(client):
    """Verify the retired sub-page URLs 404 — their content is now inline in tools.html."""
    for old_path in ["tools/chatbots", "tools/editor-vs-coder", "tools/deep-research"]:
        response = client.get(f"/ai-literacy-lab/{old_path}")
        assert response.status_code == 404, f"Expected 404 for retired path: {old_path}"


def test_ai_lab_security_traversal(client):
    """Verify that directory traversal attempts are blocked and return 404."""
    response = client.get("/ai-literacy-lab/tools/../../config")
    assert response.status_code == 404


def test_ai_lab_security_allowlist(client):
    """Verify that path segments with disallowed characters are blocked by allowlist guard."""
    response = client.get("/ai-literacy-lab/tools/bad%00path")
    assert response.status_code == 404


def test_space_physics_hub(client):
    """Verify that the Space & Physics landing page renders successfully."""
    response = client.get("/space-physics/")
    assert response.status_code == 200
    assert b"Space &amp; Physics" in response.data
    assert b"Expanding Universe" in response.data
    assert b"Redshift &amp; CMB" in response.data


def test_space_physics_subpages(client):
    """Verify all active space & physics subpages render successfully."""
    for page in [
        "particle-1d",
        "galilean-relativity",
        "special-relativity",
        "expanding-universe",
        "redshift-cmb",
        "quantum-wavefunction",
    ]:
        response = client.get(f"/space-physics/{page}")
        assert response.status_code == 200, f"Expected page {page} to load successfully"
        assert b"Space &amp; Physics" in response.data or b"Space & Physics" in response.data


def test_space_physics_404_and_traversal(client):
    """Verify that invalid subpages and traversal attempts under space-physics return 404."""
    assert client.get("/space-physics/invalid-subpage").status_code == 404
    assert client.get("/space-physics/particle-1d/../../config").status_code == 404
    assert client.get("/space-physics/bad%00path").status_code == 404
