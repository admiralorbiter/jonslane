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
    """Verify that the flagship essay standalone notepad reader renders successfully."""
    response = client.get("/ai-literacy-lab/same-song-louder-dance")
    assert response.status_code == 200
    assert b"Same_Song_Louder_Dance.txt - Notepad" in response.data
    assert b"Artificial intelligence has always been molded" in response.data
