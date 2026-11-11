from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
import sqlite3

HEADERS = {"X-Requested-With": "shuyouyiju", "Origin": "http://127.0.0.1:5173"}


def register(client, email="owner@example.com"):
    response = client.post("/api/auth/register", json={"email": email, "password": "Example123!"}, headers=HEADERS)
    assert response.status_code == 201, response.text
    response = client.post("/api/auth/login", data={"username": email, "password": "Example123!"}, headers=HEADERS)
    assert response.status_code == 204, response.text
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    return client.get("/api/auth/me").json()


def test_auth_project_persistence_and_isolation(tmp_path):
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)) as owner:
        assert owner.get("/api/projects").status_code == 401
        register(owner)
        assert owner.get("/api/projects").json() == []
        project = owner.post("/api/projects", json={"name": "校园调查", "goal": "analysis"}, headers=HEADERS).json()
        pid = project["id"]
        assert project["asset_count"] == 0
        assert owner.patch(f"/api/projects/{pid}", json={"name": "调查资料"}, headers=HEADERS).status_code == 200
        response = owner.put(f"/api/projects/{pid}/rules", json={"version": 0, "rules": {"definition": "满意人数 / 有效答题人数"}}, headers=HEADERS)
        assert response.status_code == 200
        assert owner.put(f"/api/projects/{pid}/rules", json={"version": 0, "rules": {}}, headers=HEADERS).status_code == 409
        assert len(owner.get("/api/projects?q=调查").json()) == 1
        assert owner.get("/api/projects?q=missing").json() == []
        cookie = owner.cookies.get("syj_session")
        # Use a second cookie jar, not a second app startup during active parsing.
        with TestClient(owner.app) as other:
            register(other, "second@example.com")
            assert other.get("/api/projects").json() == []
            assert other.get(f"/api/projects/{pid}").status_code == 404
            assert other.patch(f"/api/projects/{pid}", json={"name": "改名"}, headers=HEADERS).status_code == 404
            assert other.put(f"/api/projects/{pid}/rules", json={"version": 1, "rules": {}}, headers=HEADERS).status_code == 404
    with TestClient(create_app(settings)) as restarted:
        restarted.cookies.set("syj_session", cookie)
        assert restarted.get("/api/auth/me").status_code == 200
        result = restarted.get(f"/api/projects/{pid}").json()
        assert result["name"] == "调查资料"
        assert result["rules"]["definition"] == "满意人数 / 有效答题人数"
        assert restarted.post("/api/auth/logout", headers=HEADERS).status_code == 204
        assert restarted.get("/api/auth/me").status_code == 401
        restarted.cookies.set("syj_session", cookie)
        assert restarted.get("/api/auth/me").status_code == 401  # Server-side revocation.
        response = restarted.post("/api/auth/login", data={"username": "owner@example.com", "password": "Example123!"}, headers=HEADERS)
        assert response.status_code == 204
    with sqlite3.connect(tmp_path / "shuyouyiju.sqlite3") as db:
        stored = db.execute('SELECT hashed_password FROM "user"').fetchall()
        assert all(row[0].startswith("$argon2id$") and "Example123" not in row[0] for row in stored)


def test_errors_and_origin_guard(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        register(client)
        assert client.post("/api/auth/register", json={"email": "OWNER@example.com", "password": "Example123!"}, headers=HEADERS).status_code == 400
        assert client.post("/api/auth/login", data={"username": "owner@example.com", "password": "Wrong123"}, headers=HEADERS).status_code == 400
        assert client.post("/api/auth/register", json={"email": "bad", "password": "short"}, headers=HEADERS).status_code == 422
        weak = client.post("/api/auth/register", json={"email": "weak@example.com", "password": "abcdefgh"}, headers=HEADERS)
        assert weak.status_code == 400
        assert client.post("/api/projects", json={"name": ""}, headers=HEADERS).status_code == 422
        assert client.post("/api/projects", json={"name": "test"}).status_code == 403
        assert client.post("/api/auth/logout", headers={**HEADERS, "Origin": "https://unrelated.example"}).status_code == 403
