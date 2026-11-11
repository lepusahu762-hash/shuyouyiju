import uuid
from datetime import datetime, timezone
from sqlalchemy import ForeignKey, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from fastapi_users_db_sqlalchemy.access_token import SQLAlchemyBaseAccessTokenTableUUID


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class User(SQLAlchemyBaseUserTableUUID, Base):
    created_at: Mapped[str] = mapped_column(String, default=now)


class AccessToken(SQLAlchemyBaseAccessTokenTableUUID, Base):
    pass


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    goal: Mapped[str] = mapped_column(String(20))
    rules: Mapped[dict] = mapped_column(JSON, default=dict)
    rules_version: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[str] = mapped_column(String, default=now)
    updated_at: Mapped[str] = mapped_column(String, default=now)


class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    original_name: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(20))
    extension: Mapped[str] = mapped_column(String(10))
    stored_name: Mapped[str] = mapped_column(String(100), unique=True)
    size_bytes: Mapped[int]
    sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    parse_options: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    annotations: Mapped[dict] = mapped_column(JSON, default=dict)
    annotation_version: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[str] = mapped_column(String, default=now)
    updated_at: Mapped[str] = mapped_column(String, default=now)


class CalculationRun(Base):
    __tablename__ = "calculation_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    spec: Mapped[dict] = mapped_column(JSON)
    context: Mapped[dict] = mapped_column(JSON)
    source: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    method_version: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[str] = mapped_column(String, default=now)


class CalculationEvidence(Base):
    __tablename__ = "calculation_evidence"
    run_id: Mapped[str] = mapped_column(ForeignKey("calculation_runs.id"), primary_key=True)
    ordinal: Mapped[int] = mapped_column(primary_key=True)
    row: Mapped[dict] = mapped_column(JSON)
    in_scope: Mapped[bool] = mapped_column(index=True)
    in_numerator: Mapped[bool] = mapped_column(index=True)
    reason: Mapped[str] = mapped_column(String(40))


class NumericCheck(Base):
    __tablename__ = "numeric_checks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("calculation_runs.id"), index=True)
    report: Mapped[dict] = mapped_column(JSON)
    spec: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String, default=now)
