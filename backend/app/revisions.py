"""Append-only paragraph revisions and deterministic, version-bound rechecks.

No model client is imported. Original assets/checks/rules are never updated here.
Only an explicitly selected percentage token can reuse the original semantics.
"""
import re
from decimal import Decimal
from types import SimpleNamespace
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update, func
from .models import (Project, NumericCheck, CalculationRun, RuleSnapshot, RevisionThread,
                     ReportRevision, RevisionConfirmation, RevisionRecheck, now)
from .projects import owned_project
from .calculations import (digest, project_context, run_view, check_view, RunRequest,
                           create_run_service, compare_percentage)
from .rule_constraints import (FIELDS, CHECK_VERSION, canonical, latest_snapshot,
                               snapshot_view, enforce)

TOKEN = re.compile(r"(?<![0-9A-Za-z_.,])([+\-−]?\s*[0-9]+(?:\.[0-9]+)?)\s*[%％]")
METHOD = "single-percent-revision-v1"


def tokens(text):
    return [{"index": i, "text": m.group(), "value": str(Decimal(re.sub(r"\s", "", m.group(1)).replace("−", "-"))),
             "prefix": text[:m.start()], "suffix": text[m.end():]} for i, m in enumerate(TOKEN.finditer(text))]


def revision_target(original, index, revised):
    """Unicode-safe: target ordinals, no JS/Python character-offset interchange."""
    source = tokens(original)
    if index >= len(source):
        raise HTTPException(422, "所选百分比位置不存在，请重新选择原句中的目标数字。")
    target = source[index]
    if not revised.startswith(target["prefix"]) or not revised.endswith(target["suffix"]):
        return None
    end = len(revised) - len(target["suffix"]) if target["suffix"] else len(revised)
    middle = revised[len(target["prefix"]):end]
    if not TOKEN.fullmatch(middle):
        return None
    value = tokens(middle)[0]["value"]
    if not 0 <= Decimal(value) <= 100:
        return None
    return value


class SaveRevision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_check_id: str
    target_index: int = Field(ge=0, le=500)
    expected_head: str | None
    text: str = Field(min_length=1, max_length=30000)
    action: Literal["suggestion", "edit", "keep", "restore"]
    reason: str = Field(default="", max_length=2000)
    restored_from: str | None = None


class ConfirmRevision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_head: str
    context_hash: str
    rule_snapshot_id: str
    plan: RunRequest
    confirmed: bool = False


class RecheckRevision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_head: str
    confirmation_id: str


async def source_data(session, pid, cid, user):
    project = await owned_project(session, pid, user)
    check = await session.get(NumericCheck, cid)
    run = await session.get(CalculationRun, check.run_id) if check else None
    if not run or run.project_id != pid:
        raise HTTPException(404, "核验依据不存在或无权访问。")
    current, _ = await project_context(session, project)
    rule_id = run.context.get("constraint_snapshot_id")
    rule = await session.get(RuleSnapshot, rule_id) if rule_id else None
    return project, check, run, rule, current


async def owned_revision(session, pid, rid, user):
    await owned_project(session, pid, user)
    revision = await session.get(ReportRevision, rid)
    thread = await session.get(RevisionThread, revision.thread_id) if revision else None
    if not thread or thread.project_id != pid:
        raise HTTPException(404, "修订版本不存在或无权访问。")
    return revision, thread


async def lock_project(session, pid, user):
    project = await owned_project(session, pid, user)
    # SQLite serializes appends, confirmations and runs. Check CAS after acquiring.
    await session.execute(update(Project).where(Project.id == pid).values(updated_at=now()))
    # A preceding owner read may have waited behind another writer. Do not use
    # a cached rules_version/rules object after acquiring the serialization lock.
    await session.refresh(project)


def unchanged_plan(plan, constraints):
    return all(canonical(k, plan.get(k)) == canonical(k, constraints[k]) for k in FIELDS)


async def eligible(session, revision, thread, current):
    basis = revision.basis
    if basis["source_check"]["result"]["status"] not in {"consistent", "different"} or not basis["source_check"]["spec"].get("confirmed"):
        raise HTTPException(409, "原核验尚未完成指标与范围确认或缺少有效证据，请先在结论核验中建立已完成的单条核验。")
    value = revision_target(basis["report"]["paragraph"]["text"], thread.target_index, revision.text)
    if value is None:
        raise HTTPException(409, "修订已改动目标数字以外的内容，可能涉及对象、期间、指标或范围。需要重新建立核验方案；当前版本仅支持待人工核验，不能凭数字相同通过。")
    rule = await latest_snapshot(session, thread.project_id)
    if not rule:
        raise HTTPException(409, "尚无已确认的结构化规则，请先在结论核验中确认规则与来源。")
    original_plan = basis["run"]["spec"]
    # Changing semantics requires a new source check, never silently rebind a sentence.
    if not unchanged_plan(original_plan, rule.constraints):
        raise HTTPException(409, "当前规则与原句的依据方案不同，需要在结论核验中重新确认范围和方案，建立新核验依据。旧版本保留。")
    source = basis["report"]
    if current["assets"].get(source["asset_id"]) != source["signature"]:
        raise HTTPException(409, "原报告资料已变化，需重新定位原句并建立核验依据。")
    plan = {**rule.constraints, "confirmed": True, "context_hash": digest(current)}
    proxy = SimpleNamespace(project_id=thread.project_id, payload={"rule_check_version": CHECK_VERSION, "rule_snapshot": snapshot_view(rule)})
    await enforce(session, proxy, plan)
    return value, rule, plan


async def revision_view(session, revision, thread, current):
    events = (await session.scalars(select(RevisionRecheck).where(RevisionRecheck.revision_id == revision.id).order_by(RevisionRecheck.created_at.desc(), RevisionRecheck.id))).all()
    checks = []
    for event in events:
        run = await session.get(CalculationRun, event.run_id)
        confirmation = await session.get(RevisionConfirmation, event.confirmation_id)
        reasons = []
        if confirmation.snapshot["context_hash"] != digest(current):
            reasons.append("资料或已确认规则已变化")
        if thread.head_id != revision.id:
            reasons.append("已有后续修订版本，本结果仅对应此历史版本")
        checks.append({"id": event.id, "created_at": event.created_at, "result": event.result,
                       "stale": bool(reasons), "stale_reasons": reasons, "run": run_view(run, current),
                       "confirmation": {"id": confirmation.id, "created_at": confirmation.created_at, **confirmation.snapshot}})
    semantic = revision_target(revision.basis["report"]["paragraph"]["text"], thread.target_index, revision.text) is None
    confirmations = (await session.scalars(select(RevisionConfirmation).where(RevisionConfirmation.revision_id == revision.id).order_by(RevisionConfirmation.created_at.desc()).limit(1))).all()
    confirmation = confirmations[0] if confirmations else None
    confirmation_valid = bool(confirmation and confirmation.snapshot["context_hash"] == digest(current) and thread.head_id == revision.id)
    status = "manual_required" if semantic else "stale" if (checks and checks[0]["stale"] or confirmation and not confirmation_valid) else checks[0]["result"]["status"] if checks else "pending"
    block_reason = None
    try:
        await eligible(session, revision, thread, current)
    except HTTPException as error:
        block_reason = error.detail
    return {"id": revision.id, "thread_id": thread.id, "version": revision.version, "parent_id": revision.parent_id,
            "head_id": thread.head_id, "restored_from": revision.restored_from, "text": revision.text, "action": revision.action,
            "reason": revision.reason, "created_at": revision.created_at, "status": status, "basis": revision.basis,
            "target_index": thread.target_index, "rechecks": checks, "recheck_block_reason": block_reason,
            "confirmation": {"id": confirmation.id, "valid": confirmation_valid,
                             "created_at": confirmation.created_at, **confirmation.snapshot} if confirmation else None}


def revisions_router(database, current_user):
    router = APIRouter(prefix="/api/projects/{pid}", tags=["revisions"])

    @router.get("/revision-sources")
    async def sources(pid: str, offset: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=30), user=Depends(current_user), session=Depends(database.session)):
        project = await owned_project(session, pid, user)
        current, _ = await project_context(session, project)
        query = select(NumericCheck).join(CalculationRun).where(CalculationRun.project_id == pid)
        total = await session.scalar(select(func.count()).select_from(query.subquery()))
        rows = (await session.scalars(query.order_by(NumericCheck.created_at.desc(), NumericCheck.id).offset(offset).limit(limit))).all()
        return {"items": [check_view(c, await session.get(CalculationRun, c.run_id), current) for c in rows], "total": total, "offset": offset, "limit": limit}

    @router.get("/revision-source/{cid}")
    async def context(pid: str, cid: str, target_index: int = Query(0, ge=0, le=500), offset: int = Query(0, ge=0), user=Depends(current_user), session=Depends(database.session)):
        _, check, run, rule, current = await source_data(session, pid, cid, user)
        current_rule = await latest_snapshot(session, pid)
        thread = await session.scalar(select(RevisionThread).where(RevisionThread.source_check_id == cid, RevisionThread.target_index == target_index))
        versions = []
        total = 0
        if thread:
            total = await session.scalar(select(func.count()).select_from(ReportRevision).where(ReportRevision.thread_id == thread.id))
            rows = (await session.scalars(select(ReportRevision).where(ReportRevision.thread_id == thread.id).order_by(ReportRevision.version.desc()).offset(offset).limit(10))).all()
            # List stays compact; full basis and paginated evidence load on selection.
            versions = [{"id": r.id, "version": r.version, "text": r.text, "action": r.action, "created_at": r.created_at} for r in rows]
        return {"check": check_view(check, run, current), "run": run_view(run, current), "targets": tokens(check.report["paragraph"]["text"]),
                "rule_snapshot": snapshot_view(rule) if rule else None, "current_rule": snapshot_view(current_rule) if current_rule else None,
                "source_rule_conflicts": [label for key, label in FIELDS.items() if rule and canonical(key, run.spec.get(key)) != canonical(key, rule.constraints[key])],
                "context_hash": digest(current), "head_id": thread.head_id if thread else None,
                "versions": {"items": versions, "total": total, "offset": offset, "limit": 10}}

    @router.get("/revisions/{rid}")
    async def get_revision(pid: str, rid: str, user=Depends(current_user), session=Depends(database.session)):
        revision, thread = await owned_revision(session, pid, rid, user)
        project = await owned_project(session, pid, user)
        current, _ = await project_context(session, project)
        return await revision_view(session, revision, thread, current)

    @router.post("/revisions", status_code=201)
    async def save(pid: str, body: SaveRevision, user=Depends(current_user), session=Depends(database.session)):
        await lock_project(session, pid, user)
        _, check, run, rule, current = await source_data(session, pid, body.source_check_id, user)
        if rule is None or rule.project_id != pid:
            raise HTTPException(409, "该历史核验未关联已确认规则快照，仍可查看原结果；请先保存结构化规则并建立新核验，再创建有明确依据的修订。不会给旧记录补记规则检查通过。")
        targets = tokens(check.report["paragraph"]["text"])
        if body.target_index >= len(targets) or Decimal(targets[body.target_index]["value"]) != Decimal(check.result["reported_value"]):
            raise HTTPException(409, "目标数字必须是该条实际核验所比较的原文百分比；同段多个数字需明确选择。")
        thread = await session.scalar(select(RevisionThread).where(RevisionThread.source_check_id == check.id, RevisionThread.target_index == body.target_index))
        if body.expected_head != (thread.head_id if thread else None):
            raise HTTPException(409, "修订已有新版本，请刷新后查看最新内容；不会覆盖他人的修改。")
        parent = await session.get(ReportRevision, thread.head_id) if thread and thread.head_id else None
        if body.action == "keep" and (body.text != check.report["paragraph"]["text"] or not body.reason.strip()):
            raise HTTPException(422, "保留原句必须保持原文并填写原因；此决定不改变原来的核验状态。")
        if body.action == "suggestion":
            suggested = run.result.get("display_value")
            target = targets[body.target_index]
            if check_view(check, run, current)["stale"] or check.result["status"] not in {"consistent", "different"}:
                raise HTTPException(409, "依据已过期或没有已完成的数字核验，请先建立当前核验依据；仍可手动保存待复核草稿。")
            if not unchanged_plan(run.spec, rule.constraints):
                raise HTTPException(409, "原计算方案与绑定规则有冲突，不能作为接受数值建议的依据。请重新确认规则与核验方案。")
            if suggested is None or body.text != target["prefix"] + suggested + "%" + target["suffix"]:
                raise HTTPException(422, "接受建议只能替换所选目标为该次计算值，其他文字保持不变。")
        restored = None
        if body.action == "restore":
            restored = await session.get(ReportRevision, body.restored_from) if body.restored_from else None
            if not restored or not thread or restored.thread_id != thread.id or restored.text != body.text:
                raise HTTPException(409, "恢复必须来自当前原句的已保存版本；恢复将追加新版本。")
        elif body.restored_from:
            raise HTTPException(422, "只有恢复操作可以关联旧版本。")
        if not thread:
            thread = RevisionThread(project_id=pid, source_check_id=check.id, target_index=body.target_index)
            session.add(thread)
            await session.flush()
        basis = parent.basis if parent else {"report": check.report, "source_check": check_view(check, run, run.context),
                                           "run": run_view(run, run.context), "rule_snapshot": snapshot_view(rule) if rule else None,
                                           "target": targets[body.target_index], "method_version": METHOD}
        revision = ReportRevision(thread_id=thread.id, version=parent.version+1 if parent else 1, parent_id=parent.id if parent else None,
                                  restored_from=restored.id if restored else None, text=body.text, action=body.action, reason=body.reason, basis=basis)
        session.add(revision)
        await session.flush()
        thread.head_id = revision.id
        await session.commit()
        return await revision_view(session, revision, thread, current)

    @router.post("/revisions/{rid}/confirm", status_code=201)
    async def confirm(pid: str, rid: str, body: ConfirmRevision, user=Depends(current_user), session=Depends(database.session)):
        await lock_project(session, pid, user)
        revision, thread = await owned_revision(session, pid, rid, user)
        project = await owned_project(session, pid, user)
        current, _ = await project_context(session, project)
        if thread.head_id != rid or body.expected_head != rid or body.context_hash != digest(current):
            raise HTTPException(409, "修订、资料或口径已变化，请重新读取并确认当前版本。")
        value, rule, expected = await eligible(session, revision, thread, current)
        if not body.confirmed or not body.plan.confirmed or body.rule_snapshot_id != rule.id or body.plan.context_hash != digest(current):
            raise HTTPException(409, "请确认当前版本、目标数字、已确认规则和统计方案。")
        proxy = SimpleNamespace(project_id=pid, payload={"rule_check_version": CHECK_VERSION, "rule_snapshot": snapshot_view(rule)})
        await enforce(session, proxy, body.plan.model_dump())
        confirmation = RevisionConfirmation(revision_id=rid, snapshot={"context_hash": digest(current), "rule_snapshot": snapshot_view(rule),
                                            "plan": expected, "reported_value": value, "text_fingerprint": digest(revision.text), "method_version": METHOD})
        session.add(confirmation)
        await session.commit()
        return {"id": confirmation.id, "revision_id": rid, "created_at": confirmation.created_at, "valid": True, **confirmation.snapshot}

    @router.post("/revisions/{rid}/recheck", status_code=201)
    async def recheck(pid: str, rid: str, body: RecheckRevision, user=Depends(current_user), session=Depends(database.session)):
        await lock_project(session, pid, user)
        revision, thread = await owned_revision(session, pid, rid, user)
        project = await owned_project(session, pid, user)
        current, _ = await project_context(session, project)
        confirmation = await session.get(RevisionConfirmation, body.confirmation_id)
        if not confirmation or confirmation.revision_id != rid:
            raise HTTPException(404, "确认记录不存在或无权访问。")
        if body.expected_head != rid or thread.head_id != rid or confirmation.snapshot["context_hash"] != digest(current) or confirmation.snapshot["text_fingerprint"] != digest(revision.text):
            raise HTTPException(409, "资料、规则或修订版本已变化，旧确认失效，需重新检查确认。")
        value, rule, plan = await eligible(session, revision, thread, current)
        if confirmation.snapshot["rule_snapshot"]["id"] != rule.id or confirmation.snapshot["plan"] != plan:
            raise HTTPException(409, "规则或方案已变化，不能使用旧确认。")
        existing = await session.scalar(select(RevisionRecheck).where(RevisionRecheck.confirmation_id == confirmation.id))
        if existing:
            # Safe network retry: never duplicate a completed calculation.
            return await revision_view(session, revision, thread, current)
        result_run = await create_run_service(session, pid, RunRequest(**plan), user, commit=False)
        run = await session.get(CalculationRun, result_run["id"])
        result = compare_percentage(run, revision.text, value, plan["precision"], True)
        result["verification_scope"] = "仅核验此修订版本中选定的一个百分比，不代表整篇报告通过。"
        event = RevisionRecheck(revision_id=rid, confirmation_id=confirmation.id, run_id=run.id, result=result)
        session.add(event)
        await session.commit()
        return await revision_view(session, revision, thread, current)

    return router
