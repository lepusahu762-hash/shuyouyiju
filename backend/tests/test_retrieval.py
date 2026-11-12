"""Local retrieval tests: synthetic materials, no paid model."""
from app.rule_retrieval import baseline,search,excerpt,STRATEGY_VERSION,BASELINE_VERSION
from test_ai import configured, ScriptedProvider,start,choose,rules
from test_calculations import setup
from test_accounts import HEADERS,register
from fastapi.testclient import TestClient
from app.main import create_app


def corpus(texts):
    return [{'citation_id':f'd:p{i}','asset_id':'d','paragraph_index':i,'location':f'段落{i}','text':t} for i,t in enumerate(texts)]


def test_context_conflicting_restrictions_and_scope_are_distinct_sources():
    ps=corpus(['适用范围：2026年本部。','完成率定义：有效为分母，完成为分子。','限制条款：缺失值仍计入分母，不得排除。',
               '归档说明。','完成率争议条款：另一部门排除缺失值；尚未裁决。'])
    result=search(ps,'2026年完成率定义空值')
    assert {p['citation_id'] for p in result['items']} >= {'d:p0','d:p1','d:p2','d:p4'}
    assert result['strategy_version']==STRATEGY_VERSION and result['confirmation_required']
    assert any(p['context_role']=='adjacent_context' for p in result['items'])
    assert all(p['applicability']['status']=='needs_confirmation' for p in result['items'])


def test_missing_metric_period_and_empty_corpus_never_claim_evidence():
    ps=corpus(['适用范围：2026年本部。','完成率定义：有效为分母，完成为分子。'])
    for query in ['金额合格率如何定义','2021年完成率']:
        assert search(ps,query)['status']=='no_evidence'
    assert search([],'完成率')['items']==[]
    assert baseline(ps,'金额合格率如何定义')  # The old incidental lexical hit is reproducible.


def test_publication_date_is_not_applicability_and_never_selects_newest():
    ps=corpus(['发布日期：2024年。','完成率定义：有效为分母，完成为分子。'])
    result=search(ps,'2026年完成率')
    assert result['items'] and all(p['applicability']['periods']==[] for p in result['items'])
    assert result['confirmation_required']


def test_sentence_excerpts_have_exact_ranges_and_omissions():
    text='普通档案说明。'*300+'关键限制：缺失值仍计入，不得排除。'+'普通说明。'*100
    quote,cut,ranges=excerpt(text,'缺失值不得排除',1600)
    assert cut and '缺失值仍计入，不得排除。' in quote and '省略' in quote
    for r in ranges:assert text[r['start']:r['end']].endswith(('。','；','！','？'))
    assert excerpt('x'*2000,'x',100)[2]==[]  # No silent mid-clause prefix.
    retrieved=search(corpus([text]),'缺失值不得排除')
    assert all(quote in text for p in retrieved['items'] for quote in p['quote_options'])


def test_frozen_baseline_scores_ties_and_prefix():
    ps=corpus(['满意率：保留空值。','满意率：保留空值。','x'*1800+'满意率'])
    result=search(ps,'满意率',BASELINE_VERSION)
    assert [p['citation_id'] for p in result['items'][:2]]==['d:p0','d:p1']
    assert any(p['truncated'] and len(p['text'])==1600 for p in result['items'])


def test_search_only_designated_owned_project_and_source_location(tmp_path):
    with TestClient(create_app(configured(tmp_path),ScriptedProvider())) as c:
        register(c);pid=c.post('/api/projects',headers=HEADERS,json={'name':'合成检索','goal':'verify'}).json()['id']
        def report(text):return c.post(f'/api/projects/{pid}/reports',headers=HEADERS,json={'name':'合成规则','text':text}).json()
        a=report('适用范围：2026年。\n完成率定义：有效为分母，完成为分子。\n限制：缺失值仍计入，不得排除。')
        hidden=report('完成率：这是未指定资料，不得泄露到检索。')
        c.put(f"/api/projects/{pid}/rule-materials/{a['id']}",headers=HEADERS,json={'enabled':True})
        result=c.get(f'/api/projects/{pid}/rule-search',params={'q':'完成率空值'}).json()
        assert result['items'] and all(p['asset_id']==a['id'] and p['asset_id']!=hidden['id'] for p in result['items'])
        preview=c.get(f"/api/assets/{a['id']}/preview").json()
        for p in result['items']:assert p['citation_id']==preview['paragraphs'][p['paragraph_index']]['id']
        c.post('/auth/logout',headers=HEADERS);register(c,'other-retrieval@example.com')
        assert c.get(f'/api/projects/{pid}/rule-search?q=完成率').status_code==404


def test_new_task_records_retrieval_and_no_rules_stops_before_proposal(tmp_path):
    with TestClient(create_app(configured(tmp_path),ScriptedProvider())) as c:
        pid,table,report,paras,raw=setup(c)
        task=choose(c,start(c,pid,report,paras[0]))
        assert task['status']=='insufficient' and task['request_count']==2
        assert task['payload']['retrieval']['status']=='no_evidence' and 'plan' not in task['payload']
        rules(c,pid)
        task=choose(c,start(c,pid,report,paras[0]))
        r=task['payload']['retrieval']
        assert task['payload']['retrieval_strategy']==r['strategy_version']==STRATEGY_VERSION
        assert r['query'] and r['model_query'] and r['duration_ms']>=0
        trace=next(t for t in task['trace'] if t['event']=='tool_call' and t['name']=='search_rules')
        assert trace['summary']['citation_ids']==[p['citation_id'] for p in r['items']]
        assert task['payload']['citations']==r['items']
