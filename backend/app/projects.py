from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.sqlite import insert
from .models import Asset, DeletedProject, Project, now


project_is_deleted = select(DeletedProject.project_id).where(DeletedProject.project_id == Project.id).exists()


class ProjectCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    goal: Literal["analysis", "verify"] = "analysis"


class ProjectRename(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)


class Rules(BaseModel):
    scope: str = Field(default="", max_length=1000)
    period: str = Field(default="", max_length=500)
    definition: str = Field(default="", max_length=10000)
    missing_policy: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=5000)


class RulesUpdate(BaseModel):
    version: int = Field(ge=0)
    rules: Rules


async def owned_project(session, project_id, user, *, include_deleted=False):
    statement = select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    if not include_deleted:
        statement = statement.where(~project_is_deleted)
    project = await session.scalar(statement)
    if project is None:
        raise HTTPException(404, "项目不存在或无权访问。")
    return project


def project_view(project, count=0):
    return {"id": project.id, "name": project.name, "goal": project.goal,
            "created_at": project.created_at, "updated_at": project.updated_at,
            "asset_count": count, "rules": project.rules, "rules_version": project.rules_version}


def projects_with_asset_count(owner_id):
    return (select(Project, func.count(Asset.id)).outerjoin(Asset, Asset.project_id == Project.id)
            .where(Project.owner_id == owner_id).group_by(Project.id))


def project_router(database, current_user):
    router = APIRouter(prefix="/api/projects", tags=["projects"])

    @router.get("")
    async def list_projects(q: str = Query(default="", max_length=120), user=Depends(current_user), session=Depends(database.session)):
        statement = projects_with_asset_count(user.id).where(~project_is_deleted).order_by(Project.updated_at.desc())
        rows = (await session.execute(statement)).all()
        return [project_view(project, count) for project, count in rows if q.strip().casefold() in project.name.casefold()]

    @router.get("/deleted")
    async def list_deleted_projects(user=Depends(current_user), session=Depends(database.session)):
        statement = (projects_with_asset_count(user.id).join(DeletedProject, DeletedProject.project_id == Project.id)
                     .order_by(DeletedProject.deleted_at.desc(), Project.id))
        return [project_view(project, count) for project, count in (await session.execute(statement)).all()]

    @router.post("", status_code=201)
    async def create_project(body: ProjectCreate, user=Depends(current_user), session=Depends(database.session)):
        project = Project(name=body.name, goal=body.goal, owner_id=user.id)
        session.add(project)
        await session.commit()
        return project_view(project)

    @router.get("/{project_id}")
    async def get_project(project_id: str, user=Depends(current_user), session=Depends(database.session)):
        project = await owned_project(session, project_id, user)
        count = await session.scalar(select(func.count(Asset.id)).where(Asset.project_id == project.id))
        return project_view(project, count)

    @router.patch("/{project_id}")
    async def rename_project(project_id: str, body: ProjectRename, user=Depends(current_user), session=Depends(database.session)):
        project = await owned_project(session, project_id, user)
        project.name = body.name
        project.updated_at = now()
        await session.commit()
        count = await session.scalar(select(func.count(Asset.id)).where(Asset.project_id == project.id))
        return project_view(project, count)

    @router.delete("/{project_id}", status_code=204)
    async def delete_project(project_id: str, user=Depends(current_user), session=Depends(database.session)):
        await owned_project(session, project_id, user, include_deleted=True)
        await session.execute(insert(DeletedProject).values(project_id=project_id)
                              .on_conflict_do_nothing(index_elements=[DeletedProject.project_id]))
        await session.commit()

    @router.post("/{project_id}/restore")
    async def restore_project(project_id: str, user=Depends(current_user), session=Depends(database.session)):
        project = await owned_project(session, project_id, user, include_deleted=True)
        await session.execute(delete(DeletedProject).where(DeletedProject.project_id == project_id))
        count = await session.scalar(select(func.count(Asset.id)).where(Asset.project_id == project_id))
        await session.commit()
        return project_view(project, count)

    @router.put("/{project_id}/rules")
    async def save_rules(project_id: str, body: RulesUpdate, user=Depends(current_user), session=Depends(database.session)):
        await owned_project(session, project_id, user)
        result = await session.execute(update(Project).where(Project.id == project_id, Project.rules_version == body.version).values(rules=body.rules.model_dump(), rules_version=body.version + 1, updated_at=now()))
        if result.rowcount != 1:
            raise HTTPException(409, "规则已在其他页面更新。请重新载入后合并；当前输入尚未保存。")
        await session.commit()
        return {"rules": body.rules.model_dump(), "rules_version": body.version + 1}

    return router
