"""Offline regression: paused whole-sheet statistics must never rank partial groups."""
import json
import sqlite3
from copy import deepcopy
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.calculations import RunRequest
from app.group_calculations import calculate_groups,public_group_result
from app.analysis import rank_answer
from test_analysis import Model,seed,ask,confirm
from test_ai import configured
from test_accounts import HEADERS,register
from test_materials import upload


def four_rows():
    return {'columns':[{'id':str(i)} for i in range(3)],'rows':[{'id':f'source:{i}','source_row':i+2,'cells':r} for i,r in enumerate([['A','有效','满意'],['A','有效','一般'],['B','有效','满意'],['B','有效','']])]}


def spec(**patch):
    return RunRequest(**{'asset_id':'fixture','sheet_id':'s1','operation':'ratio','metric':'满意率','scope_description':'状态=有效','scope':[{'column_id':'1','value':'有效'}],'numerator':[{'column_id':'2','value':'满意'}],'null_policy':'block','precision':0,'confirmed':True,'context_hash':'','group_by':'0','group_null_policy':'keep',**patch})


@pytest.mark.parametrize('kind',['base','group'])
def test_pause_propagates_to_groups_and_diagnostic_counts(kind):
    sheet=four_rows();body=spec()
    if kind=='group':
        sheet['rows'][-1]['cells'][0]=None;body=spec(null_policy='keep',group_null_policy='block')
    result,rows=calculate_groups(sheet,body)
    assert result['status']=='needs_confirmation' and result['display_value'] is None
    assert all(g['result']['status']=='needs_confirmation' and g['result']['display_value'] is None and g['result']['diagnostic'] for g in result['groups'])
    assert result['extrema']['lowest']==result['extrema']['highest']==[]
    assert len(rows)==4 and result['total']==4 and result['numerator']==2
    for which in ['lowest','highest']:
        answer=rank_answer(SimpleNamespace(result=result,spec=body.model_dump()),which)
        assert not answer['groups'] and not answer['comparable'] and '不能用于排名' in answer['message']


def test_keep_exclude_normal_values_and_legacy_snapshot_read_only():
    keep,_=calculate_groups(four_rows(),spec(null_policy='keep'))
    assert keep['display_value']=='50' and [g['result']['display_value'] for g in keep['groups']]==['50','50']
    assert len(keep['extrema']['lowest'])==2
    exclude,_=calculate_groups(four_rows(),spec(null_policy='exclude'))
    assert exclude['denominator']==3 and exclude['numerator']==2 and [g['result']['display_value'] for g in exclude['groups']]==['50','100']
    legacy=deepcopy(keep);legacy.update(status='needs_confirmation')
    original=json.dumps(legacy,sort_keys=True)
    safe=public_group_result(legacy)
    assert safe['display_value'] is None and safe['exact_fraction'] is None
    assert all(g['result']['display_value'] is None for g in safe['groups'])
    assert not rank_answer(SimpleNamespace(result=legacy,spec={'operation':'ratio'}),'lowest')['groups']
    assert json.dumps(legacy,sort_keys=True)==original


def test_direct_rank_requests_paused_and_legacy_views_do_not_rewrite_history(tmp_path):
    settings=configured(tmp_path);provider=Model()
    with TestClient(create_app(settings,provider)) as c:
        pid,a,rule,sid=seed(c)
        table=upload(c,pid,'独立合成暂停4行.csv','组别,状态,评价\nA,有效,满意\nA,有效,一般\nB,有效,满意\nB,有效,\n'.encode('utf-8-sig'))
        sh=table['summary']['sheets'][0];cols=sh['columns'];head=c.get(f'/api/projects/{pid}/rule-snapshots').json()
        constraints={**rule['constraints'],'asset_id':table['id'],'sheet_id':sh['id'],'scope':[{'column_id':cols[1]['id'],'kind':'text','value':'有效'}],'numerator':[{'column_id':cols[2]['id'],'kind':'text','value':'满意'}],'null_policy':'block'}
        saved=c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json={'previous_id':rule['id'],'context_hash':head['context_hash'],'constraints':constraints,'sources':{k:{'asset_id':v['asset_id'],'paragraph_id':v['paragraph_id'],'quote':v['quote']} for k,v in rule['sources'].items()},'confirmed_fields':list(constraints),'unresolved':[],'change_reason':'离线构造暂停规则'})
        assert saved.status_code==201
        t=ask(c,sid);done=confirm(c,t).json();rid=done['run_id']
        assert done['saved_status']=='completed' and done['run']['result']['status']=='needs_confirmation'
        head_id=t['id']
        for q in ['哪个最低？','哪个最高？']:
            reply=ask(c,sid,head_id,t['id'],q);head_id=reply['id']
            assert reply['request_count']==0 and not reply['payload']['answer']['groups']
        assert provider.calls==1
        # Deliberately restore the old bug's storage shape to verify historical read safety.
        db=sqlite3.connect(settings.data_dir/'shuyouyiju.sqlite3')
        raw=json.loads(db.execute('select result from calculation_runs where id=?',(rid,)).fetchone()[0])
        first=raw['groups'][0];first['result'].update(status='completed',display_value='50',exact_fraction={'numerator':1,'denominator':2,'percent_multiplier':100},unrounded_decimal='50')
        raw['extrema']={'lowest':[first['key']],'highest':[first['key']],'rule':'旧算法记录'}
        stored=json.dumps(raw,ensure_ascii=False)
        db.execute('update calculation_runs set result=? where id=?',(stored,rid));db.commit()
        view=c.get('/api/runs/'+rid).json();assert view['result']['groups'][0]['result']['display_value'] is None
        page=c.get(f'/api/runs/{rid}/groups?order=ascending').json()
        assert not page['comparable'] and page['order']=='source' and all(g['result']['display_value'] is None for g in page['items'])
        reply=ask(c,sid,head_id,t['id'],'哪个最低？',key='legacy-lowest')
        assert not reply['payload']['answer']['groups']
        payload={'answer':{'kind':'lowest','message':'旧错误回答A最低','groups':[first['key']]},'answer_run_id':rid,'model':{'model':'offline','region':'offline'}}
        db.execute('update analysis_turns set payload=? where id=?',(json.dumps(payload),reply['id']));db.commit()
        corrected=c.get('/api/analysis-turns/'+reply['id']).json()
        assert not corrected['payload']['answer']['groups'] and corrected['payload']['historical_answer']['message']=='旧错误回答A最低'
        assert db.execute('select result from calculation_runs where id=?',(rid,)).fetchone()[0]==stored
        assert json.loads(db.execute('select payload from analysis_turns where id=?',(reply['id'],)).fetchone()[0])==payload
        db.close()
        c.post('/api/auth/logout',headers=HEADERS);register(c,'pause-other@example.com')
        assert c.get(f'/api/runs/{rid}/groups?order=ascending').status_code==404
