import sqlite3

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from test_accounts import HEADERS, register
from test_calculations import request, run, setup


def test_delete_and_restore_existing_project_with_history(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path)
    raw = "编号,状态,选择,地区\n1,有效,满意,A\n2,有效,一般,B\n".encode()
    with TestClient(create_app(settings)) as client:
        project_id, table, _, _, _ = setup(client, raw)
        calculation = run(client, project_id, request(client, project_id, table))
        keep = client.post("/api/projects", json={"name": "保留项目"}, headers=HEADERS).json()
        cookie = client.cookies.get("syj_session")
    # Simulate the database of a local installation before this feature.
    with sqlite3.connect(tmp_path / "shuyouyiju.sqlite3") as db:
        db.execute("DROP TABLE deleted_projects")

    project = f"/api/projects/{project_id}"
    original = f"/api/assets/{table['id']}/original"
    history = f"/api/runs/{calculation['id']}"
    with TestClient(create_app(settings)) as owner:
        owner.cookies.set("syj_session", cookie)
        assert owner.get("/api/projects/deleted").json() == []
        assert owner.get(project).json()["asset_count"] == 2
        assert owner.delete(project).status_code == 403
        assert owner.delete(project, headers=HEADERS).status_code == 204
        assert owner.delete(project, headers=HEADERS).status_code == 204
        assert [p["id"] for p in owner.get("/api/projects").json()] == [keep["id"]]
        assert [p["id"] for p in owner.get("/api/projects/deleted").json()] == [project_id]
        for path in (project, f"{project}/assets", original, history):
            assert owner.get(path).status_code == 404
        with TestClient(owner.app) as other:
            register(other, "other@example.com")
            assert other.get("/api/projects/deleted").json() == []
            assert other.delete(project, headers=HEADERS).status_code == 404
            assert other.post(f"{project}/restore", headers=HEADERS).status_code == 404

    with TestClient(create_app(settings)) as restarted:
        restarted.cookies.set("syj_session", cookie)
        assert [p["id"] for p in restarted.get("/api/projects").json()] == [keep["id"]]
        assert restarted.post(f"{project}/restore", headers=HEADERS).json()["asset_count"] == 2
        assert restarted.get("/api/projects/deleted").json() == []
        assert restarted.get(original).content == raw
        assert restarted.get(history).json()["result"] == calculation["result"]
