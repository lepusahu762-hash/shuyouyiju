"""Offline paired retrieval evaluation; never imports the model client or credentials."""
import argparse
import json
import statistics
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app import rule_retrieval as r


def evaluate(dataset, strategies, split):
    rows=[]
    for q in dataset['queries']:
        if split!='all' and q['split']!=split:continue
        corpus=[{'citation_id':p['id'],'asset_id':doc['id'],'name':doc['name'],'paragraph_index':i,'location':p['location'],'text':p['text']} for doc in dataset['documents'] if doc['id'] in q['documents'] for i,p in enumerate(doc['paragraphs'])]
        for strategy in strategies:
            fn=r.baseline if strategy==r.BASELINE_VERSION else r.improved
            samples=[]
            for _ in range(5):
                start=time.perf_counter();hits=fn(corpus,q['query'],limit=5,char_budget=6000);samples.append((time.perf_counter()-start)*1000)
            ids=[h['citation_id'] for h in hits];required=set(q['required']);found=required.intersection(ids)
            usable=[h for h in hits if h.get('applicability_status','candidate')!='mismatch']
            reasons=[]
            if required-found:reasons.append('必要段落未全召回：'+','.join(sorted(required-found)))
            if q['no_evidence'] and usable:reasons.append('无依据题仍返回候选规则，需避免误当可用依据')
            rows.append({'query_id':q['id'],'split':q['split'],'query':q['query'],'strategy':strategy,'ids':ids,
                         'required':q['required'],'hit_at_5':bool(found) if required else None,'complete_recall':required<=set(ids) if required else None,
                         'first_rank':next((i+1 for i,k in enumerate(ids) if k in required),None),'no_evidence':q['no_evidence'],
                         'false_usable':bool(usable) if q['no_evidence'] else None,'conflict_complete':set(q['conflicts'])<=set(ids) if q['conflicts'] else None,
                         'median_ms':round(statistics.median(samples),4),'failure_reasons':reasons})
    summaries={}
    for strategy in strategies:
        for group in ['all','dev','holdout']:
            items=[x for x in rows if x['strategy']==strategy and (group=='all' or x['split']==group)]
            if not items:continue
            relevant=[x for x in items if not x['no_evidence']];negative=[x for x in items if x['no_evidence']];conflict=[x for x in items if x['conflict_complete'] is not None]
            summaries[strategy+'/'+group]={'n':len(items),'relevant_n':len(relevant),'no_evidence_n':len(negative),'conflict_n':len(conflict),
                'hit_at_5':sum(x['hit_at_5'] for x in relevant)/len(relevant) if relevant else None,
                'complete_recall':sum(x['complete_recall'] for x in relevant)/len(relevant) if relevant else None,
                'mrr':sum(1/x['first_rank'] if x['first_rank'] else 0 for x in relevant)/len(relevant) if relevant else None,
                'negative_rejection':sum(not x['false_usable'] for x in negative)/len(negative) if negative else None,
                'conflict_complete':sum(x['conflict_complete'] for x in conflict)/len(conflict) if conflict else None,
                'median_query_ms':statistics.median(x['median_ms'] for x in items)}
    return {'dataset_version':dataset['version'],'top_k':5,'context_char_budget':6000,'timing':'每题本地重复5次中位数；不含数据库IO/网络；不是生产压测','metrics':'hit@5任一必要段；complete全部必要段；MRR未命中计0；negative_rejection无依据题没有候选；conflict_complete双方均返回','summary':summaries,'rows':rows}


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--strategy',choices=['baseline','paired'],default='paired');p.add_argument('--split',choices=['dev','holdout','all'],default='all');p.add_argument('--output',required=True);args=p.parse_args()
    ds=json.loads((Path(__file__).resolve().parents[1]/'evaluation/rules36.json').read_text(encoding='utf-8'))
    result=evaluate(ds,[r.BASELINE_VERSION]+([r.STRATEGY_VERSION] if args.strategy=='paired' else []),args.split)
    dest=Path(args.output);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result['summary'],ensure_ascii=False,indent=2))
