import io
import csv
import sqlite3
from decimal import Decimal
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from test_accounts import register, HEADERS
from test_materials import upload
from app.calculations import calculate, RunRequest


def setup(client, raw=None):
    register(client)
    pid = client.post('/api/projects', json={'name': '合成计算验收'}, headers=HEADERS).json()['id']
    if raw is None:
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(['记录编号', '记录状态', '反馈选项', '分组'])
        writer.writerows([[str(i), '有效' if i <= 180 else '无效', '满意' if i <= 144 or i > 180 else '一般', '甲组' if i <= 100 else '乙组'] for i in range(1, 201)])
        raw = stream.getvalue().encode('utf-8-sig')
    table = upload(client, pid, '合成200.csv', raw)
    report_response = client.post(f'/api/projects/{pid}/reports', json={'name': '合成报告', 'text': '有效记录的满意占比为72%。\n有效记录的满意占比为80%。\n其他指标3.12%。\n其他指标33.33%。'}, headers=HEADERS)
    report = client.get('/api/assets/' + report_response.json()['id']).json()
    paragraphs = client.get(f"/api/assets/{report['id']}/preview").json()['paragraphs']
    return pid, table, report, paragraphs, raw


def condition(table, index, value, kind='text'):
    return {'column_id': table['summary']['sheets'][0]['columns'][index]['id'], 'kind': kind, 'value': value}


def request(client, pid, table, **changes):
    return {'asset_id': table['id'], 'sheet_id': 's1', 'operation': 'ratio', 'metric': '满意记录占比', 'scope_description': '有效记录',
            'scope': [condition(table, 1, '有效')], 'numerator': [condition(table, 2, '满意')], 'null_policy': 'keep',
            'precision': 0, 'confirmed': True,
            'context_hash': client.get(f'/api/projects/{pid}/calculation-context').json()['context_hash'], **changes}


def run(client, pid, body):
    response = client.post(f'/api/projects/{pid}/runs', json=body, headers=HEADERS)
    assert response.status_code == 201, response.text
    return response.json()


def check(client, rid, report, paragraph, value, **changes):
    response = client.post(f'/api/runs/{rid}/checks', json={'report_asset_id': report['id'], 'paragraph_id': paragraph['id'], 'reported_value': value, 'precision': 0, 'confirmed': True, **changes}, headers=HEADERS)
    assert response.status_code == 201, response.text
    return response.json()


def test_full_data_evidence_checks_and_restart(tmp_path):
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)) as client:
        pid, table, report, paragraphs, raw = setup(client)
        preview = client.get(f"/api/assets/{table['id']}/preview?offset=150&limit=10").json()
        assert len(preview['rows']) == 10 and preview['total'] == 200
        result = run(client, pid, request(client, pid, table))
        rid = result['id']
        stats = result['result']
        assert (stats['total'], stats['included'], stats['excluded'], stats['numerator'], stats['display_value']) == (200, 180, 20, 144, '80')
        assert stats['exact_fraction'] == {'numerator': 144, 'denominator': 180, 'percent_multiplier': 100}
        assert stats['unit'] == '记录/行'
        collected = {}
        for group, expected in [('all', 200), ('denominator', 180), ('numerator', 144), ('excluded', 20), ('unmatched', 36)]:
            ids = set()
            for offset in range(0, expected, 37):
                data = client.get(f'/api/runs/{rid}/evidence?group={group}&offset={offset}&limit=37').json()
                assert data['total'] == expected and len(data['rows']) <= 37
                ids.update(row['id'] for row in data['rows'])
            assert len(ids) == expected
            collected[group] = ids
        assert collected['numerator'] <= collected['denominator']
        assert not collected['excluded'] & collected['denominator']
        assert len(collected['numerator'] | collected['unmatched']) == 180
        bad = check(client, rid, report, paragraphs[0], '72')
        assert bad['status'] == 'different' and bad['result']['difference_pp'] == '8'
        good = check(client, rid, report, paragraphs[1], '80')
        assert good['status'] == 'consistent' and good['result']['difference_pp'] == '0'
        assert check(client, rid, report, paragraphs[1], '80', confirmed=False)['status'] == 'needs_confirmation'
        assert check(client, rid, report, paragraphs[0], '80')['status'] == 'needs_confirmation'
        cookie = client.cookies.get('syj_session')
        assert client.get(f"/api/assets/{table['id']}/original").content == raw
    with TestClient(create_app(settings)) as restarted:
        restarted.cookies.set('syj_session', cookie)
        assert restarted.get('/api/runs/'+rid).json()['result'] == stats
        assert restarted.get(f'/api/runs/{rid}/checks').json()['total'] == 4
        assert restarted.get(f'/api/runs/{rid}/evidence?offset=150').json()['rows'][0]['source_row'] == 152
        assert restarted.get(f'/api/projects/{pid}/runs?limit=1').json()['total'] == 1


def test_null_zero_invalid_and_conditions(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        pid, table, report, paras, _ = setup(client, '类别,状态,选择,地区\n1,有效,满意,甲\n2,有效,,甲\n3,,满意,甲\n4,无效,满意,甲\n'.encode())
        base = request(client, pid, table)
        keep = run(client, pid, base)
        assert keep['result']['null_rows'] == 2 and keep['result']['denominator'] == 2 and keep['result']['display_value'] == '50'
        excluded = run(client, pid, {**base, 'null_policy': 'exclude'})
        assert excluded['result']['denominator'] == 1 and excluded['result']['display_value'] == '100'
        assert excluded['result']['reasons']['null_excluded']['count'] == 2
        blocked = run(client, pid, {**base, 'null_policy': 'block'})
        assert blocked['status'] == 'needs_confirmation' and blocked['result']['display_value'] is None
        assert check(client, blocked['id'], report, paras[1], '80')['status'] == 'needs_confirmation'
        zero = run(client, pid, {**base, 'scope': [condition(table, 1, '不存在')]})
        assert zero['status'] == 'insufficient' and zero['result']['display_value'] is None
        assert check(client, zero['id'], report, paras[1], '80')['status'] == 'insufficient'
        both = run(client, pid, {**base, 'operation': 'count', 'scope': [condition(table, 1, '有效'), condition(table, 3, '甲')]})
        assert both['result']['display_value'] == '1'
        assert check(client, both['id'], report, paras[1], '80')['status'] == 'insufficient'
        for changed, code in [({'confirmed': False}, 409), ({'scope_description': ' '}, 409), ({'scope': [{'column_id': 'missing', 'value': 'a'}]}, 422), ({'precision': 8}, 422), ({'numerator': []}, 422), ({'sheet_id': 'missing'}, 422), ({'scope': [condition(table, 0, '1/0', 'number')]}, 422)]:
            assert client.post(f'/api/projects/{pid}/runs', json={**base, **changed}, headers=HEADERS).status_code == code
        numeric = run(client, pid, {**base, 'operation': 'count', 'scope': [condition(table, 0, '1.0', 'number')], 'numerator': []})
        assert numeric['result']['display_value'] == '1'


def test_rounding_is_exact_and_no_tolerance(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        raw = ('自定义编号,资格,结果\n' + '\n'.join(f'{i},Y,{"hit" if i == 1 else "miss"}' for i in range(1, 33))).encode()
        pid, table, report, paras, _ = setup(client, raw)
        base = request(client, pid, table, scope=[condition(table, 1, 'Y')], numerator=[condition(table, 2, 'hit')], precision=2)
        result = run(client, pid, base)
        assert result['result']['unrounded_decimal'] == '3.125'
        assert result['result']['display_value'] == '3.13'
        difference = check(client, result['id'], report, paras[2], '3.12', precision=2)
        assert difference['status'] == 'different' and difference['result']['difference_pp'] == '0.01'
        assert check(client, result['id'], report, paras[2], '3.12', precision=1)['status'] == 'needs_confirmation'
        repeated = run(client, pid, {**base, 'scope': [condition(table, 0, '1'), condition(table, 1, 'Y')], 'precision': 6})
        assert repeated['result']['display_value'] == '100.000000'


def test_immutable_snapshots_stale_context_and_account_isolation(tmp_path):
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)) as client:
        pid, table, report, paragraphs, _ = setup(client)
        base = request(client, pid, table)
        saved = run(client, pid, base)
        rid = saved['id']
        verified = check(client, rid, report, paragraphs[1], '80')
        assert not verified['stale']
        response = client.put(f'/api/projects/{pid}/rules', json={'version': 0, 'rules': {'scope': '改为甲组'}}, headers=HEADERS)
        assert response.status_code == 200
        stale = client.get('/api/runs/'+rid).json()
        assert stale['status'] == 'stale' and stale['result'] == saved['result'] and stale['context']['rules'] == {}
        assert client.get(f'/api/runs/{rid}/checks').json()['items'][0]['status'] == 'stale'
        assert client.post(f'/api/projects/{pid}/runs', json=base, headers=HEADERS).status_code == 409
        again = run(client, pid, request(client, pid, table))
        column = table['summary']['sheets'][0]['columns'][0]['id']
        assert client.put(f"/api/assets/{table['id']}/fields", json={'version': 0, 'fields': {column: {'meaning': '记录编号'}}}, headers=HEADERS).status_code == 200
        assert client.get('/api/runs/'+again['id']).json()['stale']
        third = run(client, pid, request(client, pid, table))
        upload(client, pid, '新资料.csv', b'new\n1\n')
        assert client.get('/api/runs/'+third['id']).json()['stale']
        owner_cookie = client.cookies.get('syj_session')
        client.cookies.clear()
        register(client, 'other@example.com')
        for url in [f'/projects/{pid}/runs', f'/projects/{pid}/calculation-context', f'/runs/{rid}', f'/runs/{rid}/evidence', f'/runs/{rid}/checks']:
            assert client.get('/api'+url).status_code == 404
        assert client.post(f'/api/projects/{pid}/runs', json=base, headers=HEADERS).status_code == 404
        assert client.post(f'/api/runs/{rid}/checks', json={'report_asset_id': report['id'], 'paragraph_id': paragraphs[1]['id'], 'reported_value': '80', 'precision': 0, 'confirmed': True}, headers=HEADERS).status_code == 404
        other_pid = client.post('/api/projects', json={'name': 'other'}, headers=HEADERS).json()['id']
        context_hash = client.get(f'/api/projects/{other_pid}/calculation-context').json()['context_hash']
        assert client.post(f'/api/projects/{other_pid}/runs', json={**base, 'context_hash': context_hash}, headers=HEADERS).status_code == 404
        client.cookies.clear()
        client.cookies.set('syj_session', owner_cookie)
        final = client.get('/api/runs/'+rid).json()
        assert final['source'] == saved['source']
        assert client.get(f'/api/runs/{rid}/evidence?group=numerator').json()['total'] == 144
    # Simulate future parsed-content replacement; historical row snapshots remain unchanged.
    with sqlite3.connect(tmp_path / 'shuyouyiju.sqlite3') as db:
        db.execute('UPDATE assets SET result = NULL WHERE id = ?', (table['id'],))
    with TestClient(create_app(settings)) as restored:
        restored.cookies.set('syj_session', owner_cookie)
        assert restored.get('/api/runs/'+rid).json()['stale']
        assert restored.get(f'/api/runs/{rid}/evidence?group=numerator').json()['rows'][0]['cells'][1] == '有效'


def test_percentage_original_sign_and_exact_recurring_fraction(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        pid, table, _, _, _ = setup(client)
        report_id = client.post(f'/api/projects/{pid}/reports', json={'name': '符号边界报告', 'text': '原文为-80%。\n原文为− 80%。\n原文为1,080%。\n原文为+80%。'}, headers=HEADERS).json()['id']
        report = client.get('/api/assets/'+report_id).json()
        paragraphs = client.get(f'/api/assets/{report_id}/preview').json()['paragraphs']
        saved = run(client, pid, request(client, pid, table))
        for paragraph in paragraphs[:3]:
            assert check(client, saved['id'], report, paragraph, '80')['status'] == 'needs_confirmation'
        assert check(client, saved['id'], report, paragraphs[3], '80')['status'] == 'consistent'
    sheet = {'columns': [{'id': 'c1'}], 'rows': [{'id': f'r{i}', 'cells': [value]} for i, value in enumerate(['yes', 'no', 'no'])]}
    body = RunRequest(asset_id='a', sheet_id='s1', operation='ratio', metric='自定义指标', scope_description='全表',
                      scope=[], numerator=[{'column_id': 'c1', 'value': 'yes'}], null_policy='keep', precision=2,
                      confirmed=True, context_hash='unused-in-pure-engine-test')
    value, _ = calculate(sheet, body)
    assert value['exact_fraction'] == {'numerator': 1, 'denominator': 3, 'percent_multiplier': 100}
    assert value['display_value'] == '33.33'
    assert len(value['unrounded_decimal']) > 70 and Decimal(value['unrounded_decimal']) > Decimal('33.33')
