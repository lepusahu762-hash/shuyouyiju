import asyncio
import hashlib
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select, update, func
from .models import Asset, Project, new_id, now
from .projects import owned_project, project_is_deleted
from .parsers import parse_file, ParseError
from .image_files import parse_image


class ParseOptions(BaseModel):
    encoding: Literal["auto", "utf-8-sig", "gb18030", "utf-16"] = "auto"
    delimiter: Literal["auto", ",", ";", "\t", "|"] = "auto"


class PastedReport(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=1000000)


class FieldMeaning(BaseModel):
    meaning: str = Field(default="", max_length=1000)
    unit: str = Field(default="", max_length=100)


class AnnotationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(ge=0)
    fields: dict[str, FieldMeaning]


def asset_view(asset):
    result = asset.result or {}
    summary = {key: value for key, value in result.items() if key not in {"sheets", "paragraphs"}}
    if result.get("sheets") is not None:
        summary["sheets"] = [{k: v for k, v in sheet.items() if k != "rows"} for sheet in result["sheets"]]
    return {"id": asset.id, "project_id": asset.project_id, "name": asset.original_name, "kind": asset.kind,
            "extension": asset.extension, "size_bytes": asset.size_bytes, "sha256": asset.sha256,
            "status": asset.status, "error": asset.error, "parse_options": asset.parse_options,
            "summary": summary, "annotations": asset.annotations, "annotation_version": asset.annotation_version,
            "source_version": 1, "created_at": asset.created_at, "updated_at": asset.updated_at}


def material_router(database, settings, current_user):
    router = APIRouter(prefix="/api", tags=["materials"])

    async def owned_asset(session, aid, user):
        asset = await session.scalar(select(Asset).join(Project).where(
            Asset.id == aid, Project.owner_id == user.id, ~project_is_deleted))
        if asset is None:
            raise HTTPException(404, "资料不存在或无权访问。")
        return asset

    async def reserve_slot(session, project):
        # SQLite serializes this write and the count/insert in the same transaction.
        await session.execute(update(Project).where(Project.id == project.id).values(updated_at=now()))
        count = await session.scalar(select(func.count(Asset.id)).where(Asset.project_id == project.id))
        if count >= settings.max_project_files:
            raise HTTPException(409, f"每个项目当前最多 {settings.max_project_files} 份资料，请新建项目。")

    async def run_parse(aid):
        async with database.sessions() as session:
            asset = await session.get(Asset, aid)
            if asset is None or asset.status != "uploaded":
                return
            asset.status = "parsing"
            asset.updated_at = now()
            await session.commit()
            try:
                result = await asyncio.to_thread(parse_image, settings.storage_dir / asset.stored_name,asset.id,settings) if asset.kind=="image" else await asyncio.to_thread(parse_file, settings.storage_dir / asset.stored_name,
                                                 asset.extension, asset.id, asset.parse_options, settings)
                asset.result = result
                asset.status = "ready"
                asset.error = None
            except ParseError as error:
                asset.result = None
                asset.status = "failed"
                asset.error = str(error)
            asset.updated_at = now()
            await session.execute(update(Project).where(Project.id == asset.project_id).values(updated_at=now()))
            await session.commit()

    @router.get("/projects/{project_id}/assets")
    async def list_assets(project_id: str, user=Depends(current_user), session=Depends(database.session)):
        await owned_project(session, project_id, user)
        rows = (await session.scalars(select(Asset).where(Asset.project_id == project_id).order_by(Asset.created_at))).all()
        return [asset_view(asset) for asset in rows]

    @router.post("/projects/{project_id}/assets", status_code=201)
    async def upload(project_id: str, tasks: BackgroundTasks, file: UploadFile = File(...), user=Depends(current_user), session=Depends(database.session)):
        project = await owned_project(session, project_id, user)
        name = (file.filename or "").replace("\\", "/").split("/")[-1].replace("\r", "").replace("\n", "")
        extension = Path(name).suffix.lower()
        if extension not in {".csv", ".xlsx", ".docx", ".png", ".jpg", ".jpeg"}:
            raise HTTPException(415, "当前支持 CSV、XLSX、DOCX、PNG、JPEG。PDF导入、XLS及宏文件尚未接通。")
        if not name or len(name) > 255:
            raise HTTPException(422, "文件名为空或超过 255 个字符。")
        await reserve_slot(session, project)
        aid = new_id()
        stored_name = aid + extension
        target = settings.storage_dir / stored_name
        digest, size = hashlib.sha256(), 0
        try:
            with target.open("xb") as original:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > (min(settings.max_upload_bytes,settings.image_max_bytes) if extension in {".png",".jpg",".jpeg"} else settings.max_upload_bytes):
                        limit = min(settings.max_upload_bytes, settings.image_max_bytes) if extension in {'.png','.jpg','.jpeg'} else settings.max_upload_bytes
                        raise HTTPException(413, f"单个文件最多 {limit // 1024 // 1024} MiB。请拆分后上传。")
                    digest.update(chunk)
                    original.write(chunk)
            if size == 0:
                raise HTTPException(422, "文件为空，请选择有内容的文件。")
            asset = Asset(id=aid, project_id=project.id, original_name=name, extension=extension,
                          kind="table" if extension in {".csv", ".xlsx"} else "image" if extension in {".png",".jpg",".jpeg"} else "report", stored_name=stored_name,
                          size_bytes=size, sha256=digest.hexdigest(), status="uploaded", parse_options={"encoding": "auto", "delimiter": "auto"})
            session.add(asset)
            await session.commit()
        except BaseException:
            if target.exists():
                target.unlink()  # Only the UUID path created by this uncommitted upload.
            raise
        finally:
            await file.close()
        tasks.add_task(run_parse, aid)
        return asset_view(asset)

    @router.post("/projects/{project_id}/reports", status_code=201)
    async def paste_report(project_id: str, body: PastedReport, tasks: BackgroundTasks, user=Depends(current_user), session=Depends(database.session)):
        project = await owned_project(session, project_id, user)
        if not body.name.strip() or not body.text.strip():
            raise HTTPException(422, "报告名称和正文不能只包含空白。")
        if len(body.text.splitlines()) > 20000:
            raise HTTPException(422, "粘贴报告最多 20000 行，请拆分。")
        await reserve_slot(session, project)
        aid = new_id()
        raw = body.text.encode("utf-8")
        target = settings.storage_dir / (aid + ".txt")
        try:
            target.write_bytes(raw)
            asset = Asset(id=aid, project_id=project.id, original_name=body.name.strip(), extension=".txt", kind="report",
                          stored_name=target.name, size_bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(), status="uploaded")
            session.add(asset)
            await session.commit()
        except BaseException:
            if target.exists():
                target.unlink()
            raise
        tasks.add_task(run_parse, aid)
        return asset_view(asset)

    @router.get("/assets/{asset_id}")
    async def get_asset(asset_id: str, user=Depends(current_user), session=Depends(database.session)):
        return asset_view(await owned_asset(session, asset_id, user))

    @router.get("/assets/{asset_id}/preview")
    async def preview(asset_id: str, sheet: str = "s1", offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100), user=Depends(current_user), session=Depends(database.session)):
        asset = await owned_asset(session, asset_id, user)
        if asset.status != "ready" or not asset.result:
            raise HTTPException(409, asset.error or "资料仍在解析，请稍后再查看。")
        result = asset.result
        if result["kind"]=="image":return result
        if result["kind"] == "table":
            selected = next((item for item in result["sheets"] if item["id"] == sheet), None)
            if selected is None:
                raise HTTPException(404, "工作表不存在。")
            return {"kind": "table", "sheet_id": sheet, "columns": selected["columns"], "total": selected["row_count"],
                    "rows": selected["rows"][offset:offset+limit], "offset": offset, "limit": limit}
        return {"kind": "report", "total": result["paragraph_count"], "paragraphs": result["paragraphs"][offset:offset+limit], "offset": offset, "limit": limit}

    @router.get("/assets/{asset_id}/image")
    async def preview_image(asset_id:str,user=Depends(current_user),session=Depends(database.session)):
        asset=await owned_asset(session,asset_id,user)
        if asset.kind!='image' or asset.status!='ready':raise HTTPException(409,'图片尚未成功解析。')
        target=settings.data_dir.resolve()/'image_previews'/(asset.id+'.png')
        if not target.is_file():raise HTTPException(410,'图片预览缺失，请恢复备份。')
        if hashlib.sha256(target.read_bytes()).hexdigest()!=asset.result['normalized_sha256']:raise HTTPException(409,'图片预览完整性检查失败。')
        return FileResponse(target,media_type='image/png')

    @router.get("/assets/{asset_id}/original")
    async def download_original(asset_id: str, user=Depends(current_user), session=Depends(database.session)):
        asset = await owned_asset(session, asset_id, user)
        target = settings.storage_dir / asset.stored_name
        if not target.is_file():
            raise HTTPException(410, "原文件已缺失，请联系维护者恢复备份。")
        name = asset.original_name if asset.extension != ".txt" else asset.original_name + ".txt"
        return FileResponse(target, media_type="application/octet-stream", filename=name)

    @router.post("/assets/{asset_id}/retry", status_code=202)
    async def retry(asset_id: str, options: ParseOptions, tasks: BackgroundTasks, user=Depends(current_user), session=Depends(database.session)):
        asset = await owned_asset(session, asset_id, user)
        result = await session.execute(update(Asset).where(Asset.id == asset.id, Asset.status == "failed").values(status="uploaded", error=None, parse_options=options.model_dump(), updated_at=now()))
        if result.rowcount != 1:
            raise HTTPException(409, "只有解析失败的资料可以重试；正在解析时请勿重复提交。")
        await session.commit()
        tasks.add_task(run_parse, asset_id)
        return {"id": asset_id, "status": "uploaded"}

    @router.put("/assets/{asset_id}/fields")
    async def save_fields(asset_id: str, body: AnnotationUpdate, user=Depends(current_user), session=Depends(database.session)):
        asset = await owned_asset(session, asset_id, user)
        if asset.status != "ready" or asset.kind != "table":
            raise HTTPException(409, "请等待表格解析成功后补充字段。")
        column_ids = {column["id"] for sheet in asset.result["sheets"] for column in sheet["columns"]}
        if not set(body.fields).issubset(column_ids):
            raise HTTPException(422, "包含不属于这份资料的字段标识，请刷新资料后重试。")
        fields = {key: value.model_dump() for key, value in body.fields.items()}
        result = await session.execute(update(Asset).where(Asset.id == asset_id, Asset.annotation_version == body.version).values(annotations=fields, annotation_version=body.version + 1, updated_at=now()))
        if result.rowcount != 1:
            raise HTTPException(409, "字段说明已在其他页面更新。当前输入未保存，请重新载入后合并。")
        await session.execute(update(Project).where(Project.id == asset.project_id).values(updated_at=now()))
        await session.commit()
        return {"annotations": fields, "annotation_version": body.version + 1}

    return router
