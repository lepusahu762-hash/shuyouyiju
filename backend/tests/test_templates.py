from uuid import uuid4

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from test_accounts import HEADERS, register


DRAFT = {"name": "合成活动模板", "category": "反馈统计", "description": "测试用结构",
         "goal": "analysis", "rule_notes": "范围：【待确认】\n分子：【待确认】",
         "report_outline": "一、来源\n二、结果"}


def test_private_templates_snapshot_isolation_and_restart(tmp_path):
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)) as client:
        assert client.get('/api/templates').status_code == 401
        register(client)
        original = client.get('/api/templates').json()
        assert len(original) == 3 and all(t['builtin'] for t in original)
        saved = client.post('/api/templates', json=DRAFT, headers=HEADERS)
        assert saved.status_code == 201
        template = saved.json(); tid = template['id']
        apply = {'name': '模板创建的合成项目', 'version': 1, 'request_id': str(uuid4())}
        response = client.post(f'/api/templates/{tid}/projects', json=apply, headers=HEADERS)
        assert response.status_code == 201
        project = response.json(); pid = project['id']
        assert project['asset_count'] == 0 and project['rules'] == {} and project['rules_version'] == 0
        snapshots = client.get(f'/api/projects/{pid}/rule-snapshots').json()
        assert not snapshots['current_valid'] and not snapshots['current_id']
        assert client.get(f'/api/projects/{pid}/assets').json() == []
        assert client.post(f'/api/templates/{tid}/projects', json=apply, headers=HEADERS).json()['id'] == pid
        assert len(client.get('/api/projects').json()) == 1
        assert client.post(f'/api/templates/{tid}/projects', json={**apply, 'name': '不同请求'}, headers=HEADERS).status_code == 409
        edit = {**DRAFT, 'rule_notes': '新的草稿', 'version': 1}
        assert client.put(f'/api/templates/{tid}', json=edit, headers=HEADERS).json()['version'] == 2
        assert client.put(f'/api/templates/{tid}', json=edit, headers=HEADERS).status_code == 409
        assert client.post(f'/api/templates/{tid}/projects', json={**apply, 'request_id': str(uuid4())}, headers=HEADERS).status_code == 409
        snapshot = client.get(f'/api/projects/{pid}/template').json()['template']
        assert snapshot['rule_notes'] == DRAFT['rule_notes'] and snapshot['version'] == 1
        cookie = client.cookies.get('syj_session')
        client.post('/api/auth/logout', headers=HEADERS)
        register(client, 'template-other@example.com')
        assert all(t['builtin'] for t in client.get('/api/templates').json())
        assert client.put(f'/api/templates/{tid}', json=edit, headers=HEADERS).status_code == 404
        assert client.post(f'/api/templates/{tid}/projects', json={**apply, 'version': 2}, headers=HEADERS).status_code == 404
        assert client.get(f'/api/projects/{pid}/template').status_code == 404
        client.post('/api/auth/logout', headers=HEADERS)
        assert client.post('/api/auth/login', data={'username': 'owner@example.com', 'password': 'Example123!'}, headers=HEADERS).status_code == 204
        cookie = client.cookies.get('syj_session')
    with TestClient(create_app(settings)) as restarted:
        restarted.cookies.set('syj_session', cookie)
        assert next(t for t in restarted.get('/api/templates').json() if t['id'] == tid)['version'] == 2
        assert restarted.get(f'/api/projects/{pid}/template').json()['template'] == snapshot


def test_template_validation_builtins_and_origin(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        register(client)
        assert client.post('/api/templates', json=DRAFT).status_code == 403
        for bad in ({'name': '  '}, {'rule_notes': ' ', 'report_outline': ' '}, {'goal': 'admin'},
                    {'category': '未知'}, {'name': '长' * 121}, {'rule_notes': '长' * 10001},
                    {'confirmed': True}, {'owner_id': str(uuid4())}):
            assert client.post('/api/templates', json={**DRAFT, **bad}, headers=HEADERS).status_code == 422
        assert client.put('/api/templates/builtin-campus', json={**DRAFT, 'version': 1}, headers=HEADERS).status_code == 409
        for item in client.get('/api/templates').json():
            result = client.post(f"/api/templates/{item['id']}/projects", json={
                'name': item['name'], 'version': item['version'], 'request_id': str(uuid4())}, headers=HEADERS)
            assert result.status_code == 201
            project = result.json()
            assert project['goal'] == item['goal'] and not project['rules']
            assert client.get(f"/api/projects/{project['id']}/template").json()['template']['id'] == item['id']
        assert client.post('/api/templates/missing/projects', json={'name': '不存在', 'version': 1, 'request_id': str(uuid4())}, headers=HEADERS).status_code == 404
