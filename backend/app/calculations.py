"""Explicit, deterministic record counting. No expressions, deduplication or AI.

Every run is immutable. Evidence rows are snapshots, paginated from SQLite.
Exact fractions are authoritative; Decimal strings for recurring values are labelled.
"""
from collections import Counter
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, localcontext
import hashlib
import json
import re
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, func, insert
from .models import Asset, CalculationRun, CalculationEvidence, NumericCheck, RuleMaterial, RuleSnapshot, new_id
from .projects import owned_project

METHOD = "record-equality-v1"
COMPARE_RULE = "百分数按确认的小数位以十进制四舍五入（ROUND_HALF_UP）后严格相等；不使用容差。差值 = 计算值 − 报告值，单位为百分点。"
REASONS = {"null_excluded": "所选条件字段有空值，按确认策略排除",
           "scope_unmatched": "未同时满足统计范围条件（含保留的空值或非数值未匹配）",
           "numerator_unmatched": "已纳入分母，未同时满足分子条件（含空值或非数值未匹配）",
           "matched": "同时满足范围和计数／分子条件"}


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def blank(value):
    return value is None or isinstance(value, str) and not value.strip()


def number(value):
    if isinstance(value, bool) or blank(value):
        return None
    try:
        result = Decimal(str(value))
        return result if result.is_finite() else None
    except InvalidOperation:
        return None


class Condition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    column_id: str = Field(min_length=1, max_length=150)
    kind: Literal["text", "number", "boolean"] = "text"
    value: str = Field(min_length=1, max_length=1000)

    @field_validator("value")
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError("等值条件不能为空白，请明确空值处理策略。")
        return value


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    asset_id: str
    sheet_id: str
    operation: Literal["count", "ratio"]
    metric: str = Field(min_length=1, max_length=120)
    scope_description: str = Field(min_length=1, max_length=1000)
    scope: list[Condition] = Field(default_factory=list, max_length=10)
    numerator: list[Condition] = Field(default_factory=list, max_length=10)
    null_policy: Literal["exclude", "keep", "block"]
    precision: int = Field(ge=0, le=6)
    confirmed: bool = False
    context_hash: str


class CheckRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    report_asset_id: str
    paragraph_id: str
    reported_value: str = Field(pattern=r"^\d{1,3}(\.\d{1,6})?$", max_length=10)
    precision: int = Field(ge=0, le=6)
    confirmed: bool = False


def compiled(conditions, columns):
    indexes = {column["id"]: i for i, column in enumerate(columns)}
    result = []
    for condition in conditions:
        if condition.column_id not in indexes:
            raise HTTPException(422, "条件中的字段不存在于所选工作表，请重新选择字段。")
        value = condition.value
        if condition.kind == "number":
            value = number(value)
            if value is None:
                raise HTTPException(422, "数值条件必须是有限十进制数，不能输入公式或代码。")
        elif condition.kind == "boolean":
            if value not in {"true", "false"}:
                raise HTTPException(422, "布尔条件只接受 true 或 false。")
            value = value == "true"
        result.append((indexes[condition.column_id], condition.kind, value))
    return result


def matches(cells, conditions):
    for index, kind, expected in conditions:
        cell = cells[index]
        if kind == "text" and (not isinstance(cell, str) or cell != expected):
            return False
        if kind == "number" and number(cell) != expected:
            return False
        if kind == "boolean" and (not isinstance(cell, bool) or cell != expected):
            return False
    return True


def calculate(sheet, body):
    if not body.confirmed or not body.metric.strip() or not body.scope_description.strip():
        raise HTTPException(409, "需要确认：请明确指标、范围、字段、空值处理与精度，并勾选统计口径确认。")
    if body.operation == "ratio" and not body.numerator:
        raise HTTPException(422, "比例计算需要至少一个分子条件；分子始终从分母范围筛选。")
    scope = compiled(body.scope, sheet["columns"])
    numerator = compiled(body.numerator, sheet["columns"])
    relevant = {item[0] for item in scope + numerator}
    counts = Counter()
    evidence = []
    null_rows, numeric_unmatched = 0, 0
    for ordinal, row in enumerate(sheet["rows"]):
        cells = row["cells"]
        has_null = any(blank(cells[index]) for index in relevant)
        null_rows += has_null
        numeric_unmatched += any(kind == "number" and not blank(cells[index]) and number(cells[index]) is None for index, kind, _ in scope + numerator)
        in_scope = not (has_null and body.null_policy != "keep") and matches(cells, scope)
        in_numerator = in_scope and matches(cells, numerator)
        reason = "null_excluded" if has_null and body.null_policy != "keep" else "scope_unmatched" if not in_scope else "matched" if in_numerator else "numerator_unmatched"
        counts[reason] += 1
        evidence.append({"ordinal": ordinal, "row": row, "in_scope": in_scope, "in_numerator": in_numerator, "reason": reason})
    total = len(evidence)
    den = sum(row["in_scope"] for row in evidence)
    num = counts["matched"]
    status, message = "completed", "按已确认条件完成全工作表计算。"
    if null_rows and body.null_policy == "block":
        status, message = "needs_confirmation", "条件字段存在空值，已按“遇空值暂停”停止产出数值。请确认新的空值策略后重新运行；下方分组仅供排查。"
    elif body.operation == "ratio" and den == 0:
        status, message = "insufficient", "分母为零，没有满足当前范围的可用记录，无法计算百分比。"
    result = {"status": status, "message": message, "unit": "记录/行", "total": total,
              "included": den, "excluded": total - den, "numerator": num, "denominator": den,
              "numerator_unmatched": counts["numerator_unmatched"], "null_rows": null_rows,
              "numeric_unmatched_rows": numeric_unmatched, "reasons": {key: {"count": counts[key], "label": label} for key, label in REASONS.items()},
              "exact_fraction": None, "unrounded_decimal": None, "display_value": None,
              "rounding": "ROUND_HALF_UP", "comparison_rule": COMPARE_RULE}
    if status == "completed":
        if body.operation == "ratio":
            with localcontext() as ctx:
                ctx.prec = 80
                value = Decimal(num) * 100 / Decimal(den)
                result.update(exact_fraction={"numerator": num, "denominator": den, "percent_multiplier": 100},
                              unrounded_decimal=str(value), display_value=format(value.quantize(Decimal(1).scaleb(-body.precision), rounding=ROUND_HALF_UP), "f"))
        else:
            result.update(exact_fraction={"numerator": num, "denominator": 1, "percent_multiplier": 1}, unrounded_decimal=str(num), display_value=str(num))
    return result, evidence


async def project_context(session, project):
    assets = (await session.scalars(select(Asset).where(Asset.project_id == project.id).order_by(Asset.id))).all()
    roles = list((await session.scalars(select(RuleMaterial.asset_id).where(RuleMaterial.project_id == project.id).order_by(RuleMaterial.asset_id))).all())
    context = {"rules": project.rules, "rules_version": project.rules_version, "rule_materials": roles,
               "assets": {asset.id: {"name": asset.original_name, "sha256": asset.sha256, "status": asset.status,
                                     "parsed_fingerprint": digest(asset.result), "annotation_version": asset.annotation_version,
                                     "annotations": asset.annotations} for asset in assets}}
    snapshot_id = await session.scalar(select(RuleSnapshot.id).where(RuleSnapshot.project_id == project.id).order_by(RuleSnapshot.version.desc()).limit(1))
    if snapshot_id:
        context["constraint_snapshot_id"] = snapshot_id
    return context, assets


def stale_reasons(run, current):
    reasons = []
    if run.context["rules_version"] != current["rules_version"] or run.context["rules"] != current["rules"] or run.context.get("rule_materials", []) != current.get("rule_materials", []) or run.context.get("constraint_snapshot_id") != current.get("constraint_snapshot_id"):
        reasons.append("项目统计口径已变更")
    if run.context["assets"] != current["assets"]:
        reasons.append("项目资料集合、解析内容或字段说明已变更")
    return reasons


def run_view(run, context, detail=True):
    reasons = stale_reasons(run, context)
    value = {"id": run.id, "project_id": run.project_id, "created_at": run.created_at, "method_version": run.method_version,
             "spec": run.spec, "source": run.source, "result": run.result, "stale": bool(reasons), "stale_reasons": reasons,
             "status": "stale" if reasons else run.result["status"]}
    if detail:
        value["context"] = run.context
    return value


async def create_run_service(session, project_id, body, user, *, commit=True):
    project = await owned_project(session, project_id, user)
    current, assets = await project_context(session, project)
    if digest(current) != body.context_hash:
        raise HTTPException(409, "资料或口径已变化。请重新载入设置并确认后再计算，旧记录会保留。")
    asset = next((asset for asset in assets if asset.id == body.asset_id), None)
    if asset is None:
        raise HTTPException(404, "资料不存在或无权访问。")
    if asset.kind != "table" or asset.status != "ready" or not asset.result:
        raise HTTPException(409, "证据不足：请选择已解析成功的表格。")
    sheet = next((sheet for sheet in asset.result["sheets"] if sheet["id"] == body.sheet_id), None)
    if sheet is None:
        raise HTTPException(422, "工作表不存在，请重新选择。")
    result, evidence = calculate(sheet, body)
    source = {"asset_id": asset.id, "name": asset.original_name, "sheet_id": sheet["id"], "sheet_name": sheet["name"],
              "source_id": f"{asset.id}:v1:{sheet['id']}", "source_version": 1, "sha256": asset.sha256,
              "parsed_fingerprint": digest(sheet), "columns": sheet["columns"], "annotations": asset.annotations}
    run = CalculationRun(id=new_id(), project_id=project_id, spec=body.model_dump(exclude={"context_hash"}),
                         context=current, source=source, result=result, method_version=METHOD)
    session.add(run)
    await session.flush()
    # Bounded batches; never send a whole-sheet evidence object to the browser.
    for start in range(0, len(evidence), 500):
        await session.execute(insert(CalculationEvidence), [{"run_id": run.id, **row} for row in evidence[start:start+500]])
    if commit:
        await session.commit()
    return run_view(run, current)

def check_view(check, run, context):
    reasons = stale_reasons(run, context)
    report_now = context["assets"].get(check.report["asset_id"])
    if report_now != check.report["signature"]:
        reasons.append("关联报告已变更或缺失")
    return {"id": check.id, "run_id": check.run_id, "created_at": check.created_at, "report": check.report,
            "spec": check.spec, "result": check.result, "status": "stale" if reasons else check.result["status"],
            "stale": bool(reasons), "stale_reasons": reasons}

def compare_percentage(run, text, reported_value, precision, confirmed, *, is_stale=False):
    value = Decimal(reported_value)
    if value > 100:
        raise HTTPException(422, "本轮核验记录占比，报告百分比必须在 0 到 100 之间。")
    status, message = "needs_confirmation", "请确认这条原文中的数值、指标、范围和精度与计算一致。"
    result = {"status": status, "message": message, "reported_value": reported_value,
              "calculated_value": run.result["display_value"], "difference_pp": None, "exact_difference_pp": None,
              "comparison_rule": COMPARE_RULE}
    tokens = re.findall(r"(?<![0-9A-Za-z_.,])([+\-−]?\s*[0-9]+(?:\.[0-9]+)?)\s*[%％]", text)
    found = [Decimal(re.sub(r"\s", "", item).replace("−", "-")) for item in tokens]
    if is_stale:
        status, message = "stale", "资料或口径已变化，请重新计算后再核验；旧结果和证据仍保留。"
    elif run.spec["operation"] != "ratio" or run.result["status"] == "insufficient":
        status, message = "insufficient", "没有可用的百分比计算证据。请先完成非零分母的比例计算。"
    elif run.result["status"] != "completed":
        status, message = "needs_confirmation", "计算口径尚待确认，请先处理空值并重新计算。"
    elif precision != run.spec["precision"]:
        message = "报告精度与计算精度不一致，请确认相同小数位后再核验。"
    elif max(0, -value.as_tuple().exponent) > precision:
        message = "输入值的小数位多于确认的报告精度，请按原文重新确认。"
    elif value not in found:
        message = "输入的百分比未在所选原文中找到。本轮仅识别阿拉伯数字加 %／％，请选对应段落，不会改写原文。"
    elif confirmed:
        with localcontext() as ctx:
            ctx.prec = 80
            fraction = run.result["exact_fraction"]
            raw = Decimal(fraction["numerator"]) * 100 / Decimal(fraction["denominator"])
            quantum = Decimal(1).scaleb(-precision)
            computed = raw.quantize(quantum, rounding=ROUND_HALF_UP)
            reported = value.quantize(quantum, rounding=ROUND_HALF_UP)
            difference = computed - reported
            status = "consistent" if difference == 0 else "different"
            message = "在已确认的指标、范围与精度下，数字与数据一致。" if status == "consistent" else "在已确认的指标、范围与精度下，报告值与计算值存在差异。"
            result.update(calculated_value=format(computed, "f"), difference_pp=format(difference, "f"),
                          exact_difference_pp={"numerator": str(Decimal(fraction["numerator"]) * 100 - value * fraction["denominator"]), "denominator": fraction["denominator"]})
    result.update(status=status, message=message)
    return result


async def create_check_service(session, run_id, body, user):
    run = await session.get(CalculationRun, run_id)
    if run is None:
        raise HTTPException(404, "计算记录不存在或无权访问。")
    project = await owned_project(session, run.project_id, user)
    context, assets = await project_context(session, project)
    report = next((asset for asset in assets if asset.id == body.report_asset_id), None)
    if report is None:
        raise HTTPException(404, "报告不存在或无权访问。")
    if report.kind != "report" or report.status != "ready" or not report.result:
        raise HTTPException(409, "证据不足：请先在资料页成功解析报告。")
    paragraph = next((p for p in report.result["paragraphs"] if p["id"] == body.paragraph_id), None)
    if paragraph is None:
        raise HTTPException(422, "报告段落来源标识不存在，请重新选择。")
    result = compare_percentage(run, paragraph["text"], body.reported_value, body.precision, body.confirmed, is_stale=bool(stale_reasons(run, context)))
    snapshot = {"asset_id": report.id, "name": report.original_name, "sha256": report.sha256,
                "paragraph": paragraph, "signature": context["assets"][report.id]}
    check = NumericCheck(run_id=run.id, report=snapshot, spec=body.model_dump(), result=result)
    session.add(check)
    await session.commit()
    return check_view(check, run, context)


def calculations_router(database, current_user):
    router = APIRouter(prefix="/api", tags=["calculations"])

    async def owned_run(session, rid, user):
        run = await session.get(CalculationRun, rid)
        if run is None:
            raise HTTPException(404, "计算记录不存在或无权访问。")
        project = await owned_project(session, run.project_id, user)
        return run, project

    @router.get("/projects/{project_id}/calculation-context")
    async def context(project_id: str, user=Depends(current_user), session=Depends(database.session)):
        project = await owned_project(session, project_id, user)
        current, _ = await project_context(session, project)
        return {"context_hash": digest(current), "rules_version": project.rules_version}

    @router.post("/projects/{project_id}/runs", status_code=201)
    async def create_run(project_id: str, body: RunRequest, user=Depends(current_user), session=Depends(database.session)):
        return await create_run_service(session, project_id, body, user)

    @router.get("/projects/{project_id}/runs")
    async def list_runs(project_id: str, offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=50), user=Depends(current_user), session=Depends(database.session)):
        project = await owned_project(session, project_id, user)
        context, _ = await project_context(session, project)
        query = select(CalculationRun).where(CalculationRun.project_id == project_id)
        total = await session.scalar(select(func.count()).select_from(query.subquery()))
        rows = (await session.scalars(query.order_by(CalculationRun.created_at.desc(), CalculationRun.id).offset(offset).limit(limit))).all()
        return {"items": [run_view(run, context, False) for run in rows], "total": total, "offset": offset, "limit": limit}

    @router.get("/runs/{run_id}")
    async def get_run(run_id: str, user=Depends(current_user), session=Depends(database.session)):
        run, project = await owned_run(session, run_id, user)
        context, _ = await project_context(session, project)
        return run_view(run, context)

    @router.get("/runs/{run_id}/evidence")
    async def evidence(run_id: str, group: Literal["all", "denominator", "numerator", "excluded", "unmatched"] = "denominator",
                       offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100), user=Depends(current_user), session=Depends(database.session)):
        run, project = await owned_run(session, run_id, user)
        query = select(CalculationEvidence).where(CalculationEvidence.run_id == run.id)
        if group == "denominator":
            query = query.where(CalculationEvidence.in_scope.is_(True))
        elif group == "numerator":
            query = query.where(CalculationEvidence.in_numerator.is_(True))
        elif group == "excluded":
            query = query.where(CalculationEvidence.in_scope.is_(False))
        elif group == "unmatched":
            query = query.where(CalculationEvidence.in_scope.is_(True), CalculationEvidence.in_numerator.is_(False))
        total = await session.scalar(select(func.count()).select_from(query.subquery()))
        rows = (await session.scalars(query.order_by(CalculationEvidence.ordinal).offset(offset).limit(limit))).all()
        return {"run_id": run.id, "group": group, "total": total, "offset": offset, "limit": limit, "columns": run.source["columns"],
                "rows": [{**row.row, "in_scope": row.in_scope, "in_numerator": row.in_numerator,
                          "reason": row.reason, "reason_label": REASONS[row.reason]} for row in rows]}


    @router.get("/runs/{run_id}/checks")
    async def list_checks(run_id: str, offset: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=50), user=Depends(current_user), session=Depends(database.session)):
        run, project = await owned_run(session, run_id, user)
        context, _ = await project_context(session, project)
        query = select(NumericCheck).where(NumericCheck.run_id == run.id)
        total = await session.scalar(select(func.count()).select_from(query.subquery()))
        checks = (await session.scalars(query.order_by(NumericCheck.created_at.desc(), NumericCheck.id).offset(offset).limit(limit))).all()
        return {"items": [check_view(check, run, context) for check in checks], "total": total, "offset": offset, "limit": limit}

    @router.post("/runs/{run_id}/checks", status_code=201)
    async def verify(run_id: str, body: CheckRequest, user=Depends(current_user), session=Depends(database.session)):
        return await create_check_service(session, run_id, body, user)

    return router
