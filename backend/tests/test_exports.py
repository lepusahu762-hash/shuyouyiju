"""Saved-result exports only. Real embedded-font PDFs; no calculation or AI on export."""
import hashlib
import io
import sqlite3
import pymupdf as fitz
from pypdf import PdfReader
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from test_revisions import seed,save,confirm,recheck,NoModel
from test_accounts import HEADERS,register


def selection(source,revision,event=None):
    return {'source_check_id':source['id'],'revision_id':revision['id'],'recheck_id':event['id'] if event else None}


def preview(c,pid,body):
    r=c.post(f'/api/projects/{pid}/exports/preview',headers=HEADERS,json=body)
    assert r.status_code==200,r.text
    return r.json()


def generate(c,pid,body):
    plan=preview(c,pid,body)
    r=c.post(f'/api/projects/{pid}/exports',headers=HEADERS,json={**body,'preview_hash':plan['preview_hash']})
    assert r.status_code==201,r.text
    assert r.json()['status']=='completed',r.text
    return r.json()


def pdf(c,pid,record):
    r=c.get(f'/api/projects/{pid}/exports/{record["id"]}/file')
    assert r.status_code==200,r.text
    assert r.headers['content-type']=='application/pdf'
    assert r.content.startswith(b'%PDF-')
    return r.content


def test_selection_states_real_pdf_plaintext_unchanged_results(tmp_path,monkeypatch):
    settings=Settings(data_dir=tmp_path)
    with TestClient(create_app(settings,NoModel())) as c:
        pid,table,raw,source,rule=seed(c);original=source['report']['paragraph']['text']
        one=save(c,pid,source,original.replace('50%','40%',1));one=recheck(c,pid,one,confirm(c,pid,one,source))
        two=save(c,pid,source,original.replace('50%','45%',1),one['id']);two=recheck(c,pid,two,confirm(c,pid,two,source))
        pending=save(c,pid,source,original.replace('50%','40%',1),two['id'])
        manual=save(c,pid,source,original.replace('本期','去年').replace('50%','40%',1),pending['id'])
        with sqlite3.connect(tmp_path/'shuyouyiju.sqlite3') as db:
            before={t:db.execute(f'select * from {t}').fetchall() for t in ['assets','calculation_runs','numeric_checks','rule_snapshots','report_revisions','revision_rechecks','ai_tasks','projects']}
        def forbidden(*args,**kwargs):raise AssertionError('export must not calculate')
        monkeypatch.setattr('app.calculations.calculate',forbidden)
        for rev,event,expected in [(one,one['rechecks'][0],'stale'),(two,two['rechecks'][0],'stale'),(pending,None,'pending'),(manual,None,'manual_required')]:
            body=selection(source,rev,event);record=generate(c,pid,body)
            assert record['report_status']==expected
            detail=c.get(f'/api/projects/{pid}/exports/{record["id"]}').json();snapshot=detail['snapshot']
            assert snapshot['revision']['id']==rev['id']
            assert snapshot['recheck']['id']==event['id'] if event else snapshot['recheck'] is None
            if not event:assert snapshot['selected_run'] is None and snapshot['selected_rule'] is None
            content=pdf(c,pid,record);text=''.join(p.extract_text() for p in PdfReader(io.BytesIO(content)).pages)
            assert '单条结论' in text and 'UTC+08:00' in text and '不代表整篇报告通过' in text
            assert '参考指标也为50%' in text and f"v{rev['version']}" in text
            assert '本报告摘录 12 条' in text and '完整计算涉及 12 行' in text
            assert snapshot['report']['paragraph']['id'] in text.replace('\n','')
            download=c.get(f'/api/projects/{pid}/exports/{record["id"]}/file?download=true')
            assert content==download.content and 'attachment' in download.headers['content-disposition']
            assert hashlib.sha256(content).hexdigest()==record['sha256']
            image=c.get(f'/api/projects/{pid}/exports/{record["id"]}/pages/1')
            assert image.status_code==200 and image.content.startswith(b'\x89PNG')
            assert int(image.headers['x-pdf-pages'])==len(PdfReader(io.BytesIO(content)).pages)
            assert c.get(f'/api/projects/{pid}/exports/{record["id"]}/pages/0').status_code==422
            assert c.get(f'/api/projects/{pid}/exports/{record["id"]}/pages/999').status_code==422
            assert b'/FontFile2' in content  # embedded TrueType subset
            document=fitz.open(stream=content,filetype='pdf')
            assert all(page.get_pixmap().width>0 for page in document)
        assert c.get(f'/api/assets/{table["id"]}/original').content==raw
        with sqlite3.connect(tmp_path/'shuyouyiju.sqlite3') as db:
            assert all(db.execute(f'select * from {t}').fetchall()==rows for t,rows in before.items())


def test_preview_state_change_rejected_and_wrong_event_not_substituted(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path),NoModel())) as c:
        pid,table,raw,source,rule=seed(c);original=source['report']['paragraph']['text']
        one=save(c,pid,source,original.replace('50%','40%',1));one=recheck(c,pid,one,confirm(c,pid,one,source))
        body=selection(source,one,one['rechecks'][0]);plan=preview(c,pid,body)
        two=save(c,pid,source,original.replace('50%','45%',1),one['id'])
        assert c.post(f'/api/projects/{pid}/exports',headers=HEADERS,json={**body,'preview_hash':plan['preview_hash']}).status_code==409
        wrong=selection(source,two,one['rechecks'][0])
        assert c.post(f'/api/projects/{pid}/exports/preview',headers=HEADERS,json=wrong).status_code==404
        pending=generate(c,pid,selection(source,two))
        assert pending['report_status']=='pending'
        plan=preview(c,pid,selection(source,two))
        assert c.put(f'/api/projects/{pid}/rules',headers=HEADERS,json={'version':c.get(f'/api/projects/{pid}').json()['rules_version'],'rules':{'notes':'变化测试'}}).status_code==200
        assert c.post(f'/api/projects/{pid}/exports',headers=HEADERS,json={**selection(source,two),'preview_hash':plan['preview_hash']}).status_code==409
        assert c.get(f'/api/projects/{pid}/exports').json()['items'][0]['historical']


def test_private_files_persistence_bytes_failure_and_retry(tmp_path,monkeypatch):
    settings=Settings(data_dir=tmp_path)
    with TestClient(create_app(settings,NoModel())) as c:
        pid,table,raw,source,rule=seed(c);original=source['report']['paragraph']['text']
        rev=save(c,pid,source,original.replace('50%','40%',1));body=selection(source,rev)
        import app.exports as module
        real=module.build_pdf
        def fail(*args):raise ValueError('missing font')
        monkeypatch.setattr(module,'build_pdf',fail)
        plan=preview(c,pid,body)
        failed=c.post(f'/api/projects/{pid}/exports',headers=HEADERS,json={**body,'preview_hash':plan['preview_hash']}).json()
        assert failed['status']=='failed' and failed['error'] and failed['sha256'] is None
        assert c.get(f'/api/projects/{pid}/exports/{failed["id"]}/file').status_code==409
        assert not list((tmp_path/'exports').glob('*.pdf'))
        monkeypatch.setattr(module,'build_pdf',real)
        record=generate(c,pid,body);content=pdf(c,pid,record)
        cookie=c.cookies.get('syj_session')
        c.cookies.clear();register(c,'foreign-pdf@example.com')
        for endpoint in ['/exports',f'/exports/{record["id"]}',f'/exports/{record["id"]}/file',f'/exports/{record["id"]}/file?download=true',f'/exports/{record["id"]}/pages/1']:
            assert c.get(f'/api/projects/{pid}'+endpoint).status_code==404
        assert c.post(f'/api/projects/{pid}/exports/preview',headers=HEADERS,json=body).status_code==404
        assert c.post(f'/api/projects/{pid}/exports',headers=HEADERS,json={**body,'preview_hash':plan['preview_hash']}).status_code==404
        other=c.post('/api/projects',headers=HEADERS,json={'name':'其他账户'}).json()['id']
        assert c.get(f'/api/projects/{other}/exports/{record["id"]}/file').status_code==404
    with TestClient(create_app(settings,NoModel())) as c:
        c.cookies.set('syj_session',cookie)
        assert pdf(c,pid,record)==content
        assert c.put(f'/api/projects/{pid}/rules',headers=HEADERS,json={'version':c.get(f'/api/projects/{pid}').json()['rules_version'],'rules':{'notes':'规则变化后旧文件字节不可改变'}}).status_code==200
        assert pdf(c,pid,record)==content
        assert c.get(f'/api/projects/{pid}/exports/{record["id"]}').json()['historical']
        assert c.get(f'/data/exports/{record["id"]}.pdf').status_code==404
        path=tmp_path/'exports'/(record['id']+'.pdf');path.write_bytes(b'corrupt')
        assert c.get(f'/api/projects/{pid}/exports/{record["id"]}/file').status_code==409


def test_long_chinese_text_table_pagination_and_untrusted_tags(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path),NoModel())) as c:
        pid,table,raw,source,rule=seed(c)
        text=source['report']['paragraph']['text']
        # Normal product edit, not document instructions or HTML execution.
        long=('普通资料 <script>alert(1)</script> <b>不是格式指令</b> & 中文长段落。'*90)
        revision=save(c,pid,source,text+'\n'+long,reason=('说明：'+long)[:1800])
        record=generate(c,pid,selection(source,revision))
        document=PdfReader(io.BytesIO(pdf(c,pid,record)))
        extracted=''.join(p.extract_text() for p in document.pages)
        assert len(document.pages)>=5 and '<script>alert(1)</script>' in extracted
        for number,page in enumerate(document.pages,1):
            assert f'第 {number} 页' in page.extract_text()
        # Render every page: catches invalid PDFs and missing font streams.
        rendered=fitz.open(stream=pdf(c,pid,record),filetype='pdf')
        assert len(rendered)==len(document.pages)
        for page in rendered:assert page.get_pixmap(matrix=fitz.Matrix(.5,.5)).samples
