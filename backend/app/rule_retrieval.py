"""Versioned local retrieval. No evaluation corpus or expected answers here."""
import re

BASELINE_VERSION = 'keyword-bigram-v1'


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
