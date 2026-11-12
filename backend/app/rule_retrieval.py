"""Versioned local retrieval. No evaluation corpus or expected answers here."""
import re
import math
import time
from collections import Counter

BASELINE_VERSION = 'keyword-bigram-v1'
STRATEGY_VERSION = 'bm25-context-v2'
# General lexical hints, never asserted to be equivalent statistical definitions.
ALIASES = {'办完':'办结','到场':'出席','续签':'续约','过关':'合格','处理好了':'解决',
           '没迟到':'准时','开始使用':'启用','做完':'完成','退掉':'退货','审核过了':'通过',
           '通过要求':'达标','空白':'空值','缺失值':'空值','空缺':'空值'}
STOP = {'怎么','如何','多少','什么','比例','统计','规则','分母','分子','记录','空值','处理','定义','计算','要求','本条','其中','不得','全部','是否','办法','占比','保留','排除'}


def normalized(text):
    for a,b in ALIASES.items():text=text.replace(a,b)
    return text


def tokens(text):
    return {t for t in terms(normalized(text)) if len(t)<=24 and t not in STOP and not t.isdigit()}


def excerpt(text, query, maximum=1600):
    """Only whole sentence/clauses; exact offsets distinguish gaps and omission."""
    spans=[(m.start(),m.end(),m.group()) for m in re.finditer(r'[^。！？；\n]+[。！？；\n]?|[。！？；\n]',text)]
    if len(text)<=maximum:return text,False,[{'start':0,'end':len(text)}]
    q=tokens(query);ranked=sorted(range(len(spans)),key=lambda i:(-len(q & tokens(spans[i][2])),i))
    chosen=set();used=0
    for i in ranked:
        if used+len(spans[i][2])<=maximum:
            chosen.add(i);used+=len(spans[i][2])
    ranges=[];out=[];previous=-1
    for i in sorted(chosen):
        start,end,value=spans[i]
        if previous!=i-1 or i==0 and start>0:out.append('【中间内容省略】')
        if not out and i>0:out.append('【前文省略】')
        out.append(value);ranges.append({'start':start,'end':end});previous=i
    if previous<len(spans)-1:out.append('【后文省略】')
    if not chosen:out=['【单条款超出上下文预算，未截断拼接；请定位原文阅读】']
    return ''.join(out),True,ranges


def applicability(p, corpus, query):
    own=re.findall(r'20\d{2}年',p['text'])
    # Inherit only the document's explicit scope header; never infer upload dates.
    header=next((x['text'] for x in corpus if x['asset_id']==p['asset_id'] and x['paragraph_index']==0),'')
    scope=header if re.search(r'适用|范围|归档',header) else ''
    years=own or re.findall(r'20\d{2}年',scope)
    requested=re.findall(r'20\d{2}年',query)
    mismatch=bool(requested and years and not set(requested)&set(years))
    return {'periods':list(dict.fromkeys(years)),'scope_quote':scope,
            'status':'mismatch' if mismatch else 'needs_confirmation',
            'note':'显式期间不一致，不能直接采用' if mismatch else '仅提取原文适用信息；对象、范围与定义仍需人工确认'}


def improved(paragraphs, query, limit=5, char_budget=6000):
    if not paragraphs:return []
    q=tokens(query);docs=[tokens(p['text']) for p in paragraphs];n=len(docs)
    df=Counter(t for ts in docs for t in ts);avg=sum(len(x) for x in docs)/n or 1
    # A specifically named metric must exist. Similar names are not substitutes.
    named=re.findall(r'[\u4e00-\u9fff]{2,24}率',query)
    named=[x.split('的')[-1].split('年')[-1] for x in named]
    if named and not any(name in normalized(p['text']) for name in named for p in paragraphs):return []
    asked_years=set(re.findall(r'20\d{2}年',query))
    available=set(y for p in paragraphs for y in re.findall(r'20\d{2}年',p['text']))
    if asked_years and available and not asked_years & available:return []
    ranked=[]
    for i,p in enumerate(paragraphs):
        shared=q & docs[i]
        # One incidental bigram such as "记录" must not create usable evidence.
        if not shared and not any(name in p['text'] for name in named):continue
        score=sum(math.log(1+(n-df[t]+.5)/(df[t]+.5))*2.2/(1+1.2*(.25+.75*len(docs[i])/avg)) for t in shared)
        info=applicability(p,paragraphs,query)
        if info['status']=='mismatch':continue
        if any(name in p['text'] for name in named):score+=3
        label=p['text'].split('：',1)[0].split(':',1)[0].removesuffix('定义')
        if '定义：' in p['text'] and (any(label==name for name in named) or not named and len(tokens(label)&q)>=2):score+=6
        ranked.append((score,i))
    ranked.sort(key=lambda x:(-x[0],paragraphs[x[1]]['citation_id']))
    if not ranked:return []
    # Only positive anchors seed context. Scope and immediate restrictions retain
    # their own citation IDs; do not merge them into the anchor's source.
    chosen=[]
    def take(i,score,role):
        if i not in [x[0] for x in chosen]:chosen.append((i,score,role))
    top=ranked[0][1];take(top,ranked[0][0],'match')
    asset=paragraphs[top]['asset_id']
    neighbors=[(i,p) for i,p in enumerate(paragraphs) if p['asset_id']==asset and abs(p['paragraph_index']-paragraphs[top]['paragraph_index'])<=1 and i!=top]
    for i,p in neighbors:
        if re.search(r'^(限制|适用|统计范围|例外|注意|补充)|缺失值仍计入|不得|除外',p['text']) and not p['text'].startswith('长文附录'):
            take(i,ranked[0][0],'adjacent_context')
    for i,p in enumerate(paragraphs):
        if p['asset_id']==asset and p['paragraph_index']==0 and re.search(r'适用|范围',p['text']):take(i,ranked[0][0],'scope_context')
    # Keep alternative definitions, even if dated newer/older. No recency winner.
    for score,i in ranked:
        if re.search(r'争议|冲突|另一|相反',paragraphs[i]['text']):take(i,score,'possible_conflict')
    for score,i in ranked:take(i,score,'match')
    out=[];used=0
    for i,score,role in chosen:
        if len(out)>=limit:break
        p=paragraphs[i];text,truncated,ranges=excerpt(p['text'],query,min(1600,char_budget-used))
        if used+len(text)>char_budget:continue
        info=applicability(p,paragraphs,query)
        if info['status']=='mismatch':continue
        out.append({**p,'text':text,'truncated':truncated,'excerpt_ranges':ranges,
                    'quote_options':[p['text'][r['start']:r['end']] for r in ranges] if truncated else [],'score':round(score,5),
                    'context_role':role,'applicability':info,'applicability_status':info['status']});used+=len(text)
    return out


def search(paragraphs, query, strategy=STRATEGY_VERSION, limit=5, char_budget=6000):
    if strategy not in {BASELINE_VERSION,STRATEGY_VERSION}:raise ValueError('Unknown retrieval version')
    start=time.perf_counter()
    items=(baseline if strategy==BASELINE_VERSION else improved)(paragraphs,query,limit,char_budget)
    return {'strategy_version':strategy,'query':query,'limit':limit,'context_char_budget':char_budget,
            'duration_ms':round((time.perf_counter()-start)*1000,3),'status':'candidates' if items else 'no_evidence',
            'items':items,'confirmation_required':bool(items),
            'notice':'候选并不等于已确认适用；请检查期间、对象、定义及所有限制。可能冲突的原文不能按日期自动裁决。' if items else '未找到可用候选规则，请补充资料或明确指标与期间。'}


def terms(text):
    parts = re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z0-9_]+', text.lower())
    result = set()
    for part in parts:
        result.add(part)
        if re.search(r'[\u4e00-\u9fff]', part):
            result.update(part[i:i+2] for i in range(len(part)-1))
    return result


def baseline(paragraphs, query, limit=5, char_budget=6000):
    """Original score/ties and 1600-character prefix retained exactly; budget external."""
    q=terms(query)
    hits=[]
    for p in paragraphs:
        score=len(q & terms(p['text']))
        if score:hits.append({**p,'text':p['text'][:1600],'truncated':len(p['text'])>1600,'score':score})
    hits=sorted(hits,key=lambda x:(-x['score'],x['citation_id']))[:limit]
    out=[];used=0
    for p in hits:
        if used+len(p['text'])>char_budget:break
        out.append(p);used+=len(p['text'])
    return out
