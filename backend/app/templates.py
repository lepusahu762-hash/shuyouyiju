"""Private reusable drafts. Applying a template never confirms statistical rules."""
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select, update

from .models import Project, ProjectTemplate, ProjectTemplateSnapshot, now
from .projects import owned_project, project_view


class TemplateContent(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    category: Literal["调查数据", "月度报表", "反馈统计", "其他"] = "其他"
    description: str = Field(default="", max_length=500)
    goal: Literal["analysis", "verify"] = "analysis"
    rule_notes: str = Field(default="", max_length=10000)
    report_outline: str = Field(default="", max_length=10000)

    @model_validator(mode="after")
    def has_content(self):
        if not self.rule_notes and not self.report_outline:
            raise ValueError("请填写规则草稿或报告提纲。")
        return self


class TemplateUpdate(TemplateContent):
    version: int = Field(ge=1)


class TemplateApply(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    version: int = Field(ge=1)
    request_id: UUID


BUILTINS = [
    {"id": "builtin-campus", "name": "校园调查统计口径", "category": "调查数据",
     "description": "整理有效样本范围、分子分母和空值处理，开始一项调查统计。", "goal": "analysis",
     "rule_notes": "统计对象与期间：【按本次资料填写】\n有效记录范围：【填写字段、条件及原始依据】\n分子与分母：【填写明确指标定义】\n空值处理与精度：【确认后填写】\n单位为记录／行，不自动去重。",
     "report_outline": "一、调查目的与资料来源\n二、样本范围与统计口径\n三、后台计算结果及原始行证据\n四、限制与待确认事项"},
    {"id": "builtin-monthly", "name": "经营月报检查清单", "category": "月度报表",
     "description": "复用期间、单位和数字依据的检查结构；不自动执行增长率计算。", "goal": "verify",
     "rule_notes": "报告期间：【填写】\n指标及金额单位：【填写】\n可核验的单条百分比及对应数据范围：【填写】\n基期资料是否完整：【检查后填写】\n增长率、百分点及任意公式不因使用模板而获得计算支持。",
     "report_outline": "一、本月数据来源\n二、指标与期间说明\n三、逐条数字核验记录\n四、证据不足和待补资料"},
    {"id": "builtin-feedback", "name": "活动反馈摘要", "category": "反馈统计",
     "description": "梳理活动范围、反馈等级和缺失记录，再使用现有计数或比例功能。", "goal": "analysis",
     "rule_notes": "活动范围与期间：【填写】\n纳入反馈记录的条件：【填写】\n满意等反馈等级的判定：【填写】\n未回答／空值的处理：【填写】\n分组与汇总方式：【填写】；不自动支持任意加权均值。",
     "report_outline": "一、活动与资料概况\n二、有效记录和排除说明\n三、反馈计数／占比及来源\n四、限制与改进建议"},
]


def template_view(template):
    return {**template.content, "id": template.id, "version": template.version,
            "builtin": False, "created_at": template.created_at, "updated_at": template.updated_at}


async def get_template(session, template_id, user):
    for item in BUILTINS:
        if item["id"] == template_id:
            return {**item, "version": 1, "builtin": True}
    template = await session.scalar(select(ProjectTemplate).where(
        ProjectTemplate.id == template_id, ProjectTemplate.owner_id == user.id))
    if template is None:
        raise HTTPException(404, "模板不存在或无权访问。")
    return template_view(template)


def templates_router(database, current_user):
    router = APIRouter(prefix="/api", tags=["templates"])

    @router.get("/templates")
    async def listing(user=Depends(current_user), session=Depends(database.session)):
        rows = (await session.scalars(select(ProjectTemplate).where(
            ProjectTemplate.owner_id == user.id).order_by(ProjectTemplate.updated_at.desc(), ProjectTemplate.id))).all()
        return [template_view(row) for row in rows] + [{**item, "version": 1, "builtin": True} for item in BUILTINS]

    @router.post("/templates", status_code=201)
    async def create(body: TemplateContent, user=Depends(current_user), session=Depends(database.session)):
        template = ProjectTemplate(owner_id=user.id, content=body.model_dump())
        session.add(template)
        await session.commit()
        return template_view(template)

    @router.put("/templates/{template_id}")
    async def edit(template_id: str, body: TemplateUpdate, user=Depends(current_user), session=Depends(database.session)):
        original = await get_template(session, template_id, user)
        if original["builtin"]:
            raise HTTPException(409, "内置模板不可覆盖，请另存为自己的模板。")
        content = body.model_dump(exclude={"version"})
        result = await session.execute(update(ProjectTemplate).where(
            ProjectTemplate.id == template_id, ProjectTemplate.owner_id == user.id,
            ProjectTemplate.version == body.version).values(content=content, version=body.version + 1, updated_at=now()))
        if result.rowcount != 1:
            raise HTTPException(409, "模板已在其他页面更新。请保留当前输入，关闭表单并刷新列表后重新编辑。")
        await session.commit()
        return await get_template(session, template_id, user)

    @router.post("/templates/{template_id}/projects", status_code=201)
    async def apply(template_id: str, body: TemplateApply, user=Depends(current_user), session=Depends(database.session)):
        payload = {"template_id": template_id, "name": body.name, "version": body.version}
        existing = await session.scalar(select(ProjectTemplateSnapshot).where(
            ProjectTemplateSnapshot.owner_id == user.id, ProjectTemplateSnapshot.request_id == str(body.request_id)))
        if existing:
            if existing.request != payload:
                raise HTTPException(409, "此次创建请求已用于其他内容，请重新打开使用模板表单。")
            return project_view(await owned_project(session, existing.project_id, user))
        template = await get_template(session, template_id, user)
        if template["version"] != body.version:
            raise HTTPException(409, "模板已更新，请关闭表单并刷新列表，查看最新内容后再使用。")
        project = Project(owner_id=user.id, name=body.name, goal=template["goal"])
        session.add(project)
        await session.flush()
        session.add(ProjectTemplateSnapshot(project_id=project.id, owner_id=user.id,
                    request_id=str(body.request_id), request=payload, snapshot=template))
        # One transaction: never leave an empty project if snapshot persistence fails.
        await session.commit()
        return project_view(project)

    @router.get("/projects/{project_id}/template")
    async def project_template(project_id: str, user=Depends(current_user), session=Depends(database.session)):
        await owned_project(session, project_id, user)
        applied = await session.get(ProjectTemplateSnapshot, project_id)
        return {"template": applied.snapshot if applied else None}

    return router
