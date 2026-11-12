"""Real SQLite/calculation integration, synthetic documents, zero model calls."""
import sqlite3
import json
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from app.rule_constraints import FIELDS
from test_accounts import register, HEADERS
from test_materials import upload
from test_calculations import condition, run, check


class NoModel:
    async def complete(self, *args, **kwargs):
        raise AssertionError("Revision workflows must never call a model")


def seed(client):
    register(client)
    pid = client.post('/api/projects', headers=HEADERS, json={'name': '独立合成修订验收', 'goal': 'verify'}).json()['id']
    raw = ('编号,纳入标记,服务评价\n' + '\n'.join(f'{i},是,{"满意" if i<=4 else "不满意" if i<=8 else ""}' for i in range(1,11))+'\n11,否,满意\n12,否,不满意\n').encode('utf-8-sig')
    table = upload(client, pid, '独立合成12行.csv', raw)
    report = client.post(f'/api/projects/{pid}/reports', headers=HEADERS, json={'name': '合成修订报告', 'text': '本期纳入记录的满意率为50%，参考指标也为50%。'}).json()
    para = client.get(f"/api/assets/{report['id']}/preview").json()['paragraphs'][0]
    rule = client.post(f'/api/projects/{pid}/reports', headers=HEADERS, json={'name': '合成统计规则', 'text': '本期纳入标记为是的全部记录进入分母，评价为空也保留。分子为服务评价为满意的记录，记录为单位、不去重，精度0位。'}).json()
    rp = client.get(f"/api/assets/{rule['id']}/preview").json()['paragraphs'][0]
    assert client.put(f"/api/projects/{pid}/rule-materials/{rule['id']}", headers=HEADERS, json={'enabled': True}).status_code == 200
    spec = {'asset_id': table['id'], 'sheet_id': 's1', 'operation': 'ratio', 'metric': '满意记录占比', 'scope_description': '本期纳入记录',
            'scope': [condition(table,1,'是')], 'numerator': [condition(table,2,'满意')], 'null_policy': 'keep', 'precision': 0}
    head = client.get(f'/api/projects/{pid}/rule-snapshots').json()
    response = client.post(f'/api/projects/{pid}/rule-snapshots', headers=HEADERS, json={
        'previous_id': None, 'context_hash': head['context_hash'], 'constraints': spec,
        'sources': {k: {'asset_id': rule['id'], 'paragraph_id': rp['id'], 'quote': rp['text']} for k in FIELDS},
        'confirmed_fields': list(FIELDS), 'unresolved': [], 'change_reason': '独立合成验收，人工确认全部口径。'})
    assert response.status_code == 201, response.text
    snapshot = response.json()
    context = client.get(f'/api/projects/{pid}/calculation-context').json()['context_hash']
    result = run(client, pid, {**spec, 'confirmed': True, 'context_hash': context})
    original = check(client, result['id'], report, para, '50')
    assert original['status'] == 'different'
    return pid, table, raw, original, snapshot


def save(client, pid, source, text, head=None, **changes):
    body = {'source_check_id': source['id'], 'target_index': 0, 'expected_head': head, 'text': text, 'action': 'edit', **changes}
    response = client.post(f'/api/projects/{pid}/revisions', headers=HEADERS, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def confirmation_body(client, pid, revision, source):
    context = client.get(f"/api/projects/{pid}/revision-source/{source['id']}").json()
    return {'expected_head': revision['id'], 'context_hash': context['context_hash'], 'rule_snapshot_id': context['current_rule']['id'],
            'plan': {**context['current_rule']['constraints'], 'confirmed': True, 'context_hash': context['context_hash']}, 'confirmed': True}


def confirm(client, pid, revision, source):
    response = client.post(f"/api/projects/{pid}/revisions/{revision['id']}/confirm", headers=HEADERS, json=confirmation_body(client,pid,revision,source))
    assert response.status_code == 201, response.text
    return response.json()


def recheck(client, pid, revision, confirmation):
    response = client.post(f"/api/projects/{pid}/revisions/{revision['id']}/recheck", headers=HEADERS, json={'expected_head': revision['id'], 'confirmation_id': confirmation['id']})
    assert response.status_code == 201, response.text
    return response.json()


def test_revision_accept_recheck_edit_keep_restore_persistence(tmp_path):
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings, NoModel())) as c:
        pid, table, raw, source, rule = seed(c)
        original = source['report']['paragraph']['text']
        text40 = original.replace('50%', '40%', 1)
        one = save(c,pid,source,text40,action='suggestion')
        assert one['status'] == 'pending' and not one['rechecks']
        assert one['basis']['source_check']['result'] == source['result']
        assert one['basis']['rule_snapshot'] == rule
        accepted = recheck(c,pid,one,confirm(c,pid,one,source))
        assert accepted['status'] == 'consistent'
        event = accepted['rechecks'][0]
        assert (event['run']['result']['numerator'],event['run']['result']['denominator']) == (4,10)
        assert len(c.get(f"/api/runs/{event['run']['id']}/evidence").json()['rows']) == 10
        assert c.get(f"/api/runs/{source['run_id']}/checks").json()['items'][0]['result'] == source['result']
        two = save(c,pid,source,original.replace('50%','45%',1),one['id'])
        assert recheck(c,pid,two,confirm(c,pid,two,source))['rechecks'][0]['result']['difference_pp'] == '-5'
        three = save(c,pid,source,original,two['id'],action='keep',reason='合成测试记录保留原句的决定，不代表通过。')
        kept = recheck(c,pid,three,confirm(c,pid,three,source))
        assert kept['status'] == 'different' and kept['rechecks'][0]['result']['difference_pp'] == '-10'
        restored = save(c,pid,source,text40,three['id'],action='restore',restored_from=one['id'])
        assert restored['version'] == 4 and restored['status'] == 'pending'
        assert restored['restored_from'] == one['id'] and restored['parent_id'] == three['id']
        saved_one = c.get(f"/api/projects/{pid}/revisions/{one['id']}").json()
        assert saved_one['text'] == text40 and saved_one['rechecks'][0]['result']['status'] == 'consistent'
        assert saved_one['status'] == 'stale'
        assert c.get(f"/api/assets/{table['id']}/original").content == raw
        cookie = c.cookies.get('syj_session')
    with TestClient(create_app(settings,NoModel())) as c:
        c.cookies.set('syj_session',cookie)
        assert c.get(f"/api/projects/{pid}/revisions/{restored['id']}").json()['basis'] == restored['basis']
        assert c.post('/api/auth/logout',headers=HEADERS).status_code == 204
        assert c.get(f"/api/projects/{pid}/revisions/{one['id']}").status_code == 401
        assert c.post('/api/auth/login',headers=HEADERS,data={'username':'owner@example.com','password':'Example123!'}).status_code == 204
        assert c.get(f"/api/projects/{pid}/revisions/{one['id']}").json()['rechecks'][0]['result'] == event['result']


def test_revision_targets_semantics_bypass_conflicts_and_rule_change(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path),NoModel())) as c:
        pid, table, raw, source, rule = seed(c)
        original = source['report']['paragraph']['text']
        one = save(c,pid,source,original.replace('50%','40%',1))
        body = confirmation_body(c,pid,one,source)
        for patch in [{'null_policy':'exclude'},{'scope':[]},{'precision':1}]:
            wrong = {**body,'plan':{**body['plan'],**patch}}
            assert c.post(f"/api/projects/{pid}/revisions/{one['id']}/confirm",headers=HEADERS,json=wrong).status_code == 409
        confirmation = confirm(c,pid,one,source)
        # Changes outside the selected token cannot be acknowledged away.
        for edited in [original.replace('本期','去年').replace('50%','40%',1),original.replace('纳入记录','全部客户').replace('50%','40%',1),original.replace('50%','40%')]:
            latest = c.get(f"/api/projects/{pid}/revision-source/{source['id']}").json()['head_id']
            version = save(c,pid,source,edited,latest)
            assert version['status'] == 'manual_required'
            assert c.post(f"/api/projects/{pid}/revisions/{version['id']}/confirm",headers=HEADERS,json=confirmation_body(c,pid,version,source)).status_code == 409
        assert c.post(f"/api/projects/{pid}/revisions/{one['id']}/recheck",headers=HEADERS,json={'expected_head':one['id'],'confirmation_id':confirmation['id']}).status_code == 409
        # Explicit second occurrence is separate and cannot replace the first.
        second = save(c,pid,source,'本期纳入记录的满意率为50%，参考指标也为40%。',target_index=1)
        assert second['status'] == 'pending' and second['target_index'] == 1
        cf = confirm(c,pid,second,source)
        head = c.get(f'/api/projects/{pid}/rule-snapshots').json()
        changed = { 'previous_id':head['current_id'],'context_hash':head['context_hash'],'constraints':{**rule['constraints'],'precision':1},
                    'sources':{k:{'asset_id':v['asset_id'],'paragraph_id':v['paragraph_id'],'quote':v['quote']} for k,v in rule['sources'].items()},
                    'confirmed_fields':list(FIELDS),'unresolved':[],'change_reason':'人工修改精度，旧确认必须失效。'}
        assert c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=changed).status_code == 201
        assert not c.get(f"/api/projects/{pid}/revisions/{second['id']}").json()['confirmation']['valid']
        assert c.post(f"/api/projects/{pid}/revisions/{second['id']}/recheck",headers=HEADERS,json={'expected_head':second['id'],'confirmation_id':cf['id']}).status_code == 409
        assert c.post(f"/api/projects/{pid}/revisions/{second['id']}/confirm",headers=HEADERS,json=confirmation_body(c,pid,second,source)).status_code == 409
        # Optimistic conflict, not last-write-wins.
        assert c.post(f'/api/projects/{pid}/revisions',headers=HEADERS,json={'source_check_id':source['id'],'target_index':1,'expected_head':None,'text':original,'action':'edit'}).status_code == 409


def test_revision_isolation_legacy_atomicity_and_idempotency(tmp_path):
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings,NoModel())) as c:
        pid,table,raw,source,rule=seed(c)
        revision=save(c,pid,source,source['report']['paragraph']['text'].replace('50%','40%',1))
        cf=confirm(c,pid,revision,source)
        checked=recheck(c,pid,revision,cf)
        assert len(recheck(c,pid,revision,cf)['rechecks']) == 1
        assert c.get(f'/api/projects/{pid}/runs').json()['total'] == 2
        owner=c.cookies.get('syj_session')
        c.cookies.clear();register(c,'another@example.com')
        for path in [f'/api/projects/{pid}/revisions/{revision["id"]}',f'/api/projects/{pid}/revision-source/{source["id"]}',f'/api/projects/{pid}/revision-sources']:
            assert c.get(path).status_code == 404
        assert c.post(f'/api/projects/{pid}/revisions',headers=HEADERS,json={'source_check_id':source['id'],'target_index':0,'expected_head':revision['id'],'text':revision['text'],'action':'edit'}).status_code == 404
        assert c.post(f"/api/projects/{pid}/revisions/{revision['id']}/confirm",headers=HEADERS,json=confirmation_body_for_foreign(revision,cf)).status_code == 404
        assert c.post(f"/api/projects/{pid}/revisions/{revision['id']}/recheck",headers=HEADERS,json={'expected_head':revision['id'],'confirmation_id':cf['id']}).status_code == 404
        otherpid=c.post('/api/projects',headers=HEADERS,json={'name':'其他账户'}).json()['id']
        assert c.get(f'/api/projects/{otherpid}/revision-source/{source["id"]}').status_code == 404
        assert c.get(f'/api/projects/{otherpid}/revisions/{revision["id"]}').status_code == 404
        assert c.get(f"/api/runs/{checked['rechecks'][0]['run']['id']}/evidence").status_code == 404
        c.cookies.clear();c.cookies.set('syj_session',owner)
        # Original legacy records remain byte-for-byte JSON unchanged on reads.
        with sqlite3.connect(tmp_path/'shuyouyiju.sqlite3') as db:
            before=db.execute('select report,spec,result from numeric_checks where id=?',(source['id'],)).fetchone()
        c.get(f'/api/projects/{pid}/revision-source/{source["id"]}')
        with sqlite3.connect(tmp_path/'shuyouyiju.sqlite3') as db:
            assert before==db.execute('select report,spec,result from numeric_checks where id=?',(source['id'],)).fetchone()
            # Simulate corrupted persisted plan: execute must re-validate rules.
            stored=db.execute('select snapshot from revision_confirmations where id=?',(cf['id'],)).fetchone()
            payload=json.loads(stored[0]);payload['plan']['null_policy']='exclude'
            db.execute('update revision_confirmations set snapshot=? where id=?',(json.dumps(payload),cf['id']))
        assert c.post(f"/api/projects/{pid}/revisions/{revision['id']}/recheck",headers=HEADERS,json={'expected_head':revision['id'],'confirmation_id':cf['id']}).status_code == 409


def confirmation_body_for_foreign(revision, cf):
    return {'expected_head':revision['id'],'context_hash':cf['context_hash'],'rule_snapshot_id':cf['rule_snapshot']['id'],'plan':cf['plan'],'confirmed':True}


def test_failed_recheck_rolls_back_calculation_and_data_change_invalidates(tmp_path, monkeypatch):
    from fastapi import HTTPException
    import app.revisions as revisions
    with TestClient(create_app(Settings(data_dir=tmp_path),NoModel())) as c:
        pid,table,raw,source,rule=seed(c)
        revision=save(c,pid,source,source['report']['paragraph']['text'].replace('50%','40%',1))
        cf=confirm(c,pid,revision,source)
        original_compare=revisions.compare_percentage
        def interrupted(*args,**kwargs):
            raise HTTPException(503,'合成测试：计算后、复核保存前中断。')
        monkeypatch.setattr(revisions,'compare_percentage',interrupted)
        body={'expected_head':revision['id'],'confirmation_id':cf['id']}
        response=c.post(f"/api/projects/{pid}/revisions/{revision['id']}/recheck",headers=HEADERS,json=body)
        assert response.status_code==503
        assert c.get(f'/api/projects/{pid}/runs').json()['total']==1
        assert not c.get(f"/api/projects/{pid}/revisions/{revision['id']}").json()['rechecks']
        monkeypatch.setattr(revisions,'compare_percentage',original_compare)
        recheck(c,pid,revision,cf)
        # Conservative existing dependency policy: newly added material invalidates.
        assert c.post(f'/api/projects/{pid}/reports',headers=HEADERS,json={'name':'新增合成资料','text':'本资料用于验证资料集合变化，不含新规则。'}).status_code==201
        updated=c.get(f"/api/projects/{pid}/revisions/{revision['id']}").json()
        assert updated['status']=='stale' and not updated['confirmation']['valid']
        assert updated['rechecks'][0]['result']['status']=='consistent'  # historical fact retained
        assert c.post(f"/api/projects/{pid}/revisions/{revision['id']}/recheck",headers=HEADERS,json=body).status_code==409


def test_legacy_check_without_rule_remains_read_only_basis(tmp_path):
    from test_calculations import setup,request
    with TestClient(create_app(Settings(data_dir=tmp_path),NoModel())) as c:
        pid,table,report,paragraphs,raw=setup(c)
        original=run(c,pid,request(c,pid,table))
        source=check(c,original['id'],report,paragraphs[0],'72')
        before=c.get(f"/api/runs/{original['id']}/checks").json()
        context=c.get(f"/api/projects/{pid}/revision-source/{source['id']}").json()
        assert context['rule_snapshot'] is None and context['check']['result']['status']=='different'
        response=c.post(f'/api/projects/{pid}/revisions',headers=HEADERS,json={'source_check_id':source['id'],'target_index':0,'expected_head':None,'text':paragraphs[0]['text'].replace('72%','80%'),'action':'edit'})
        assert response.status_code==409 and '历史核验' in response.text
        assert before==c.get(f"/api/runs/{original['id']}/checks").json()


def test_conflicting_manual_run_cannot_supply_accepted_suggestion(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path),NoModel())) as c:
        pid,table,raw,source,rule=seed(c)
        ctx=c.get(f'/api/projects/{pid}/calculation-context').json()['context_hash']
        wrongrun=run(c,pid,{**rule['constraints'],'null_policy':'exclude','confirmed':True,'context_hash':ctx})
        assert wrongrun['result']['display_value']=='50'
        report=source['report'];bad=check(c,wrongrun['id'],{'id':report['asset_id']},report['paragraph'],'50')
        # Existing manual computation remains available; it cannot bypass revision rules.
        context=c.get(f"/api/projects/{pid}/revision-source/{bad['id']}").json()
        assert context['source_rule_conflicts']==['空值策略']
        body={'source_check_id':bad['id'],'target_index':0,'expected_head':None,'text':report['paragraph']['text'],'action':'suggestion'}
        assert c.post(f'/api/projects/{pid}/revisions',headers=HEADERS,json=body).status_code==409
        draft=save(c,pid,bad,report['paragraph']['text'].replace('50%','40%',1))
        assert c.post(f"/api/projects/{pid}/revisions/{draft['id']}/confirm",headers=HEADERS,json=confirmation_body(c,pid,draft,bad)).status_code==409
