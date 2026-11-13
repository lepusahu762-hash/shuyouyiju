"""User-confirmed, immutable rules. Exact engine semantics, never LLM self-approval."""
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update
from .models import Asset, Project, RuleMaterial, RuleSnapshot, now
from .projects import owned_project
from .calculations import Condition, RunRequest, compiled, digest, project_context

FIELDS = {"asset_id": "表格资料", "sheet_id": "工作表", "operation": "计算类型", "metric": "指标",
          "scope_description": "统计范围说明", "scope": "分母／范围条件", "numerator": "分子条件",
          "null_policy": "空值策略", "precision": "显示及比较精度"}
CHECK_VERSION = "confirmed-constraints-v1"


class RuleSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    asset_id: str = Field(min_length=1)
    sheet_id: str = Field(min_length=1)
    operation: Literal["count", "ratio"]
    metric: str = Field(min_length=1, max_length=120)
    scope_description: str = Field(min_length=1, max_length=1000)
    scope: list[Condition] = Field(max_length=10)
    numerator: list[Condition] = Field(max_length=10)
    null_policy: Literal["keep", "exclude", "block"]
    precision: int = Field(ge=0, le=6)


class Source(BaseModel):
    model_config = ConfigDict(extra="forbid")
    asset_id: str
    paragraph_id: str
    quote: str = Field(min_length=1, max_length=4000)


class SaveRule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    previous_id: str | None
    context_hash: str
    constraints: RuleSpec
    sources: dict[str, Source]
    confirmed_fields: list[str] = Field(max_length=9)
    unresolved: list[str] = Field(max_length=10)
    change_reason: str = Field(min_length=1, max_length=1500)


def base_context(context):
    return {k: v for k, v in context.items() if k != "constraint_snapshot_id"}


async def latest_snapshot(session, pid):
    return await session.scalar(select(RuleSnapshot).where(RuleSnapshot.project_id == pid).order_by(RuleSnapshot.version.desc()).limit(1))


def snapshot_view(snapshot):
    return {key: getattr(snapshot, key) for key in ("id", "project_id", "version", "previous_id", "constraints", "sources", "context", "fingerprint", "change_reason", "created_at")}


async def validate_spec(session, pid, spec):
    asset = await session.get(Asset, spec.asset_id)
    if not asset or asset.project_id != pid or asset.kind != "table" or asset.status != "ready":
        raise HTTPException(422, "规则必须关联当前项目已解析的表格。")
    sheet = next((s for s in asset.result["sheets"] if s["id"] == spec.sheet_id), None)
    if not sheet:
        raise HTTPException(422, "规则中的工作表不存在。")
    compiled(spec.scope, sheet["columns"])
    compiled(spec.numerator, sheet["columns"])
    if not spec.metric.strip() or not spec.scope_description.strip() or spec.operation == "ratio" and not spec.numerator:
        raise HTTPException(422, "指标、范围或分子定义缺失，不能保存为已确认规则。")


def canonical(key, value):
    if key in {"scope", "numerator"}:
        items = []
        for item in value:
            item = dict(item)
            if item["kind"] == "number":
                item["value"] = str(Decimal(item["value"]).normalize())
            items.append(digest(item))
        return sorted(set(items))  # AND order and duplicate clauses do not change engine semantics
    return value.strip() if isinstance(value, str) and key in {"metric", "scope_description"} else value


async def assess(session, task, plan=None):
    bound = task.payload.get("rule_snapshot")
    if not task.payload.get("rule_check_version"):
        return {"status": "legacy", "message": "旧记录未执行结构化规则检查，保留原结果；不自动视为通过新版检查。", "conflicts": [], "version": CHECK_VERSION}
    if not bound:
        return {"status": "needs_confirmation", "message": "请逐项明确规则与来源，并保存、绑定已确认规则快照。缺失口径不能用AI默认值代替。", "conflicts": [], "version": CHECK_VERSION}
    project = await session.get(Project, task.project_id)
    context, _ = await project_context(session, project)
    current = await latest_snapshot(session, task.project_id)
    if not current or current.id != bound["id"] or digest(base_context(context)) != digest(bound["context"]):
        return {"status": "stale", "message": "已确认规则或资料已变化，旧确认失效。请保存当前规则快照并重新绑定、检查和确认。", "conflicts": [], "snapshot_id": bound["id"], "version": CHECK_VERSION}
    plan = plan or task.payload.get("confirmed_plan") or task.payload.get("draft_plan") or task.payload.get("plan")
    if not plan:
        return {"status": "needs_confirmation", "message": "方案尚未完整，无法比较。", "conflicts": [], "version": CHECK_VERSION}
    conflicts = [{"field": key, "label": label, "required": bound["constraints"][key], "suggested": (task.payload.get("plan") or {}).get(key),
                  "actual": plan.get(key), "source": bound["sources"][key]} for key, label in FIELDS.items()
                 if canonical(key, plan.get(key, [] if key in {"scope", "numerator"} else None)) != canonical(key, bound["constraints"][key])]
    confirmed = task.payload.get("confirmed_rule_id") == bound["id"] and task.payload.get("confirmed_plan") == plan
    return {"status": "conflict" if conflicts else "confirmed" if confirmed else "needs_confirmation",
            "message": "存在与已确认规则不符的方案项，必须修正方案或明确保存新规则；勾选知晓不能绕过。" if conflicts else "方案符合规则，等待最终确认。" if not confirmed else "已按绑定的不可变规则快照确认。",
            "conflicts": conflicts, "snapshot_id": bound["id"], "version": CHECK_VERSION}


async def enforce(session, task, plan):
    report = await assess(session, task, plan)
    if report["status"] in {"legacy", "stale"} or report["conflicts"] or not task.payload.get("rule_snapshot"):
        raise HTTPException(409, report["message"])
    return report


def rules_router(database, current_user):
    router = APIRouter(prefix="/api", tags=["confirmed-rule-constraints"])

    @router.get("/projects/{pid}/rule-snapshots")
    async def snapshots(pid: str, offset: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=30), user=Depends(current_user), session=Depends(database.session)):
        project = await owned_project(session, pid, user)
        context, _ = await project_context(session, project)
        rows = (await session.scalars(select(RuleSnapshot).where(RuleSnapshot.project_id == pid).order_by(RuleSnapshot.version.desc()).offset(offset).limit(limit))).all()
        return {"items": [snapshot_view(s) for s in rows], "current_id": context.get("constraint_snapshot_id"), "context_hash": digest(context), "current_valid": bool((current := await latest_snapshot(session,pid)) and digest(current.context)==digest(base_context(context)))}

    @router.post("/projects/{pid}/rule-snapshots", status_code=201)
    async def save(pid: str, body: SaveRule, user=Depends(current_user), session=Depends(database.session)):
        project = await owned_project(session, pid, user)
        # Serialize snapshot append and check the expected head under SQLite's write lock.
        await session.execute(update(Project).where(Project.id == pid).values(updated_at=now()))
        context, _ = await project_context(session, project)
        previous = await latest_snapshot(session, pid)
        if body.previous_id != (previous.id if previous else None) or body.context_hash != digest(context):
            raise HTTPException(409, "规则或资料已更新，请重新读取当前规则后再保存，不覆盖其他修改。")
        if body.unresolved or set(body.confirmed_fields) != set(FIELDS) or set(body.sources) != set(FIELDS) or not body.change_reason.strip():
            raise HTTPException(409, "存在未确认、缺失或有歧义的约束。请逐项关联原文、确认全部项，并处理待确认内容。")
        await validate_spec(session, pid, body.constraints)
        source_snapshots = {}
        for key, source in body.sources.items():
            asset = await session.get(Asset, source.asset_id)
            role = await session.get(RuleMaterial, source.asset_id)
            if not asset or asset.project_id != pid or not role or role.project_id != pid or asset.kind != "report" or asset.status != "ready":
                raise HTTPException(404, "规则来源不存在、未指定为规则资料或无权访问。")
            paragraphs = asset.result["paragraphs"]
            paragraph = next((p for p in paragraphs if p["id"] == source.paragraph_id), None)
            if not paragraph or source.quote not in paragraph["text"]:
                raise HTTPException(422, "约束引用必须来自真实规则段落的连续原文。")
            source_snapshots[key] = {"asset_id": asset.id, "name": asset.original_name, "paragraph_id": paragraph["id"], "location": paragraph["location"],
                                     "paragraph_index": paragraphs.index(paragraph), "quote": source.quote, "text": paragraph["text"], "sha256": asset.sha256, "version": digest(asset.result)}
        spec = body.constraints.model_dump()
        snapshot = RuleSnapshot(project_id=pid, version=previous.version+1 if previous else 1, previous_id=body.previous_id,
                                constraints=spec, sources=source_snapshots, context=base_context(context), change_reason=body.change_reason,
                                fingerprint=digest({"constraints": spec, "sources": source_snapshots, "context": base_context(context)}))
        session.add(snapshot)
        await session.commit()
        return snapshot_view(snapshot)

    return router
