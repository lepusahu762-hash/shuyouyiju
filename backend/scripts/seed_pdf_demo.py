"""Create an independent local synthetic project through real APIs. No AI calls.

Credentials and state stay only in ignored artifacts. Reuses an existing run.
"""
from pathlib import Path
import csv
import io
import json
import secrets
import os
import time
import httpx

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=Path(os.environ.get('QA_PDF_OUTPUT',ROOT/'artifacts/pdf-exports-v09/browser')).resolve()
FIELDS=['asset_id','sheet_id','operation','metric','scope_description','scope','numerator','null_policy','precision']


def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    state_path=OUTPUT/'state.json'
    if state_path.exists():
        print('Synthetic state already exists; reuse it.');return
    state={'email':f'pdf-{secrets.token_hex(7)}@example.com','password':secrets.token_urlsafe(24)+'Aa1!','checks':[]}
    with httpx.Client(base_url='http://127.0.0.1:8000/api',headers={'X-Requested-With':'shuyouyiju'},timeout=30) as c:
        def get(path):
            r=c.get(path);r.raise_for_status();return r.json()
        def post(path,body):
            r=c.post(path,json=body);r.raise_for_status();return r.json()
        post('/auth/register',{'email':state['email'],'password':state['password']})
        r=c.post('/auth/login',data={'username':state['email'],'password':state['password']});r.raise_for_status()
        pid=post('/projects',{'name':'独立合成验收 · 单条PDF与多页证据','goal':'verify'})['id'];state['pid']=pid
        stream=io.StringIO();writer=csv.writer(stream);writer.writerow(['记录编号','纳入标记','服务评价','合成备注'])
        for i in range(1,61):
            writer.writerow([i,'是' if i<=10 else '否','满意' if i<=4 else '不满意' if i<=8 else '' if i<=10 else '一般',
                             f'合成原始记录{i}。'+'这是独立构造的长文本，用于验证中文换行、证据表格分页和重复表头，不代表真实调查。'*3])
        raw=stream.getvalue().encode('utf-8-sig');(OUTPUT/'合成60行.csv').write_bytes(raw)
        r=c.post(f'/projects/{pid}/assets',files={'file':('合成60行.csv',raw)});r.raise_for_status();aid=r.json()['id'];state['table']=aid
        original='本期纳入记录的满意率为50%，参考比例为25%。'+'本段后续文字为独立合成的排版验收说明，不改变前述单条统计对象或分母定义。'*18
        report=post(f'/projects/{pid}/reports',{'name':'独立合成报告 · 中文长段落','text':original});state['report']=report['id']
        ruletext='本期纳入标记为是的10条记录全部进入分母，包括服务评价为空的记录；分子为服务评价为满意的记录，单位为记录／行，不去重。范围说明为本期纳入标记为是的全部记录，显示与比较精度0位，空值必须保留。'
        rule=post(f'/projects/{pid}/reports',{'name':'独立合成统计规则','text':ruletext});state['rule']=rule['id']
        for _ in range(100):
            assets=get(f'/projects/{pid}/assets')
            if len(assets)==3 and all(a['status']=='ready' for a in assets):break
            time.sleep(.1)
        else:raise RuntimeError('Synthetic files did not parse')
        r=c.put(f'/projects/{pid}/rule-materials/{rule["id"]}',json={'enabled':True});r.raise_for_status()
        rp=get('/assets/'+rule['id']+'/preview')['paragraphs'][0]
        table=get('/assets/'+aid);cols=table['summary']['sheets'][0]['columns']
        spec={'asset_id':aid,'sheet_id':'s1','operation':'ratio','metric':'纳入记录满意率','scope_description':'本期纳入标记为是的全部记录',
              'scope':[{'column_id':cols[1]['id'],'kind':'text','value':'是'}],'numerator':[{'column_id':cols[2]['id'],'kind':'text','value':'满意'}],'null_policy':'keep','precision':0}
        head=get(f'/projects/{pid}/rule-snapshots')
        saved_rule=post(f'/projects/{pid}/rule-snapshots',{'previous_id':None,'context_hash':head['context_hash'],'constraints':spec,
            'sources':{k:{'asset_id':rule['id'],'paragraph_id':rp['id'],'quote':rp['text']} for k in FIELDS},'confirmed_fields':FIELDS,'unresolved':[],
            'change_reason':'独立合成PDF验收，人工作出九项明确约束，保留空值。'})
        ctx=get(f'/projects/{pid}/calculation-context')['context_hash']
        run=post(f'/projects/{pid}/runs',{**spec,'confirmed':True,'context_hash':ctx});state['run']=run['id']
        para=get('/assets/'+report['id']+'/preview')['paragraphs'][0]
        check=post('/runs/'+run['id']+'/checks',{'report_asset_id':report['id'],'paragraph_id':para['id'],'reported_value':'50','precision':0,'confirmed':True});state['source']=check['id']
        state['original']=original;state['snapshot']=saved_rule;state['spec']=spec;state['versions']=[]
        # Start with a saved 40% revision and real deterministic recheck. Browser
        # creates the remaining versions after exporting this current result.
        revision=post(f'/projects/{pid}/revisions',{'source_check_id':check['id'],'target_index':0,'expected_head':None,
            'text':original.replace('50%','40%',1),'action':'suggestion','reason':'独立合成演示：按保存的4/10计算建议修改。'})
        context=get(f'/projects/{pid}/revision-source/{check["id"]}')
        cf=post(f'/projects/{pid}/revisions/{revision["id"]}/confirm',{'expected_head':revision['id'],'context_hash':context['context_hash'],'rule_snapshot_id':saved_rule['id'],
            'plan':{**spec,'context_hash':context['context_hash'],'confirmed':True},'confirmed':True})
        revision=post(f'/projects/{pid}/revisions/{revision["id"]}/recheck',{'expected_head':revision['id'],'confirmation_id':cf['id']})
        assert revision['status']=='consistent' and revision['rechecks'][0]['run']['result']['display_value']=='40'
        state['versions'].append(revision)
        # Playwright-compatible localhost cookie state, never printed.
        (OUTPUT/'session.json').write_text(json.dumps({'cookies':[{'name':'syj_session','value':c.cookies.get('syj_session'),'domain':'127.0.0.1','path':'/',
            'expires':-1,'httpOnly':True,'secure':False,'sameSite':'Lax'}],'origins':[]}),encoding='utf-8')
        state_path.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
        (OUTPUT/'演示账户.txt').write_text(f"仅限本地独立合成PDF演示，不提交。\n邮箱：{state['email']}\n密码：{state['password']}\n",encoding='utf-8')
        print('Independent synthetic PDF project ready; state and credentials saved in configured local output directory.')


if __name__=='__main__':main()
