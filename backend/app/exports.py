"""Private immutable PDF exports from explicit saved selections. No compute/AI."""
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, func, update
from .models import (Project, CalculationRun, CalculationEvidence, PdfExport, ReportRevision, RevisionThread,
                     RevisionRecheck, NumericCheck, new_id, now)
from .projects import owned_project
from .calculations import project_context, digest, check_view
from .revisions import owned_revision, revision_view, revision_target
from .pdf_report import build_pdf

EVIDENCE_LIMIT = 30
FORMAT_VERSION = 'single-conclusion-pdf-v1'


class Selection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    source_check_id: str
    revision_id: str
    # Explicit null means pending export; omission must not select a recent event.
    recheck_id: str | None


class Generate(Selection):
    preview_hash: str = Field(min_length=64,max_length=64)


async def snapshot_for(session, pid, body, user):
    project = await owned_project(session,pid,user)
    revision,thread = await owned_revision(session,pid,body.revision_id,user)
    if thread.source_check_id != body.source_check_id:
        raise HTTPException(409,'所选原句、修订版本不对应，请重新选择并预览。')
    current,_ = await project_context(session,project)
    view = await revision_view(session,revision,thread,current)
    selected = next((e for e in view['rechecks'] if e['id']==body.recheck_id),None) if body.recheck_id else None
    if body.recheck_id and not selected:
        raise HTTPException(404,'所选复核不存在、不属于此版本或无权访问。')
    semantic = revision_target(revision.basis['report']['paragraph']['text'],thread.target_index,revision.text) is None
    warnings=[]
    if not selected:
        status='manual_required' if semantic else 'pending'
        warnings.append('没有选择此版本的具体复核记录，按待复核导出；不能用原核验或其他版本结果填充。')
    else:
        status='stale' if selected['stale'] else selected['result']['status']
        if selected['stale']:warnings.extend(selected['stale_reasons'])
        if selected['result']['status'] != 'consistent':warnings.append(selected['result']['message'])
    if semantic:
        status='manual_required';warnings.append('修订已改变目标数字之外的内容，可能涉及对象、期间、指标或范围，需人工核验。')
    if thread.head_id!=revision.id:warnings.append('所选为历史修订版本，已有后续版本。该版本号仅属于本条原句。')
    if view['recheck_block_reason']:warnings.append(view['recheck_block_reason'])
    if revision.action=='keep':warnings.append('用户选择保留原句，原因仅记录决定，不消除原差异或证据不足。')
    original_run = revision.basis['run']
    original_record=await session.get(NumericCheck,thread.source_check_id)
    original_calculation=await session.get(CalculationRun,original_record.run_id)
    original_current=check_view(original_record,original_calculation,current)
    selected_run = selected['run'] if selected else None
    evidence_run = selected_run or original_run
    evidence=(await session.scalars(select(CalculationEvidence).where(CalculationEvidence.run_id==evidence_run['id']).order_by(CalculationEvidence.ordinal).limit(EVIDENCE_LIMIT))).all()
    dependencies={'context_hash':digest(current),'head_id':thread.head_id,'project_name':project.name,
                  'recheck_ids':[e['id'] for e in view['rechecks']], 'confirmation_id':view['confirmation']['id'] if view['confirmation'] else None}
    # Explicit allowlist: no user, session, model configuration or logs in reports.
    def compact(run):
        return {k:run[k] for k in ['id','created_at','source','spec','result','method_version']}
    event = {k:selected[k] for k in ['id','created_at','result','stale','stale_reasons']} if selected else None
    return {'format_version':FORMAT_VERSION,'project_id':pid,'project_name':project.name,
            'report':revision.basis['report'],'source_check_id':thread.source_check_id,'target_index':thread.target_index,
            'revision':{k:view[k] for k in ['id','version','parent_id','restored_from','text','action','reason','created_at']},
            'status':status,'semantic_changed':semantic,'warnings':list(dict.fromkeys(warnings)),
            'original_check':revision.basis['source_check'],'original_run':compact(original_run),
            'original_current_status':original_current['status'],'original_stale_reasons':original_current['stale_reasons'],
            'recheck':event,'selected_run':compact(selected_run) if selected_run else None,
            'original_rule':revision.basis.get('rule_snapshot'),
            'selected_rule':selected['confirmation']['rule_snapshot'] if selected else None,
            'evidence':{'limit':EVIDENCE_LIMIT,'label':'所选复核的保存证据' if selected else '仅为原核验依据摘录，不是此修订版本的复核结果',
                        'rows':[{'row':e.row,'in_scope':e.in_scope,'in_numerator':e.in_numerator,'reason':e.reason} for e in evidence]},
            'dependencies':dependencies}


async def export_view(session,record,project,current):
    # Callers have checked the actual authenticated owner of this project.
    revision = await session.get(ReportRevision,record.revision_id)
    thread = await session.get(RevisionThread,revision.thread_id)
    deps=record.snapshot['dependencies']
    reasons=[]
    if deps['context_hash']!=digest(current):reasons.append('项目资料或规则已变化')
    if deps['head_id']!=thread.head_id or thread.head_id!=revision.id:reasons.append('此原句已有后续修订，当前文件属于历史版本')
    if deps['project_name']!=project.name:reasons.append('项目名称已变化')
    events=list((await session.scalars(select(RevisionRecheck.id).where(RevisionRecheck.revision_id==revision.id).order_by(RevisionRecheck.created_at.desc(),RevisionRecheck.id))).all())
    if deps['recheck_ids']!=events:reasons.append('此版本已有新的复核记录')
    return {'id':record.id,'project_id':record.project_id,'revision_id':record.revision_id,'recheck_id':record.recheck_id,
            'source_check_id':record.snapshot['source_check_id'],'version':record.snapshot['revision']['version'],
            'report_name':record.snapshot['report']['name'],'created_at':record.created_at,'status':record.status,
            'report_status':record.snapshot['status'],'historical':bool(reasons),'historical_reasons':reasons,
            'error':record.error,'sha256':record.sha256,'size_bytes':record.size_bytes}


def exports_router(database,settings,current_user):
    router=APIRouter(prefix='/api/projects/{pid}',tags=['single-conclusion-pdf'])

    @router.post('/exports/preview')
    async def preview(pid:str,body:Selection,user=Depends(current_user),session=Depends(database.session)):
        snapshot=await snapshot_for(session,pid,body,user)
        return {'preview_hash':digest(snapshot),'snapshot':snapshot}

    @router.post('/exports',status_code=201)
    async def generate(pid:str,body:Generate,user=Depends(current_user),session=Depends(database.session)):
        project=await owned_project(session,pid,user)
        # Serialize state validation and rendering, without updating user project data.
        await session.execute(update(Project).where(Project.id==pid).values(id=pid))
        await session.refresh(project)
        snapshot=await snapshot_for(session,pid,body,user)
        if digest(snapshot)!=body.preview_hash:
            raise HTTPException(409,'预览后资料、规则、修订或复核状态已变化，请刷新预览并再次确认，未生成PDF。')
        eid=new_id();timestamp=now()
        snapshot.update(export_id=eid,exported_at=timestamp,timezone='UTC+08:00')
        record=PdfExport(id=eid,project_id=pid,revision_id=body.revision_id,recheck_id=body.recheck_id,
                         snapshot=snapshot,approval_hash=body.preview_hash,status='failed',created_at=timestamp)
        directory=settings.data_dir.resolve()/'exports'
        file=directory/(eid+'.pdf');temporary=directory/(eid+'.tmp')
        try:
            data=await run_in_threadpool(build_pdf,snapshot,settings)
            directory.mkdir(parents=True,exist_ok=True)
            temporary.write_bytes(data)
            temporary.replace(file)
            record.status='completed';record.sha256=hashlib.sha256(data).hexdigest();record.size_bytes=len(data)
        except Exception as error:
            # No traceback, uploaded text, credentials or system paths in API errors.
            record.error='缺少或无法使用中文字体，请按运行说明配置 SYJ_PDF_FONT_PATH，重新预览后重试。' if isinstance(error,ValueError) else 'PDF生成失败，未保存可下载文件。请重新预览后重试；已保存的结果不受影响。'
            for candidate in [temporary,file]:
                if candidate.is_file():candidate.unlink()
        session.add(record)
        try:await session.commit()
        except Exception:
            if file.is_file():file.unlink()
            raise
        current,_=await project_context(session,project)
        return await export_view(session,record,project,current)

    @router.get('/exports')
    async def listing(pid:str,offset:int=Query(0,ge=0),limit:int=Query(10,ge=1,le=30),user=Depends(current_user),session=Depends(database.session)):
        project=await owned_project(session,pid,user);current,_=await project_context(session,project)
        query=select(PdfExport).where(PdfExport.project_id==pid)
        total=await session.scalar(select(func.count()).select_from(query.subquery()))
        rows=(await session.scalars(query.order_by(PdfExport.created_at.desc(),PdfExport.id).offset(offset).limit(limit))).all()
        return {'items':[await export_view(session,r,project,current) for r in rows],'offset':offset,'limit':limit,'total':total}

    async def owned_export(pid,eid,user,session):
        project=await owned_project(session,pid,user)
        record=await session.get(PdfExport,eid)
        if not record or record.project_id!=pid:raise HTTPException(404,'导出记录不存在或无权访问。')
        return project,record

    @router.get('/exports/{eid}')
    async def detail(pid:str,eid:str,user=Depends(current_user),session=Depends(database.session)):
        project,record=await owned_export(pid,eid,user,session)
        current,_=await project_context(session,project)
        return {**await export_view(session,record,project,current),'snapshot':record.snapshot}

    @router.get('/exports/{eid}/file')
    async def download(pid:str,eid:str,download:bool=False,user=Depends(current_user),session=Depends(database.session)):
        _,record=await owned_export(pid,eid,user,session)
        if record.status!='completed':raise HTTPException(409,record.error or '该导出尚未生成可下载文件，请重新预览并重试。')
        # Stored UUID, never user-controlled filename/path. No public static mount.
        path=settings.data_dir.resolve()/'exports'/(record.id+'.pdf')
        if not path.is_file():raise HTTPException(410,'已保存PDF文件缺失，请恢复备份；不会以当前结果替换历史文件。')
        data=await run_in_threadpool(path.read_bytes)
        if hashlib.sha256(data).hexdigest()!=record.sha256:raise HTTPException(409,'PDF完整性检查失败，请恢复备份；历史文件不会被自动重建。')
        return FileResponse(path,media_type='application/pdf',filename=f'数有依据-单条核验-v{record.snapshot["revision"]["version"]}-{record.id[:8]}.pdf',
                            content_disposition_type='attachment' if download else 'inline',headers={'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'})

    @router.get('/exports/{eid}/pages/{page_number}')
    async def page_preview(pid:str,eid:str,page_number:int,user=Depends(current_user),session=Depends(database.session)):
        # Render only the requested page of the immutable saved PDF, not its data.
        # This also works on mobile browsers without an embedded PDF plugin.
        _,record=await owned_export(pid,eid,user,session)
        if record.status!='completed':raise HTTPException(409,'该记录没有可预览PDF，请检查失败原因后重新生成。')
        path=settings.data_dir.resolve()/'exports'/(record.id+'.pdf')
        if not path.is_file():raise HTTPException(410,'历史PDF文件缺失，请恢复备份，不会自动重建。')
        data=await run_in_threadpool(path.read_bytes)
        if hashlib.sha256(data).hexdigest()!=record.sha256:raise HTTPException(409,'历史PDF完整性检查失败，无法预览。')
        def render():
            import pymupdf
            with pymupdf.open(stream=data,filetype='pdf') as document:
                if not 1<=page_number<=len(document):raise HTTPException(422,'PDF页码超出实际范围。')
                return document[page_number-1].get_pixmap(matrix=pymupdf.Matrix(1.3,1.3)).tobytes('png'),len(document)
        try:image,pages=await run_in_threadpool(render)
        except HTTPException:raise
        except Exception:raise HTTPException(503,'此PDF页面暂时无法预览，可以下载原文件，或稍后重试预览。') from None
        return Response(image,media_type='image/png',headers={'X-PDF-Pages':str(pages),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})

    return router
