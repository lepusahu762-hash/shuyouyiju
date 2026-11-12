"""All model labels here are scripted offline, never real vision acceptance."""
import io,json,base64
import pytest
import httpx
from PIL import Image
from fastapi.testclient import TestClient
from app.main import create_app
from app.ai_provider import BailianProvider,AIError
from test_accounts import register,HEADERS
from test_materials import upload
from test_ai import configured


def png(value=50,orientation=None):
    image=Image.new('RGB',(400,200),'white');out=io.BytesIO()
    if orientation:
        exif=Image.Exif();exif[274]=orientation;image.save(out,format='JPEG',exif=exif)
    else:image.save(out,format='PNG')
    return out.getvalue()


def label(value='50',category='满意'):
    return {'label':value+'%','value':value,'unit':'%','category':category,'metric':'纳入记录满意率','period':None,
            'bbox':{'x':.1,'y':.1,'width':.3,'height':.3},'explicit':True,'uncertainties':[]}


class Vision:
    is_test=True
    def __init__(self):self.response={'candidates':[label(),label(category='不满意')],'message':'离线构造'};self.fail=False;self.calls=0
    async def complete(self,messages,**kwargs):
        self.calls+=1
        assert isinstance(messages[-1]['content'],list)
        if self.fail:raise AIError('离线模拟超时')
        return {'content':json.dumps(self.response,ensure_ascii=False)},{'prompt_tokens':99,'completion_tokens':20,'total_tokens':119}


def seed(c):
    register(c);pid=c.post('/api/projects',headers=HEADERS,json={'name':'图片独立合成测试','goal':'verify'}).json()['id']
    raw=('编号,纳入标记,服务评价\n'+'\n'.join(f'{i},是,{"满意" if i<=4 else "不满意" if i<=8 else ""}' for i in range(1,11))+'\n11,否,满意\n12,否,不满意\n').encode('utf-8-sig')
    table=upload(c,pid,'合成.csv',raw)
    image=upload(c,pid,'合成.png',png())
    r=c.post(f'/api/projects/{pid}/reports',headers=HEADERS,json={'name':'合成规则','text':'纳入记录满意率：以纳入标记为是的全部记录为分母，服务评价为满意为分子；保留评价空值，不去重，按记录统计，0位小数。'}).json()
    c.put(f"/api/projects/{pid}/rule-materials/{r['id']}",headers=HEADERS,json={'enabled':True})
    para=c.get(f"/api/assets/{r['id']}/preview").json()['paragraphs'][0]
    sheet=table['summary']['sheets'][0];columns=sheet['columns']
    constraints={'asset_id':table['id'],'sheet_id':sheet['id'],'operation':'ratio','metric':'纳入记录满意率','scope_description':'纳入标记为是的记录',
                 'scope':[{'column_id':columns[1]['id'],'kind':'text','value':'是'}],'numerator':[{'column_id':columns[2]['id'],'kind':'text','value':'满意'}],'null_policy':'keep','precision':0}
    head=c.get(f'/api/projects/{pid}/rule-snapshots').json()
    req={'previous_id':head['current_id'],'context_hash':head['context_hash'],'constraints':constraints,'sources':{k:{'asset_id':r['id'],'paragraph_id':para['id'],'quote':para['text']} for k in constraints},'confirmed_fields':list(constraints),'unresolved':[],'change_reason':'离线明确全部规则'}
    saved=c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=req);assert saved.status_code==201,saved.text
    return pid,table,image,saved.json(),raw


def start(c,pid,image):
    r=c.post(f'/api/projects/{pid}/image-tasks',headers=HEADERS,json={'asset_id':image['id'],'region':{'x':0,'y':0,'width':1,'height':1},'consent':True})
    assert r.status_code==201,r.text
    return c.get('/api/image-tasks/'+r.json()['id']).json()


def select(c,t,target=None,index=0,reason=''):
    r=c.post(f"/api/image-tasks/{t['id']}/select",headers=HEADERS,json={'index':index,'target':target or t['payload']['candidates'][index],
       'recognition_confirmed':True,'correction_reason':reason})
    assert r.status_code==200,r.text
    return r.json()


def bound(c,t,rule):
    r=c.post(f"/api/image-tasks/{t['id']}/bind-rule",headers=HEADERS,json={'snapshot_id':rule['id']});assert r.status_code==200,r.text
    t=r.json()
    return t,{'selection_hash':t['payload']['selection_hash'],'plan':{**t['payload']['draft_plan'],'confirmed':True},'rule_snapshot_id':rule['id'],
              'citation_ids':[x['citation_id'] for x in t['payload']['citations']],'meaning_confirmed':True,'applicability_note':'离线人工确认图中类别与规则及范围；期间未显示，不捏造。'}


def test_image_50_40_originals_snapshots_persistence_and_account_isolation(tmp_path):
    provider=Vision();settings=configured(tmp_path)
    with TestClient(create_app(settings,provider)) as c:
        pid,table,image,rule,raw=seed(c);t=start(c,pid,image)
        assert t['source']['type']=='image' and 'paragraph' not in t['source']
        assert t['request_count']==1 and t['status']=='candidates'
        original=t['payload']['raw_recognition'];t=select(c,t);t,body=bound(c,t,rule)
        wrong={**body,'plan':{**body['plan'],'null_policy':'exclude'}}
        assert c.post(f"/api/image-tasks/{t['id']}/confirm",headers=HEADERS,json=wrong).status_code==409
        result=c.post(f"/api/image-tasks/{t['id']}/confirm",headers=HEADERS,json=body).json()
        assert result['result']['status']=='different' and result['result']['difference_pp']=='-10'
        assert result['run']['result']['numerator']==4 and result['run']['result']['denominator']==10
        assert result['payload']['raw_recognition']==original and provider.calls==1
        assert c.get(f"/api/assets/{table['id']}/original").content==raw
        assert c.get(f"/api/assets/{image['id']}/image").headers['content-type']=='image/png'
        again=c.post(f"/api/image-tasks/{t['id']}/confirm",headers=HEADERS,json=body).json();assert again['run_id']==result['run_id']
        c.post('/api/auth/logout',headers=HEADERS);register(c,'image-other@example.com')
        for url in [f'/api/image-tasks/{t["id"]}',f'/api/projects/{pid}/image-tasks',f'/api/assets/{image["id"]}/image',f'/api/assets/{image["id"]}/original']:
            assert c.get(url).status_code==404
        assert c.post(f"/api/image-tasks/{t['id']}/confirm",headers=HEADERS,json=body).status_code==404
        for suffix,request in [('select',{'index':0,'target':label(),'recognition_confirmed':True}),('bind-rule',{'snapshot_id':rule['id']}),
                               ('plan-check',{'plan':body['plan']}),('cancel',None),('retry',None)]:
            assert c.post(f"/api/image-tasks/{t['id']}/{suffix}",headers=HEADERS,json=request).status_code==404
    with TestClient(create_app(settings,provider)) as c:
        assert c.post('/api/auth/login',headers=HEADERS,data={'username':'owner@example.com','password':'Example123!'}).status_code==204
        restored=c.get('/api/image-tasks/'+t['id']).json()
        assert restored['result']==result['result'] and restored['payload']['raw_recognition']==original
        assert restored['run_id']==result['run_id'] and provider.calls==1


def test_correction_selection_hash_same_number_category_units_periods_and_rule_change(tmp_path):
    with TestClient(create_app(configured(tmp_path),Vision())) as c:
        pid,_,image,rule,_=seed(c);t=select(c,start(c,pid,image));t,body=bound(c,t,rule)
        corrected={**label('40'),'period':None};t=select(c,t,corrected,reason='人工对照原图将错误50修正为40')
        assert t['payload']['raw_recognition']['candidates'][0]['value']=='50'
        assert t['payload']['target']['value']=='40' and not t['payload'].get('confirmed_plan')
        t,newbody=bound(c,t,rule)
        oldbody={**newbody,'selection_hash':body['selection_hash']};assert c.post(f"/api/image-tasks/{t['id']}/confirm",headers=HEADERS,json=oldbody).status_code==409
        r=c.post(f"/api/image-tasks/{t['id']}/confirm",headers=HEADERS,json=newbody).json();assert r['result']['status']=='consistent'
        other=select(c,start(c,pid,image),index=1);other,ob=bound(c,other,rule)
        assert c.post(f"/api/image-tasks/{other['id']}/confirm",headers=HEADERS,json=ob).status_code==409
        p=select(c,start(c,pid,image),{**label(),'period':'2024年'},reason='明确图中期间');p,pb=bound(c,p,rule)
        assert c.post(f"/api/image-tasks/{p['id']}/confirm",headers=HEADERS,json=pb).status_code==409
        bad=c.post(f"/api/image-tasks/{p['id']}/select",headers=HEADERS,json={'index':0,'target':{**label(),'unit':'百分点'},'recognition_confirmed':True,'correction_reason':'离线单位不符'})
        assert bad.status_code==409
        c.post(f'/api/projects/{pid}/reports',headers=HEADERS,json={'name':'新资料','text':'触发保守失效'})
        assert c.post(f"/api/image-tasks/{p['id']}/confirm",headers=HEADERS,json=pb).status_code==409
        saved=c.get(f"/api/image-tasks/{t['id']}").json();assert saved['status']=='stale' and saved['result']['status']=='consistent'


def test_missing_labels_invalid_upload_orientation_and_failure_retry(tmp_path):
    provider=Vision();provider.response={'candidates':[],'message':'没有可见标签'}
    with TestClient(create_app(configured(tmp_path),provider)) as c:
        pid,_,image,rule,_=seed(c);t=start(c,pid,image);assert t['status']=='insufficient' and not t['result']
        bad=upload(c,pid,'坏.png',b'not an image')
        assert c.get(f"/api/assets/{bad['id']}").json()['status']=='failed'
        rotated=upload(c,pid,'转向.jpg',png(orientation=6));info=c.get(f"/api/assets/{rotated['id']}").json()
        assert info['summary']['width']==200 and info['summary']['height']==400
        assert c.get(f"/api/assets/{rotated['id']}/original").content==png(orientation=6)
        provider.fail=True;t=start(c,pid,image);assert t['status']=='failed' and t['request_count']==1
        provider.fail=False
        r=c.post(f"/api/image-tasks/{t['id']}/retry",headers=HEADERS);assert r.status_code==200
        saved=c.get('/api/image-tasks/'+t['id']).json();assert saved['status']=='insufficient' and saved['request_count']==2
        assert c.post(f"/api/projects/{pid}/image-tasks",headers=HEADERS,json={'asset_id':image['id'],'region':{'x':.9,'y':0,'width':.5,'height':1},'consent':True}).status_code==422


def test_client_multimodal_limits_keep_text_and_total_guards(tmp_path,monkeypatch):
    settings=configured(tmp_path);provider=BailianProvider(settings)
    calls=[]
    async def post(self,url,**kwargs):
        calls.append(kwargs['json']);return httpx.Response(200,json={'choices':[{'message':{'content':'{}'},'finish_reason':'stop'}],'usage':{}})
    monkeypatch.setattr(httpx.AsyncClient,'post',post)
    import asyncio
    # Valid Base64 image can exceed 60k characters without being mistaken for text.
    im=Image.effect_noise((800,800),100).convert('RGB');out=io.BytesIO();im.save(out,format='PNG')
    data=base64.b64encode(out.getvalue()).decode();assert len(data)>60000
    messages=[{'role':'user','content':[{'type':'image_url','image_url':{'url':'data:image/png;base64,'+data}},{'type':'text','text':'JSON'}]}]
    asyncio.run(provider.complete(messages,json_mode=True));assert len(calls)==1
    for content in [[{'type':'text','text':'x'*60001}],messages[0]['content']*2,[{'type':'image_url','image_url':{'url':'https://example.com/x.png'}}]]:
        with pytest.raises(AIError):asyncio.run(provider.complete([{'role':'user','content':content}]))
    limited=BailianProvider(settings.model_copy(update={'ai_max_request_bytes':65536}))
    with pytest.raises(AIError,match='请求总量'):asyncio.run(limited.complete(messages,json_mode=True))
    assert len(calls)==1


def test_rule_change_bypasses_cancel_and_invalid_response_never_pass(tmp_path):
    provider=Vision()
    with TestClient(create_app(configured(tmp_path),provider)) as c:
        pid,_,image,rule,_=seed(c);t=select(c,start(c,pid,image));t,body=bound(c,t,rule)
        # A new immutable snapshot, even with unchanged data, revokes old confirmation.
        head=c.get(f'/api/projects/{pid}/rule-snapshots').json()
        request={'previous_id':rule['id'],'context_hash':head['context_hash'],'constraints':rule['constraints'],
                 'sources':{k:{'asset_id':v['asset_id'],'paragraph_id':v['paragraph_id'],'quote':v['quote']} for k,v in rule['sources'].items()},
                 'confirmed_fields':list(rule['constraints']),'unresolved':[],'change_reason':'再次明确规则，需要重新绑定'}
        newer=c.post(f'/api/projects/{pid}/rule-snapshots',headers=HEADERS,json=request)
        assert newer.status_code==201
        assert c.post(f"/api/image-tasks/{t['id']}/confirm",headers=HEADERS,json=body).status_code==409
        t,new_body=bound(c,t,newer.json())
        assert t['context_hash']==new_body['plan']['context_hash'] and not t['stale']
        cancelled=c.post(f"/api/image-tasks/{t['id']}/cancel",headers=HEADERS);assert cancelled.json()['status']=='cancelled'
        assert c.post(f"/api/image-tasks/{t['id']}/select",headers=HEADERS,json={'index':0,'target':label(),'recognition_confirmed':True}).status_code==409
        provider.response={'candidates':[{'value':'50','not_a_label':True}],'message':'坏格式'}
        bad=start(c,pid,image);assert bad['status']=='failed' and not bad['result']
        assert bad['payload']['raw_recognition']==provider.response and bad['payload']['raw_message']
        provider.response={'candidates':[label()],'message':'没有规则不能通过'}
        sources=c.get(f'/api/projects/{pid}/rule-materials').json()
        for aid in sources:c.put(f'/api/projects/{pid}/rule-materials/{aid}',headers=HEADERS,json={'enabled':False})
        no_rule=select(c,start(c,pid,image));assert no_rule['status']=='insufficient' and not no_rule['result']


def test_image_limits_crop_and_six_attempts(tmp_path):
    provider=Vision();settings=configured(tmp_path)
    with TestClient(create_app(settings,provider)) as c:
        pid,_,image,_,_=seed(c)
        crop={'x':.1234,'y':.1123,'width':.6789,'height':.789}
        response=c.post(f'/api/projects/{pid}/image-tasks',headers=HEADERS,json={'asset_id':image['id'],'region':crop,'consent':True})
        t=c.get('/api/image-tasks/'+response.json()['id']).json();source=t['source']
        assert source['crop_pixels']==[49,22,321,180] and source['region']['x']==49/400
        provider.fail=True;t=start(c,pid,image)
        for _ in range(5):assert c.post(f"/api/image-tasks/{t['id']}/retry",headers=HEADERS).status_code==200
        saved=c.get('/api/image-tasks/'+t['id']).json();assert saved['request_count']==6 and saved['status']=='failed'
        assert c.post(f"/api/image-tasks/{t['id']}/retry",headers=HEADERS).status_code==409
    with TestClient(create_app(settings.model_copy(update={'image_max_bytes':1024,'image_max_pixels':10000}),provider)) as c:
        c.post('/api/auth/login',headers=HEADERS,data={'username':'owner@example.com','password':'Example123!'})
        noise=Image.effect_noise((100,100),100).convert('RGB');out=io.BytesIO();noise.save(out,format='PNG')
        assert c.post(f'/api/projects/{pid}/assets',headers=HEADERS,files={'file':('large.png',out.getvalue())}).status_code==413
        oversized=upload(c,pid,'oversized.png',png());assert oversized['status']=='failed' and '像素' in oversized['error']
