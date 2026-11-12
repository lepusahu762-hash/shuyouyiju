"""Synthetic provider responses exercise real services; these are NOT live model acceptance."""
import json
import asyncio
import httpx
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.ai_provider import BailianProvider, AIError, configuration
from test_accounts import register, HEADERS
from test_calculations import setup, request


class ScriptedProvider:
    def __init__(self):
        self.value = '72'
        self.point = False
        self.failure = None
        self.bad_citation = False
        self.calls = 0

    async def complete(self, messages, tools=None, tool_choice=None, json_mode=False):
        self.calls += 1
        if self.failure:
            raise AIError(self.failure)
        if tools and tool_choice != 'none':
            name = tools[0]['function']['name']
            if name == 'search_rules':
                args = {'query': '满意 有效'}
            else:
                args = {'plan_hash': json.loads(messages[-1]['content'].split('。')[-1])['plan_hash']}
            return {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'call_test', 'type': 'function', 'function': {'name': name, 'arguments': json.dumps(args)}}]}, {'total_tokens': 123}
        if 'candidates' in messages[-1]['content']:
            source = json.loads(messages[-1]['content'].split('原文数据：')[1])
            return {'content': json.dumps({'candidates': [{'quote': source['excerpt'], 'reported_value': '8' if self.point else self.value,
                'metric': '满意占比', 'unit': 'percentage_point' if self.point else 'percent', 'scope': '有效记录',
                'supported': True, 'reason': ''}]}, ensure_ascii=False)}, {}
        catalog = json.loads(messages[-1]['content'].split('少量样本：')[1])
        table = catalog['tables'][0]
        columns = table['sheets'][0]['columns']
        citations = json.loads(messages[-2]['content'])
        plan = {'asset_id': table['asset_id'], 'sheet_id': 's1', 'operation': 'ratio', 'metric': '满意占比',
                'scope_description': '有效记录', 'scope': [{'column_id': columns[1]['id'], 'kind': 'text', 'value': '有效'}],
                'numerator': [{'column_id': columns[2]['id'], 'kind': 'text', 'value': '满意'}], 'null_policy': 'keep', 'precision': 0}
        return {'content': json.dumps({'plan': plan, 'citation_ids': ['forged'] if self.bad_citation else [citations[0]['citation_id']],
                                      'questions': ['请确认记录为统计单位及空值策略'], 'explanation': '以有效记录为分母，满意记录为分子。'}, ensure_ascii=False)}, {}


def configured(tmp_path, **kwargs):
    return Settings(_env_file=None, data_dir=tmp_path, ai_api_key='not-a-real-key', ai_base_url='https://dashscope.aliyuncs.com/compatible-mode/v1',
                    ai_model='test-model', ai_region='cn-beijing', **kwargs)


def rules(client, pid):
    asset = client.post(f'/api/projects/{pid}/reports', headers=HEADERS,
        json={'name': '合成统计规则', 'text': '满意率：以状态为有效的记录为分母，以其中反馈为满意的记录为分子。统计单位为记录，保留空值且不匹配。'}).json()
    assert client.put(f"/api/projects/{pid}/rule-materials/{asset['id']}", headers=HEADERS, json={'enabled': True}).status_code == 200
    return asset


def start(client, pid, report, paragraph):
    response = client.post(f'/api/projects/{pid}/ai-tasks', headers=HEADERS,
        json={'report_asset_id': report['id'], 'paragraph_id': paragraph['id']})
    assert response.status_code == 201, response.text
    return client.get('/api/ai-tasks/'+response.json()['id']).json()


def choose(client, task):
    response = client.post(f"/api/ai-tasks/{task['id']}/choose", headers=HEADERS, json={'index': 0})
    assert response.status_code == 200, response.text
    return client.get('/api/ai-tasks/'+task['id']).json()


def confirm(client, task, **changes):
    task = bind_confirmed_rule(client, task)
    payload = task['payload']
    response = client.post(f"/api/ai-tasks/{task['id']}/confirm", headers=HEADERS,
        json={'plan': {**payload['draft_plan'], 'confirmed': True}, 'reported_value': payload['candidates'][payload['selected']]['reported_value'],
              'rules_confirmed': True, 'citation_ids': payload['citation_ids'],
              'rule_snapshot_id': payload['rule_snapshot']['id'],
              'resolution': '已核对实际规则，以有效记录为分母，保留空值，不去重。', **changes})
    assert response.status_code == 200, response.text
    return client.get('/api/ai-tasks/'+task['id']).json()


def bind_confirmed_rule(client, task, constraints=None):
    if task['payload'].get('rule_snapshot'):
        return task
    fields = ['asset_id','sheet_id','operation','metric','scope_description','scope','numerator','null_policy','precision']
    plan = constraints or {key:task['payload']['plan'][key] for key in fields}
    head = client.get(f"/api/projects/{task['project_id']}/rule-snapshots").json()
    if head['items'] and head['items'][0]['constraints'] == plan:
        snapshot = head['items'][0]
    else:
        source = task['payload']['citations'][0]
        response = client.post(f"/api/projects/{task['project_id']}/rule-snapshots", headers=HEADERS, json={
            'previous_id':head['current_id'], 'context_hash':head['context_hash'], 'constraints':plan,
            'sources':{key:{'asset_id':source['asset_id'],'paragraph_id':source['citation_id'],'quote':source['text']} for key in fields},
            'confirmed_fields':fields,'unresolved':[],'change_reason':'合成测试逐项明确规则与原文对应关系。'})
        assert response.status_code == 201, response.text
        snapshot = response.json()
    response = client.post(f"/api/ai-tasks/{task['id']}/bind-rule", headers=HEADERS, json={'snapshot_id':snapshot['id']})
    assert response.status_code == 200, response.text
    return response.json()


def test_ai_workflow_persistence_stale_isolation_and_manual(tmp_path):
    provider = ScriptedProvider()
    settings = configured(tmp_path)
    with TestClient(create_app(settings, provider)) as client:
        pid, table, report, paras, raw = setup(client)
        rule = rules(client, pid)
        search = client.get(f'/api/projects/{pid}/rule-search?q=满意率').json()
        assert search['items'][0]['asset_id'] == rule['id']
        task = start(client, pid, report, paras[0])
        assert task['status'] == 'candidates'
        task = choose(client, task)
        assert task['status'] == 'awaiting_confirmation' and task['request_count'] == 3
        tid = task['id']
        assert client.post(f'/api/ai-tasks/{tid}/confirm', headers=HEADERS, json={'plan': {**task['payload']['plan'], 'confirmed': False}, 'reported_value': '72'}).status_code == 409
        result = confirm(client, task)
        assert result['status'] == 'completed', result
        assert result['request_count'] == 4 and result['tool_count'] == 2
        assert result['run']['result']['display_value'] == '80'
        assert result['check']['status'] == 'different' and result['check']['result']['difference_pp'] == '8'
        assert client.get(f"/api/runs/{result['run_id']}/evidence?group=numerator").json()['total'] == 144
        assert client.get(f"/api/assets/{table['id']}/original").content == raw
        provider.value = '80'
        good = confirm(client, choose(client, start(client, pid, report, paras[1])))
        assert good['check']['status'] == 'consistent'
        # Manual endpoint remains usable and shares history.
        assert client.post(f'/api/projects/{pid}/runs', headers=HEADERS, json=request(client, pid, table)).status_code == 201
        assert client.get(f'/api/projects/{pid}/runs').json()['total'] == 3
        cookie = client.cookies.get('syj_session')
        client.cookies.clear()
        register(client, 'foreign@example.com')
        for path in [f'/api/ai-tasks/{tid}', f'/api/projects/{pid}/ai-tasks', f'/api/projects/{pid}/rule-search?q=满意', f'/api/projects/{pid}/rule-materials']:
            assert client.get(path).status_code == 404
        for suffix, body in [('choose', {'index': 0}), ('confirm', {'plan': {**task['payload']['plan'], 'confirmed': True}, 'reported_value': '72'}), ('retry', {}), ('cancel', {})]:
            assert client.post(f'/api/ai-tasks/{tid}/{suffix}', headers=HEADERS, json=body).status_code == 404
        assert client.put(f"/api/projects/{pid}/rule-materials/{rule['id']}", headers=HEADERS, json={'enabled': False}).status_code == 404
    with TestClient(create_app(settings, provider)) as client:
        client.cookies.set('syj_session', cookie)
        restored = client.get('/api/ai-tasks/'+tid).json()
        assert restored['check']['result'] == result['check']['result']
        assert restored['payload']['confirmed_plan'] == result['payload']['confirmed_plan']
        assert client.put(f"/api/projects/{pid}/rule-materials/{rule['id']}", headers=HEADERS, json={'enabled': False}).status_code == 200
        stale = client.get('/api/ai-tasks/'+tid).json()
        assert stale['status'] == 'stale' and stale['run']['stale'] and stale['check']['stale']
        assert stale['check']['result']['difference_pp'] == '8'
        assert client.put(f"/api/projects/{pid}/rule-materials/{rule['id']}", headers=HEADERS, json={'enabled': True}).status_code == 200
        assert client.get('/api/ai-tasks/'+tid).json()['stale']  # role versions cannot silently roll back


def test_missing_rules_unsupported_forgery_budget_cancel_and_renamed_fields(tmp_path):
    provider = ScriptedProvider()
    with TestClient(create_app(configured(tmp_path), provider)) as client:
        pid, table, report, paras, _ = setup(client, ('任意编号,自定义资格,意见结果\n'+'\n'.join(f'{i},有效,满意' for i in range(200))).encode())
        missing = choose(client, start(client, pid, report, paras[0]))
        assert missing['status'] == 'insufficient' and not missing.get('run_id')
        rules(client, pid)
        provider.bad_citation = True
        forged = choose(client, start(client, pid, report, paras[0]))
        assert forged['status'] == 'failed' and '引用' in forged['error']
        provider.bad_citation = False
        renamed = choose(client, start(client, pid, report, paras[0]))
        assert renamed['payload']['plan']['scope'][0]['column_id'] == table['summary']['sheets'][0]['columns'][1]['id']
        report2 = client.post(f'/api/projects/{pid}/reports', headers=HEADERS, json={'name': '跨期报告', 'text': '满意率比去年提升8个百分点。'}).json()
        para2 = client.get(f"/api/assets/{report2['id']}/preview").json()['paragraphs'][0]
        provider.point = True
        unsupported = choose(client, start(client, pid, report2, para2))
        assert unsupported['status'] == 'insufficient' and not unsupported['run_id']
        provider.point = False
        cancelled = start(client, pid, report, paras[0])
        assert client.post(f"/api/ai-tasks/{cancelled['id']}/cancel", headers=HEADERS).json()['status'] == 'cancelled'
        assert client.post(f"/api/ai-tasks/{cancelled['id']}/choose", headers=HEADERS, json={'index': 0}).status_code == 409
        provider.failure = '模型请求超时。'
        failed = start(client, pid, report, paras[0])
        for _ in range(5):
            assert client.post(f"/api/ai-tasks/{failed['id']}/retry", headers=HEADERS).status_code == 200
        saved = client.get('/api/ai-tasks/'+failed['id']).json()
        assert saved['request_count'] == 6 and saved['status'] == 'failed' and not saved['run_id']
        assert client.post(f"/api/ai-tasks/{failed['id']}/retry", headers=HEADERS).status_code == 409


def test_unconfigured_and_provider_protocol(tmp_path, monkeypatch):
    with TestClient(create_app(Settings(_env_file=None, data_dir=tmp_path))) as client:
        pid, table, report, paras, _ = setup(client)
        config = client.get('/api/ai/config').json()
        assert not config['configured'] and 'SYJ_AI_API_KEY' in config['missing']
        assert 'key' not in json.dumps(config).lower().replace('syj_ai_api_key', '')
        assert client.post(f'/api/projects/{pid}/ai-tasks', headers=HEADERS,
            json={'report_asset_id': report['id'], 'paragraph_id': paras[0]['id']}).status_code == 503
    real_client = httpx.AsyncClient
    settings = configured(tmp_path)
    captured = []
    def handler(request):
        captured.append(json.loads(request.content))
        assert request.url.path == '/compatible-mode/v1/chat/completions'
        return httpx.Response(200, json={'choices': [{'message': {'content': '{"candidates":[]}'}, 'finish_reason': 'stop'}]})
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))
    response, _ = asyncio.run(BailianProvider(settings).complete([{'role': 'user', 'content': 'test'}], json_mode=True))
    assert response['content'] == '{"candidates":[]}' and captured[0]['model'] == 'test-model'
    assert captured[0]['response_format'] == {'type': 'json_object'}
    assert not configuration(Settings(ai_base_url='https://attacker.invalid/compatible-mode/v1'))['configured']
    assert not configuration(Settings(
        ai_api_key='x', ai_base_url='https://dashscope.aliyuncs.com/compatible-mode/v1', ai_model='qwen-plus', ai_region='ap-southeast-1'))['configured']
    for status, phrase in [(429, '限流'), (401, '鉴权'), (500, 'HTTP 500')]:
        monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(lambda req: httpx.Response(status)), **kwargs))
        with pytest.raises(AIError, match=phrase):
            asyncio.run(BailianProvider(settings).complete([]))
    def timeout(request):
        raise httpx.ReadTimeout('test-only')
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(timeout), **kwargs))
    with pytest.raises(AIError, match='超时'):
        asyncio.run(BailianProvider(settings).complete([]))
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(lambda req: httpx.Response(200, json={'unexpected':'format'})), **kwargs))
    with pytest.raises(AIError, match='格式错误'):
        asyncio.run(BailianProvider(settings).complete([]))


def test_conflicting_rules_malformed_output_and_modified_tool_plan(tmp_path):
    class GuardProvider(ScriptedProvider):
        bad_json = False
        tamper = False
        async def complete(self, messages, **kwargs):
            if self.bad_json:
                self.calls += 1
                return {'content': 'not JSON'}, {}
            message, usage = await super().complete(messages, **kwargs)
            if self.tamper and kwargs.get('tools') and kwargs['tools'][0]['function']['name'] == 'calculate_ratio':
                message['tool_calls'][0]['function']['arguments'] = '{"plan_hash":"modified","command":"untrusted command"}'
            return message, usage
    provider = GuardProvider()
    with TestClient(create_app(configured(tmp_path), provider)) as client:
        pid, table, report, paras, _ = setup(client)
        first = rules(client, pid)
        second = client.post(f'/api/projects/{pid}/reports', headers=HEADERS, json={'name': '不同口径规则', 'text': '满意率：以全部记录为分母，不筛选有效记录。'}).json()
        client.put(f"/api/projects/{pid}/rule-materials/{second['id']}", headers=HEADERS, json={'enabled':True})
        task = choose(client, start(client, pid, report, paras[0]))
        assert len(task['payload']['citations']) == 2 and any('冲突' in q for q in task['payload']['questions'])
        body = {'plan': {**task['payload']['plan'], 'confirmed': True}, 'reported_value':'72',
                'citation_ids': task['payload']['citation_ids'], 'rules_confirmed': False, 'resolution':'冲突尚未解决'}
        assert client.post(f"/api/ai-tasks/{task['id']}/confirm", headers=HEADERS, json=body).status_code == 409
        body['rules_confirmed'] = True
        body['citation_ids'] = ['invented-rule']
        assert client.post(f"/api/ai-tasks/{task['id']}/confirm", headers=HEADERS, json=body).status_code == 409
        assert client.get(f'/api/projects/{pid}/runs').json()['total'] == 0
        provider.tamper = True
        result = confirm(client, task, citation_ids=[task['payload']['citations'][0]['citation_id']])
        assert result['status'] == 'failed' and not result['run_id'] and '变更已确认方案' in result['error']
        provider.tamper = False
        provider.bad_json = True
        bad = start(client, pid, report, paras[0])
        assert bad['status'] == 'failed' and 'JSON' in bad['error'] and not bad['run_id']


def test_cancel_inflight_does_not_continue_tools(tmp_path):
    from threading import Event
    from concurrent.futures import ThreadPoolExecutor
    class WaitingProvider(ScriptedProvider):
        entered = Event()
        release = Event()
        async def complete(self, messages, **kwargs):
            self.entered.set()
            await asyncio.to_thread(self.release.wait, 8)
            return await super().complete(messages, **kwargs)
    provider = WaitingProvider()
    with TestClient(create_app(configured(tmp_path), provider)) as client:
        pid, table, report, paras, _ = setup(client)
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(client.post, f'/api/projects/{pid}/ai-tasks', headers=HEADERS,
                json={'report_asset_id':report['id'], 'paragraph_id':paras[0]['id']})
            assert provider.entered.wait(5)
            task = client.get(f'/api/projects/{pid}/ai-tasks').json()['items'][0]
            assert task['status'] == 'extracting' and task['request_count'] == 1
            assert client.post(f"/api/ai-tasks/{task['id']}/cancel", headers=HEADERS).json()['status'] == 'cancelled'
            provider.release.set()
            assert future.result(timeout=5).status_code == 201
        saved = client.get('/api/ai-tasks/'+task['id']).json()
        assert saved['status'] == 'cancelled' and not saved['run_id'] and saved['tool_count'] == 0
