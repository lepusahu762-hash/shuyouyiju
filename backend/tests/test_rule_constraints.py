"""All AI outputs here are offline constructs, not real model observations."""
import json
import sqlite3
import asyncio
from threading import Event
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from app.main import create_app
from app.calculations import calculate, RunRequest
from test_ai import ScriptedProvider, configured, start, choose, bind_confirmed_rule
from test_accounts import register, HEADERS
from test_materials import upload


class NullProvider(ScriptedProvider):
    value = '50'
    def __init__(self):
        super().__init__()
        self.value = '50'
    async def complete(self, messages, **kwargs):
        message, usage = await super().complete(messages, **kwargs)
        if '少量样本：' in messages[-1]['content']:
            data = json.loads(message['content'])
            data['plan']['scope'][0]['value'] = '是'
            data['plan']['null_policy'] = 'exclude'  # deliberate offline wrong suggestion
            message['content'] = json.dumps(data, ensure_ascii=False)
        return message, usage


def seed(client):
    register(client)
    pid = client.post('/api/projects',headers=HEADERS,json={'name':'独立合成空值回归','goal':'verify'}).json()['id']
    text = '编号,纳入标记,服务评价\n'+'\n'.join(f'{i},是,{"满意" if i<=4 else "不满意" if i<=8 else ""}' for i in range(1,11))+'\n11,否,满意\n12,否,不满意\n'
    table = upload(client,pid,'合成12条.csv',text.encode('utf-8-sig'))
    report = client.post(f'/api/projects/{pid}/reports',headers=HEADERS,json={'name':'合成报告','text':'纳入记录的满意率为50%。'}).json()
    para = client.get(f"/api/assets/{report['id']}/preview").json()['paragraphs'][0]
    rule = client.post(f'/api/projects/{pid}/reports',headers=HEADERS,json={'name':'明确保留空值的合成规则','text':'满意率：纳入标记为是的全部记录进入分母；服务评价为空也保留。分子为其中服务评价为满意的记录。不去重，记录为单位，保留空值，精度0位。'}).json()
    client.put(f"/api/projects/{pid}/rule-materials/{rule['id']}",headers=HEADERS,json={'enabled':True})
    task = choose(client,start(client,pid,report,para))
    fields = ['asset_id','sheet_id','operation','metric','scope_description','scope','numerator','null_policy','precision']
    constraints = {key:task['payload']['plan'][key] for key in fields}
    constraints['null_policy']='keep'
    return pid,table,task,constraints


def confirm_body(task, plan=None):
    return {'plan':{**(plan or task['payload']['draft_plan']), 'confirmed':True}, 'reported_value':'50',
            'rules_confirmed':True,'citation_ids':task['payload']['citation_ids'],
            'rule_snapshot_id':task['payload']['rule_snapshot']['id'],'resolution':'已核对原文，按已保存约束执行。'}


def test_wrong_null_direct_bypass_blocked_then_correct_40_and_restart(tmp_path):
    settings=configured(tmp_path)
    with TestClient(create_app(settings,NullProvider())) as client:
        pid,table,task,constraints=seed(client)
        assert task['rule_check']['status']=='needs_confirmation'
        task=bind_confirmed_rule(client,task,constraints)
        tid=task['id'];snapshot=task['payload']['rule_snapshot']
        assert task['rule_check']['status']=='conflict'
        conflict=task['rule_check']['conflicts'][0]
        assert conflict['field']=='null_policy' and conflict['required']=='keep' and '为空也保留' in conflict['source']['text']
        wrong=confirm_body(task)
        response=client.post(f'/api/ai-tasks/{tid}/confirm',headers=HEADERS,json=wrong)
        assert response.status_code==409 and '必须修正' in response.text
        assert client.get(f'/api/projects/{pid}/runs').json()['total']==0
        assert client.get('/api/ai-tasks/'+tid).json()['request_count']==3
        # Every supported constraint is checked, not just the null example.
        for field,value in [('precision',2),('scope',[]),('numerator',[{**constraints['numerator'][0],'value':'不满意'}]),('scope_description','其他范围'),('asset_id','foreign')]:
            changed={**wrong['plan'],'null_policy':'keep',field:value}
            assert client.post(f'/api/ai-tasks/{tid}/confirm',headers=HEADERS,json={**wrong,'plan':changed}).status_code in {409,422}
        corrected={**wrong['plan'],'null_policy':'keep','confirmed':False}
        checked=client.post(f'/api/ai-tasks/{tid}/plan-check',headers=HEADERS,json={'plan':corrected})
        assert checked.status_code==200 and not checked.json()['rule_check']['conflicts']
        response=client.post(f'/api/ai-tasks/{tid}/confirm',headers=HEADERS,json={**wrong,'plan':{**corrected,'confirmed':True}})
        assert response.status_code==200,response.text
        saved=client.get('/api/ai-tasks/'+tid).json()
        assert saved['rule_check']['status']=='confirmed' and saved['run']['result']['display_value']=='40'
        assert saved['run']['result']['denominator']==10 and saved['run']['result']['numerator']==4
        assert saved['check']['result']['difference_pp']=='-10' and saved['check']['status']=='different'
        assert saved['payload']['plan']['null_policy']=='exclude' and saved['payload']['confirmed_plan']['null_policy']=='keep'
        assert len(saved['payload']['plan_revisions'])>=2
        cookie=client.cookies.get('syj_session')
    with TestClient(create_app(settings,NullProvider())) as client:
        client.cookies.set('syj_session',cookie)
        restored=client.get('/api/ai-tasks/'+tid).json()
        assert restored['payload']==saved['payload'] and restored['check']['result']==saved['check']['result']
        assert client.get(f'/api/projects/{pid}/rule-snapshots').json()['items'][0]==snapshot
        assert client.post(f'/api/ai-tasks/{tid}/plan-check',headers=HEADERS,json={'plan':corrected}).status_code==409


def test_rules_change_execution_guard_history_and_foreign_access(tmp_path):
    settings=configured(tmp_path)
    with TestClient(create_app(settings,NullProvider())) as client:
        pid,table,task,constraints=seed(client)
        task=bind_confirmed_rule(client,task,constraints);tid=task['id'];first=task['payload']['rule_snapshot']
        head=client.get(f'/api/projects/{pid}/rule-snapshots').json()
        fields=list(constraints)
        source=first['sources']
        body={'previous_id':head['current_id'],'context_hash':head['context_hash'],'constraints':{**constraints,'precision':1},
              'sources':{k:{'asset_id':s['asset_id'],'paragraph_id':s['paragraph_id'],'quote':s['quote']} for k,s in source.items()},
              'confirmed_fields':fields,'unresolved':[],'change_reason':'人工明确保存新精度口径，保留旧快照。'}
        for patch in [{'unresolved':['范围有歧义']},{'confirmed_fields':['null_policy']},{'sources':{}}]:
            assert client.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json={**body,**patch}).status_code==409
        response=client.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=body)
        assert response.status_code==201,response.text
        second=response.json()
        assert client.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=body).status_code==409
        assert client.get('/api/ai-tasks/'+tid).json()['rule_check']['status']=='stale'
        assert client.post(f'/api/ai-tasks/{tid}/confirm',headers=HEADERS,json=confirm_body(task,{**task['payload']['draft_plan'],'null_policy':'keep'})).status_code==409
        assert client.post(f'/api/ai-tasks/{tid}/bind-rule',headers=HEADERS,json={'snapshot_id':first['id']}).status_code==409
        task=client.post(f'/api/ai-tasks/{tid}/bind-rule',headers=HEADERS,json={'snapshot_id':second['id']}).json()
        assert task['rule_check']['status']=='conflict'
        # Simulate a forged persisted confirmation then attempt execution retry.
        # The worker must reject BEFORE making any model request.
        with sqlite3.connect(tmp_path/'shuyouyiju.sqlite3') as db:
            payload=task['payload'];payload.update(confirmed_plan={**task['payload']['draft_plan'],'confirmed':True},confirmed_rule_id=second['id'],stage='execute')
            db.execute('update ai_tasks set status=?,payload=? where id=?',('failed',json.dumps(payload),tid));db.commit()
        client.post(f'/api/ai-tasks/{tid}/retry',headers=HEADERS)
        blocked=client.get('/api/ai-tasks/'+tid).json()
        assert blocked['status']=='failed' and blocked['request_count']==3 and not blocked['run_id']
        # Old records remain readable but have no retroactive pass label.
        with sqlite3.connect(tmp_path/'shuyouyiju.sqlite3') as db:
            payload.pop('rule_check_version');db.execute('update ai_tasks set payload=? where id=?',(json.dumps(payload),tid));db.commit()
        assert client.get('/api/ai-tasks/'+tid).json()['rule_check']['status']=='legacy'
        client.cookies.clear();register(client,'rule-foreign@example.com')
        assert client.get(f'/api/projects/{pid}/rule-snapshots').status_code==404
        assert client.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=body).status_code==404
        assert client.post(f'/api/ai-tasks/{tid}/bind-rule',headers=HEADERS,json={'snapshot_id':second['id']}).status_code==404
        assert client.post(f'/api/ai-tasks/{tid}/plan-check',headers=HEADERS,json={'plan':confirm_body(task)['plan']}).status_code==404


def test_rule_changed_after_confirmation_before_tool_response(tmp_path):
    class WaitingProvider(NullProvider):
        def __init__(self):
            super().__init__()
            self.entered, self.release = Event(), Event()
        async def complete(self, messages, **kwargs):
            if kwargs.get('tools') and kwargs['tools'][0]['function']['name'] == 'calculate_ratio':
                self.entered.set()
                await asyncio.to_thread(self.release.wait, 10)
            return await super().complete(messages, **kwargs)
    provider = WaitingProvider()
    with TestClient(create_app(configured(tmp_path), provider)) as client:
        pid, _, task, constraints = seed(client)
        task = bind_confirmed_rule(client, task, constraints)
        tid = task['id']
        plan = {**task['payload']['draft_plan'], 'null_policy': 'keep'}
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(client.post, f'/api/ai-tasks/{tid}/confirm', headers=HEADERS, json=confirm_body(task, plan))
            assert provider.entered.wait(5)
            head = client.get(f'/api/projects/{pid}/rule-snapshots').json()
            first = task['payload']['rule_snapshot']
            body = {'previous_id':first['id'], 'context_hash':head['context_hash'], 'constraints':{**constraints, 'precision':1},
                    'sources':{k:{'asset_id':v['asset_id'], 'paragraph_id':v['paragraph_id'], 'quote':v['quote']} for k,v in first['sources'].items()},
                    'confirmed_fields':list(constraints), 'unresolved':[], 'change_reason':'并发编辑后明确保存新精度，必须使运行中的旧确认失效。'}
            assert client.post(f'/api/projects/{pid}/rule-snapshots', headers=HEADERS, json=body).status_code == 201
            provider.release.set()
            assert future.result(timeout=5).status_code == 200
        saved = client.get('/api/ai-tasks/'+tid).json()
        assert saved['status'] == 'stale' and saved['rule_check']['status'] == 'stale'
        assert saved['payload']['confirmed_plan']['null_policy'] == 'keep'
        assert saved['request_count'] == 4 and not saved['run_id']
        assert client.get(f'/api/projects/{pid}/runs').json()['total'] == 0
        rebound = client.post(f'/api/ai-tasks/{tid}/bind-rule', headers=HEADERS, json={'snapshot_id':client.get(f'/api/projects/{pid}/rule-snapshots').json()['current_id']}).json()
        assert not rebound['payload'].get('confirmed_plan') and rebound['rule_check']['status'] == 'conflict'


def test_missing_fields_fake_sources_and_condition_semantics(tmp_path):
    with TestClient(create_app(configured(tmp_path), NullProvider())) as client:
        pid, _, task, constraints = seed(client)
        task = bind_confirmed_rule(client, task, constraints)
        snapshot = task['payload']['rule_snapshot']
        head = client.get(f'/api/projects/{pid}/rule-snapshots').json()
        body = {'previous_id':snapshot['id'], 'context_hash':head['context_hash'], 'constraints':constraints,
                'sources':{k:{'asset_id':s['asset_id'],'paragraph_id':s['paragraph_id'],'quote':s['quote']} for k,s in snapshot['sources'].items()},
                'confirmed_fields':list(constraints), 'unresolved':[], 'change_reason':'来源校验'}
        incomplete = {**constraints}; incomplete.pop('null_policy')
        assert client.post(f'/api/projects/{pid}/rule-snapshots', headers=HEADERS, json={**body,'constraints':incomplete}).status_code == 422
        body['sources']['null_policy']['quote'] = '编造的规则原文'
        assert client.post(f'/api/projects/{pid}/rule-snapshots', headers=HEADERS, json=body).status_code == 422
        same = {**task['payload']['draft_plan'], 'null_policy':'keep', 'scope':constraints['scope'] * 2}
        checked = client.post(f"/api/ai-tasks/{task['id']}/plan-check", headers=HEADERS, json={'plan':same}).json()
        assert not checked['rule_check']['conflicts']
        assert client.patch(f"/api/projects/{pid}/rule-snapshots/{snapshot['id']}", headers=HEADERS, json={}).status_code in {404,405}


def test_incomplete_model_suggestion_can_be_completed_manually(tmp_path):
    with TestClient(create_app(configured(tmp_path), NullProvider())) as client:
        pid, _, task, constraints = seed(client)
        task = bind_confirmed_rule(client, task, constraints)
        # A model returning null must stay null in the original suggestion;
        # the human-confirmed complete rule supplies the separate editable draft.
        with sqlite3.connect(tmp_path/'shuyouyiju.sqlite3') as db:
            payload = {**task['payload'], 'plan':None}
            payload.pop('draft_plan');payload.pop('rule_snapshot')
            db.execute('update ai_tasks set payload=? where id=?',(json.dumps(payload),task['id']));db.commit()
        bound = client.post(f"/api/ai-tasks/{task['id']}/bind-rule", headers=HEADERS, json={'snapshot_id':task['payload']['rule_snapshot']['id']})
        assert bound.status_code == 200
        bound = bound.json()
        assert bound['payload']['plan'] is None and bound['payload']['draft_plan']['null_policy'] == 'keep'
        assert not bound['payload']['draft_plan']['confirmed'] and not bound['rule_check']['conflicts']
