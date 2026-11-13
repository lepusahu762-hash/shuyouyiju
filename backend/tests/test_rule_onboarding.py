"""Offline guards for the standalone editor, using the existing snapshot API."""
from copy import deepcopy
from fastapi.testclient import TestClient
from app.main import create_app
from test_analysis import Model,seed
from test_ai import configured
from test_accounts import HEADERS,register


def test_independent_rule_snapshot_validity_and_guards_without_verification_task(tmp_path):
    with TestClient(create_app(configured(tmp_path),Model())) as c:
        pid,a,rule,sid=seed(c)
        head=c.get(f'/api/projects/{pid}/rule-snapshots').json();assert head['current_valid']
        fields={k:{'asset_id':v['asset_id'],'paragraph_id':v['paragraph_id'],'quote':v['quote']} for k,v in rule['sources'].items()}
        body={'previous_id':head['current_id'],'context_hash':head['context_hash'],'constraints':rule['constraints'],'sources':fields,'confirmed_fields':list(rule['constraints']),'unresolved':[],'change_reason':'独立网页编辑同类快照，无AI核验任务'}
        bad=deepcopy(body);bad['sources']['metric']['quote']='伪造来源'
        assert c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=bad).status_code==422
        assert c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json={**body,'confirmed_fields':[]}).status_code==409
        assert c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=body).status_code==201
        assert c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=body).status_code==409
        c.put(f"/api/assets/{a['id']}/fields",headers=HEADERS,json={'version':a['annotation_version'],'fields':{}})
        assert not c.get(f'/api/projects/{pid}/rule-snapshots').json()['current_valid']
        c.post('/api/auth/logout',headers=HEADERS);register(c,'rule-editor-other@example.com')
        assert c.get(f'/api/projects/{pid}/rule-snapshots').status_code==404
        assert c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=body).status_code==404
