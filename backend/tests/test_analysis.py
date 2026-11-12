"""Synthetic, offline model protocol + real SQLite/equality calculation. No paid calls."""
import json
from copy import deepcopy
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.calculations import RunRequest,calculate
from app.group_calculations import calculate_groups
from app.ai_provider import AIError
from test_ai import configured
from test_accounts import register,HEADERS
from test_materials import upload

RULE='有效记录满意率：以纳入状态为有效的全部记录为分母，反馈等级为满意的记录为分子。保留反馈空值，不去重，按记录/行统计，显示0位小数。不限定期间；可按所属学院探索分组，分组空值必须另行确认。'


def seed(c):
    register(c);pid=c.post('/api/projects',headers=HEADERS,json={'name':'独立合成对话分析','goal':'analysis'}).json()['id']
    rows=[['A','有效','满意']]*3+[['A','有效','一般']]*2+[['A','有效','']]+[['B','有效','满意']]+[['B','有效','一般']]*2+[['B','有效','']]+[['A','无效','满意'],['','无效','']]
    raw=('所属学院,纳入状态,反馈等级\n'+'\n'.join(','.join(x) for x in rows)+'\n').encode('utf-8-sig')
    a=upload(c,pid,'独立合成12条.csv',raw);sheet=a['summary']['sheets'][0];cols=sheet['columns']
    r=c.post(f'/api/projects/{pid}/reports',headers=HEADERS,json={'name':'独立合成规则','text':RULE}).json()
    c.put(f"/api/projects/{pid}/rule-materials/{r['id']}",headers=HEADERS,json={'enabled':True})
    para=c.get(f"/api/assets/{r['id']}/preview").json()['paragraphs'][0]
    spec={'asset_id':a['id'],'sheet_id':sheet['id'],'operation':'ratio','metric':'有效记录满意率','scope_description':'纳入状态为有效；不限定期间',
          'scope':[{'column_id':cols[1]['id'],'kind':'text','value':'有效'}],'numerator':[{'column_id':cols[2]['id'],'kind':'text','value':'满意'}],'null_policy':'keep','precision':0}
    head=c.get(f'/api/projects/{pid}/rule-snapshots').json()
    rule=c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json={'previous_id':None,'context_hash':head['context_hash'],'constraints':spec,
        'sources':{k:{'asset_id':r['id'],'paragraph_id':para['id'],'quote':para['text']} for k in spec},'confirmed_fields':list(spec),'unresolved':[],'change_reason':'独立合成离线逐项确认'}).json()
    sid=c.post(f'/api/projects/{pid}/analysis-sessions',headers=HEADERS,json={'name':'独立合成会话'}).json()['id']
    return pid,a,rule,sid


class Model:
    is_test=True
    def __init__(self):self.calls=0;self.fail=False;self.action='calculate';self.bad=False
    async def complete(self,messages,**kwargs):
        self.calls+=1
        if self.fail:raise AIError('离线模拟超时')
        d=json.loads(messages[-1]['content']);base=d['base_rule'];columns=d['table']['columns']
        assert 'rows' not in d['table'] and len(columns[0]['sample_values'])<=5
        plan={'operation':'ratio','metric':base['metric'],'group_by':columns[0]['id'],'group_null_policy':'keep','exploration':(d.get('previous_plan') or {}).get('exploration',[])}
        args={'action':self.action,'plan':plan if self.action=='calculate' else None,'message':'离线构造方案' if self.action=='calculate' else '缺少收入字段，请补充依据',
              'questions':['请明确分组空值保留策略'],'citation_ids':['forged'] if self.bad else [x['citation_id'] for x in d['retrieval']['items']],'group_key':None}
        return {'tool_calls':[{'id':'offline','type':'function','function':{'name':'propose_analysis','arguments':json.dumps(args,ensure_ascii=False)}}]}, {'prompt_tokens':10,'completion_tokens':20,'total_tokens':30}


def ask(c,sid,head=None,parent=None,question='各学院满意率是多少？',key=None,selected=None):
    r=c.post(f'/api/analysis-sessions/{sid}/questions',headers=HEADERS,json={'question':question,'expected_head':head,'parent_id':parent,'request_id':key or f'offline-{head or "first"}-{question}', 'consent':True,'selected_group':selected})
    assert r.status_code==201,r.text
    return c.get('/api/analysis-turns/'+r.json()['id']).json()


def confirm(c,t,plan=None,**changes):
    return c.post(f"/api/analysis-turns/{t['id']}/confirm",headers=HEADERS,json={'proposal_hash':t['payload']['proposal_hash'],'rule_snapshot_id':t['payload']['rule_snapshot']['id'],
        'plan':plan or t['payload']['original_proposal']['plan'],'confirmed':True,'reason':'离线人工确认或修改',**changes})


def test_group_full_sheet_evidence_summary_types_nulls_and_zero():
    cols=[{'id':str(i),'label':str(i)} for i in range(3)]
    vals=[[1,'是','满意'],['1','是','一般'],[True,'是','满意'],['','是',''],[None,'否','一般'],['Z','否','一般']]
    sheet={'columns':cols,'rows':[{'id':f'row:{i}','source_row':i+2,'cells':v} for i,v in enumerate(vals)]}
    body=RunRequest(asset_id='x',sheet_id='s1',operation='ratio',metric='测试',scope_description='是',scope=[{'column_id':'1','value':'是'}],numerator=[{'column_id':'2','value':'满意'}],null_policy='keep',precision=0,confirmed=True,context_hash='',group_by='0',group_null_policy='keep')
    result,evidence=calculate_groups(sheet,body)
    assert result['numerator']==2 and result['denominator']==4 and result['display_value']=='50'
    assert len(result['groups'])==5 and {g['type'] for g in result['groups']}=={'number','text','boolean','null'}
    assert len(result['extrema']['highest'])==2 and len(result['extrema']['lowest'])==2
    assert any(g['result']['status']=='insufficient' and g['label']=='Z' for g in result['groups'])
    assert len(evidence)==6 and all(not e['in_numerator'] or e['in_scope'] for e in evidence)
    excluded,_=calculate_groups(sheet,body.model_copy(update={'group_null_policy':'exclude'}));assert excluded['denominator']==3 and excluded['excluded']==3 and excluded['group_null_excluded']==2
    blocked,_=calculate_groups(sheet,body.model_copy(update={'group_null_policy':'block'}));assert blocked['display_value'] is None and all(g['result']['display_value'] is None for g in blocked['groups'])
    with pytest.raises(Exception):calculate_groups(sheet,body.model_copy(update={'group_by':'missing'}))


def test_conversation_real_engine_followups_pagination_duplicate_and_restart(tmp_path):
    settings=configured(tmp_path);provider=Model()
    with TestClient(create_app(settings,provider)) as c:
        pid,a,rule,sid=seed(c);t=ask(c,sid,key='first-question');assert t['status']=='awaiting_confirmation',t
        assert confirm(c,t,confirmed=False).status_code==409
        response=confirm(c,t);assert response.status_code==200,response.text
        done=response.json();r=done['run'];groups=r['result']['groups'];lookup={g['label']:g for g in groups}
        assert lookup['A']['result']['display_value']=='50' and lookup['B']['result']['display_value']=='25'
        assert r['result']['display_value']=='40' and r['result']['denominator']==10 and r['result']['total']==12
        assert confirm(c,t).json()['run_id']==done['run_id']
        assert ask(c,sid,key='first-question')['id']==t['id'] and provider.calls==1
        low=ask(c,sid,t['id'],t['id'],'哪个最低？');assert low['payload']['answer']['groups']==[lookup['B']['key']] and low['request_count']==0
        viewed=ask(c,sid,low['id'],low['id'],'查看这个学院的记录。',selected=lookup['B']['key']);assert viewed['payload']['answer_run_id']==done['run_id']
        pages=[c.get(f"/api/runs/{done['run_id']}/evidence?category={lookup['A']['key']}&limit=2&offset={i}").json() for i in [0,2,4]]
        assert all(p['total']==6 for p in pages) and len({r['id'] for p in pages for r in p['rows']})==6
        assert c.get(f"/api/runs/{done['run_id']}/groups?order=ascending&limit=1").json()['items'][0]['label']=='B'
        child=ask(c,sid,viewed['id'],t['id'],'只看A学院满意率');plan=child['payload']['original_proposal']['plan'];plan['exploration']=[{'column_id':a['summary']['sheets'][0]['columns'][0]['id'],'kind':'text','value':'A'}]
        childdone=confirm(c,child,plan).json();assert childdone['run']['result']['denominator']==6
        nextt=ask(c,sid,child['id'],child['id'],'继续按学院分组');removed={**nextt['payload']['original_proposal']['plan'],'exploration':[]};assert confirm(c,nextt,removed).status_code==409
        provider.action='clarify';q=ask(c,sid,nextt['id'],None,'各学院收入增长率是多少？');assert q['status']=='clarify' and not q['run_id']
        cookie=c.cookies.get('syj_session')
    with TestClient(create_app(settings,provider)) as c:
        c.cookies.set('syj_session',cookie);restored=c.get('/api/analysis-turns/'+done['id']).json()
        assert restored['payload']['confirmation']==done['payload']['confirmation'] and restored['run']['result']==done['run']['result']
        assert c.get(f'/api/analysis-sessions/{sid}').json()['total']==6


def test_guards_stale_ownership_missing_rules_and_failure_retry(tmp_path):
    provider=Model()
    with TestClient(create_app(configured(tmp_path),provider)) as c:
        pid,a,rule,sid=seed(c);t=ask(c,sid);plan=t['payload']['original_proposal']['plan']
        assert confirm(c,t,{**plan,'metric':'编造指标'}).status_code==409
        assert confirm(c,t,{**plan,'group_by':'missing'}).status_code==422
        done=confirm(c,t).json()
        c.post('/api/auth/logout',headers=HEADERS);register(c,'analysis-other@example.com')
        for url in [f'/api/analysis-sessions/{sid}',f'/api/analysis-turns/{t["id"]}',f'/api/projects/{pid}/analysis-sessions',f'/api/runs/{done["run_id"]}/groups',f'/api/runs/{done["run_id"]}/evidence']:
            assert c.get(url).status_code==404
        assert confirm(c,t).status_code==404
        assert c.post(f'/api/analysis-sessions/{sid}/questions',headers=HEADERS,json={'question':'x','request_id':'other-user','consent':True}).status_code==404
        c.post('/api/auth/logout',headers=HEADERS);c.post('/api/auth/login',headers=HEADERS,data={'username':'owner@example.com','password':'Example123!'})
        provider.fail=True;f=ask(c,sid,t['id']);assert f['status']=='failed'
        provider.fail=False;assert c.post(f"/api/analysis-turns/{f['id']}/retry",headers=HEADERS).status_code==200
        f=c.get('/api/analysis-turns/'+f['id']).json();assert f['request_count']==2 and f['status']=='awaiting_confirmation'
        cancelled=c.post(f"/api/analysis-turns/{f['id']}/cancel",headers=HEADERS).json();assert cancelled['status']=='cancelled' and confirm(c,f).status_code==409
        # A new rule snapshot revokes pending plans; no scope/precision override is exposed.
        pending=ask(c,sid,f['id']);head=c.get(f'/api/projects/{pid}/rule-snapshots').json()
        body={'previous_id':rule['id'],'context_hash':head['context_hash'],'constraints':rule['constraints'],
              'sources':{k:{'asset_id':v['asset_id'],'paragraph_id':v['paragraph_id'],'quote':v['quote']} for k,v in rule['sources'].items()},'confirmed_fields':list(rule['constraints']),'unresolved':[],'change_reason':'再次确认'}
        assert c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=body).status_code==201
        assert confirm(c,pending).status_code==409
        saved=c.get('/api/analysis-turns/'+done['id']).json();assert saved['stale'] and saved['run']['result']['display_value']=='40'
        c.put(f'/api/projects/{pid}/rule-materials/'+next(iter(rule['sources'].values()))['asset_id'],headers=HEADERS,json={'enabled':False})
        missing=ask(c,sid,pending['id']);assert missing['status']=='clarify' and not missing['run_id']


def test_large_categories_and_rule_scope_cannot_be_widened(tmp_path):
    provider=Model()
    with TestClient(create_app(configured(tmp_path),provider)) as c:
        pid,a,rule,sid=seed(c);t=ask(c,sid)
        malicious={**t['payload']['original_proposal']['plan'],'scope':[]}
        assert confirm(c,t,malicious).status_code==422
        # Raw manual grouped engine remains general, not bound to fixture fields.
        raw=('类别,选择\n'+'\n'.join(f'组{i},是' for i in range(55))+'\n').encode('utf-8-sig')
        table=upload(c,pid,'独立合成55组.csv',raw);sheet=table['summary']['sheets'][0]
        context=c.get(f'/api/projects/{pid}/calculation-context').json()['context_hash']
        body={**rule['constraints'],'asset_id':table['id'],'sheet_id':sheet['id'],'operation':'count','scope':[],'numerator':[], 'group_by':sheet['columns'][0]['id'],'group_null_policy':'keep','context_hash':context,'confirmed':True}
        r=c.post(f'/api/projects/{pid}/runs',headers=HEADERS,json=body);assert r.status_code==201,r.text
        run=r.json();assert run['result']['group_count']==55 and len(run['result']['groups'])==20 and run['result']['display_value']=='55'
        page=c.get(f"/api/runs/{run['id']}/groups?offset=40&limit=20").json();assert len(page['items'])==15 and page['total']==55


def test_count_overall_ratio_and_zero_denominator_are_saved_separately(tmp_path):
    provider=Model()
    with TestClient(create_app(configured(tmp_path),provider)) as c:
        pid,a,rule,sid=seed(c);t=ask(c,sid)
        plan={**t['payload']['original_proposal']['plan'],'operation':'count','group_by':None,'group_null_policy':None}
        counted=confirm(c,t,plan).json();assert counted['run']['result']['display_value']=='10' and counted['run']['spec']['numerator']==[]
        t2=ask(c,sid,t['id']);plan2={**t2['payload']['original_proposal']['plan'],'group_by':None,'group_null_policy':None}
        ratio=confirm(c,t2,plan2).json();assert ratio['run']['result']['display_value']=='40' and ratio['run']['result']['numerator']==4
        t3=ask(c,sid,t2['id']);plan3={**t3['payload']['original_proposal']['plan'],'exploration':[{'column_id':a['summary']['sheets'][0]['columns'][0]['id'],'kind':'text','value':'不存在'}]}
        zero=confirm(c,t3,plan3).json();assert zero['run']['result']['display_value'] is None and zero['run']['result']['status']=='insufficient'
        assert all(g['result']['display_value'] is None for g in zero['run']['result']['groups'])
        assert c.get(f'/api/projects/{pid}/rule-snapshots').json()['current_id']==rule['id']


def test_saved_tool_response_bounded_json_normalization():
    from app.analysis import parse_proposal
    from pydantic import ValidationError
    plan={'operation':'ratio','metric':'任意合成指标','group_by':'column-id','group_null_policy':'keep','exploration':[]}
    def msg(value):
        return {'tool_calls':[{'id':'saved-real-shape','type':'function','function':{'name':'propose_analysis','arguments':json.dumps({'action':'calculate','plan':value,'message':'建议','questions':[],'citation_ids':['source-id']})}}]}
    assert parse_proposal(msg(json.dumps(plan))).plan.model_dump()==plan
    assert parse_proposal(msg(plan)).plan.model_dump()==plan
    with pytest.raises(AIError):parse_proposal(msg('x'*16001))
    with pytest.raises(AIError):parse_proposal(msg('not-json'))
    with pytest.raises(ValidationError):parse_proposal(msg(json.dumps({**plan,'sql':'select *'})))
    with pytest.raises(ValidationError):parse_proposal(msg(json.dumps('nested-string')))


def test_saved_response_retry_no_paid_call_and_data_change_revokes_confirmation(tmp_path):
    provider=Model();provider.bad=True
    with TestClient(create_app(configured(tmp_path),provider)) as c:
        pid,a,rule,sid=seed(c);t=ask(c,sid)
        assert t['status']=='failed' and t['payload']['raw_model_message'] and provider.calls==1
        assert c.post(f"/api/analysis-turns/{t['id']}/retry",headers=HEADERS).status_code==200
        saved=c.get('/api/analysis-turns/'+t['id']).json()
        assert saved['status']=='failed' and saved['request_count']==1 and provider.calls==1
        provider.bad=False
        assert c.post(f"/api/analysis-turns/{t['id']}/retry",headers=HEADERS,json={'request_model':True}).status_code==200
        ready=c.get('/api/analysis-turns/'+t['id']).json()
        assert ready['status']=='awaiting_confirmation' and ready['request_count']==2 and len(ready['payload']['model_attempts'])==2
        cols=a['summary']['sheets'][0]['columns']
        changed=c.put(f"/api/assets/{a['id']}/fields",headers=HEADERS,json={'version':a['annotation_version'],'fields':{cols[0]['id']:{'meaning':'离线更新分组字段说明','unit':''}}})
        assert changed.status_code==200
        assert confirm(c,ready).status_code==409
        assert c.get('/api/analysis-turns/'+t['id']).json()['stale'] and not ready['run_id']


def test_count_preserves_base_null_fields_even_without_numerator_filter(tmp_path):
    provider=Model()
    with TestClient(create_app(configured(tmp_path),provider)) as c:
        pid,a,rule,sid=seed(c)
        head=c.get(f'/api/projects/{pid}/rule-snapshots').json()
        updated={**rule['constraints'],'null_policy':'exclude'}
        r=c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json={'previous_id':rule['id'],'context_hash':head['context_hash'],'constraints':updated,
          'sources':{k:{'asset_id':v['asset_id'],'paragraph_id':v['paragraph_id'],'quote':v['quote']} for k,v in rule['sources'].items()},'confirmed_fields':list(updated),'unresolved':[],'change_reason':'离线构造排除空值约束'})
        assert r.status_code==201
        t=ask(c,sid);plan={**t['payload']['original_proposal']['plan'],'operation':'count'}
        counted=confirm(c,t,plan).json()
        assert counted['run']['result']['denominator']==8 and counted['run']['result']['display_value']=='8'
        assert counted['run']['spec']['numerator']==[]
        assert len(counted['run']['spec']['null_fields'])==2
        grouped={g['label']:g for g in counted['run']['result']['groups']}
        assert grouped['A']['result']['display_value']=='5' and grouped['B']['result']['display_value']=='3'
