import hashlib
import io
import sqlite3
import zipfile
from fastapi.testclient import TestClient
from docx import Document
from openpyxl import Workbook
from app.config import Settings
from app.main import create_app
from test_accounts import register, HEADERS


def xlsx_bytes():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "学院调查"
    for row in [["学院", "有效人数", "满意人数"], ["A 学院", 60, 45], ["B 学院", 50, 45], ["C 学院", 70, 54]]:
        sheet.append(row)
    workbook.create_sheet("备注").append(["说明", "单位"])
    workbook["备注"].append(["合成测试数据", "人"])
    out = io.BytesIO()
    workbook.save(out)
    return out.getvalue()


def docx_bytes():
    doc = Document()
    doc.add_heading("校园调查报告", 0)
    doc.add_paragraph("本次回收问卷 200 份。")
    doc.add_paragraph("")
    doc.add_paragraph("有效问卷 180 份，满意人数 144 人。")
    doc.add_table(rows=1, cols=1).cell(0, 0).text = "表格中的段落"
    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def create_project(client):
    return client.post("/api/projects", json={"name": "资料测试", "goal": "verify"}, headers=HEADERS).json()["id"]


def upload(client, pid, filename, raw):
    response = client.post(f"/api/projects/{pid}/assets", files={"file": (filename, raw)}, headers=HEADERS)
    assert response.status_code == 201, response.text
    # TestClient waits for BackgroundTasks, while the HTTP response truthfully says uploaded.
    assert response.json()["status"] == "uploaded"
    return client.get("/api/assets/" + response.json()["id"]).json()


def test_parse_originals_sources_and_persistence(tmp_path):
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)) as client:
        register(client)
        pid = create_project(client)
        raw = "学院,人数,人数\nA,60,45\nB,,45\nC,70,54\n".encode("utf-8-sig")
        csv = upload(client, pid, "调查.csv", raw)
        assert csv["status"] == "ready"
        sheet = csv["summary"]["sheets"][0]
        assert sheet["row_count"] == 3
        assert [c["name"] for c in sheet["columns"]] == ["学院", "人数", "人数"]
        assert {i["code"] for i in sheet["issues"]} == {"duplicate_header", "null_values"}
        assert client.get(f"/api/assets/{csv['id']}/original").content == raw
        rows = client.get(f"/api/assets/{csv['id']}/preview?offset=1&limit=1").json()
        assert rows["total"] == 3 and rows["rows"][0]["source_row"] == 3 and rows["rows"][0]["cells"] == ["B", "", "45"]
        source = rows["rows"][0]["id"]
        fields = {sheet["columns"][1]["id"]: {"meaning": "有效答题人数", "unit": "人"}}
        assert client.put(f"/api/assets/{csv['id']}/fields", json={"version": 0, "fields": fields}, headers=HEADERS).status_code == 200
        assert client.put(f"/api/assets/{csv['id']}/fields", json={"version": 0, "fields": fields}, headers=HEADERS).status_code == 409
        assert client.put(f"/api/assets/{csv['id']}/fields", json={"version": 1, "fields": {"foreign": {"unit": "人"}}}, headers=HEADERS).status_code == 422
        xlsx = upload(client, pid, "调查.xlsx", xlsx_bytes())
        assert xlsx["status"] == "ready"
        assert [(s["name"], s["row_count"]) for s in xlsx["summary"]["sheets"]] == [("学院调查", 3), ("备注", 1)]
        preview = client.get(f"/api/assets/{xlsx['id']}/preview?sheet=s2").json()
        assert preview["rows"][0]["cells"] == ["合成测试数据", "人"]
        assert client.get(f"/api/assets/{xlsx['id']}/preview?sheet=s99").status_code == 404
        docx = upload(client, pid, "报告.docx", docx_bytes())
        assert docx["status"] == "ready"
        paras = client.get(f"/api/assets/{docx['id']}/preview").json()["paragraphs"]
        assert len(paras) == 4
        assert paras[2]["location"] == "body:4" and "144" in paras[2]["text"]
        assert paras[3]["location"] == "body:5:table:r1:c1:p1"
        pasted = client.post(f"/api/projects/{pid}/reports", json={"name": "粘贴报告", "text": "第一段\n\n第二段"}, headers=HEADERS).json()
        assert client.get(f"/api/assets/{pasted['id']}/preview").json()["paragraphs"][1]["location"] == "line:3"
        assert client.get(f"/api/projects/{pid}").json()["asset_count"] == 4
        cookie = client.cookies.get("syj_session")
    with TestClient(create_app(settings)) as restarted:
        restarted.cookies.set("syj_session", cookie)
        asset = restarted.get(f"/api/assets/{csv['id']}").json()
        assert asset["annotations"] == fields
        assert asset["sha256"] == hashlib.sha256(raw).hexdigest()
        assert restarted.get(f"/api/assets/{csv['id']}/preview?offset=1&limit=1").json()["rows"][0]["id"] == source
        assert restarted.get(f"/api/assets/{csv['id']}/original").content == raw
        assert restarted.get(f"/api/assets/{docx['id']}/preview").json()["paragraphs"] == paras


def test_failure_retry_and_file_authorization(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        register(client)
        pid = create_project(client)
        bad = upload(client, pid, "坏文件.xlsx", b"not a zip")
        assert bad["status"] == "failed" and bad["error"]
        aid = bad["id"]
        assert client.get(f"/api/assets/{aid}/original").content == b"not a zip"
        assert client.get(f"/api/assets/{aid}/preview").status_code == 409
        assert client.post(f"/api/assets/{aid}/retry", json={}, headers=HEADERS).status_code == 202
        assert client.get(f"/api/assets/{aid}").json()["status"] == "failed"
        assert client.post(f"/api/projects/{pid}/assets", files={"file": ("image.png", b"image")}, headers=HEADERS).status_code == 415
        assert client.post(f"/api/projects/{pid}/assets", files={"file": ("empty.csv", b"")}, headers=HEADERS).status_code == 422
        good = upload(client, pid, "normal.csv", b"x,y\n1,2\n")
        assert good["status"] == "ready"
        assert client.post(f"/api/assets/{good['id']}/retry", json={}, headers=HEADERS).status_code == 409
        # New identity must fail for every read and write endpoint, not just the UI.
        client.post("/api/auth/logout", headers=HEADERS)
        register(client, "intruder@example.com")
        for suffix in ["", "/preview", "/original"]:
            assert client.get(f"/api/assets/{aid}{suffix}").status_code == 404
        assert client.get(f"/api/projects/{pid}/assets").status_code == 404
        assert client.post(f"/api/assets/{aid}/retry", json={}, headers=HEADERS).status_code == 404
        assert client.put(f"/api/assets/{good['id']}/fields", json={"version": 0, "fields": {}}, headers=HEADERS).status_code == 404
        assert client.post(f"/api/projects/{pid}/assets", files={"file": ("x.csv", b"x\n1")}, headers=HEADERS).status_code == 404
        assert client.post(f"/api/projects/{pid}/reports", json={"name": "attack", "text": "body"}, headers=HEADERS).status_code == 404


def test_limits_encoding_and_interrupted_parse(tmp_path):
    settings = Settings(data_dir=tmp_path, max_rows=3, max_upload_bytes=1024)
    with TestClient(create_app(settings)) as client:
        register(client)
        pid = create_project(client)
        gb = upload(client, pid, "中文.csv", "名称;值\n甲;1\n乙;2".encode("gb18030"))
        assert gb["summary"]["encoding"] == "gb18030" and gb["summary"]["delimiter"] == ";"
        oversized = client.post(f"/api/projects/{pid}/assets", files={"file": ("big.csv", b"x" * 2048)}, headers=HEADERS)
        assert oversized.status_code == 413
        too_many = upload(client, pid, "rows.csv", b"a\n1\n2\n3\n4")
        assert too_many["status"] == "failed"
        malformed = upload(client, pid, "quote.csv", b'x,y\n"not closed,1')
        assert malformed["status"] == "failed"
        cookie = client.cookies.get("syj_session")
    with sqlite3.connect(tmp_path / "shuyouyiju.sqlite3") as db:
        db.execute("UPDATE assets SET status='parsing' WHERE id=?", (too_many["id"],))
        db.commit()
    with TestClient(create_app(settings)) as client:
        client.cookies.set("syj_session", cookie)
        interrupted = client.get(f"/api/assets/{too_many['id']}").json()
        assert interrupted["status"] == "failed" and "后台已重启" in interrupted["error"]
