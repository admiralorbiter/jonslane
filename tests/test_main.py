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

def test_music_page(client):
    """Verify that the music page renders successfully."""
    response = client.get("/music")
    assert response.status_code == 200
    assert b"djon's Space" in response.data
    assert b"Usher" in response.data
    assert b"Still D.R.E. x Moonlight" in response.data
