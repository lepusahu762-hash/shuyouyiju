from contextlib import asynccontextmanager
from collections import defaultdict, deque
import logging
import time
from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from .config import Settings
from .database import Database
from .models import Base, Asset, now
from .auth import setup_auth, UserRead, UserCreate
from .projects import project_router


def create_app(settings: Settings | None = None):
    settings = settings or Settings()
    database = Database(settings)

    @asynccontextmanager
    async def lifespan(app):
        settings.storage_dir.mkdir(parents=True, exist_ok=True)
        async with database.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with database.sessions() as session:
            # An interrupted parser cannot retain a fictitious running state after restart.
            await session.execute(update(Asset).where(Asset.status.in_(["uploaded", "parsing"])).values(status="failed", error="后台已重启，解析中断。原文件已保留，请重试解析。", updated_at=now()))
            await session.commit()
        yield
        await database.engine.dispose()

    app = FastAPI(title="数有依据 API", version="0.3.0", lifespan=lifespan)
    app.state.database = database
    app.state.settings = settings
    origins = set(settings.allowed_origins.split(","))
    attempts = defaultdict(deque)

    @app.middleware("http")
    async def request_guards(request: Request, call_next):
        if request.url.path.startswith("/api/") and request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if request.headers.get("x-requested-with") != "shuyouyiju" or (origin and origin not in origins):
                return JSONResponse({"detail": "请求来源校验失败，请从本站页面重新操作。"}, 403)
            length = request.headers.get("content-length", "0")
            if length.isdigit() and int(length) > settings.max_upload_bytes + 1024 * 1024:
                return JSONResponse({"detail": "请求超过上传大小限制。"}, 413)
        if request.url.path in {"/api/auth/login", "/api/auth/register"} and request.method == "POST":
            ip = request.client.host if request.client else "unknown"
            tick = time.monotonic()
            for key in list(attempts):
                if not attempts[key] or attempts[key][-1] < tick - 60:
                    del attempts[key]
            recent = attempts[ip]
            while recent and recent[0] < tick - 60:
                recent.popleft()
            if len(recent) >= 30:
                return JSONResponse({"detail": "登录或注册操作过于频繁，请一分钟后再试。"}, 429)
            recent.append(tick)
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        # Never echo Pydantic's input field: it may contain a password or report.
        return JSONResponse({"detail": "输入格式不正确，请检查必填项、长度和邮箱格式。",
                             "fields": [str(item["loc"][-1]) for item in error.errors()]}, 422)

    @app.exception_handler(IntegrityError)
    async def integrity_error(request, error):
        return JSONResponse({"detail": "记录已存在或同时发生修改，请刷新后重试。"}, 409)

    @app.exception_handler(Exception)
    async def unexpected_error(request, error):
        logging.getLogger(__name__).error("API failure: %s", type(error).__name__)
        return JSONResponse({"detail": "后台暂时无法完成请求，请稍后重试。"}, 500)

    users, backend = setup_auth(database, settings)
    current_user = users.current_user(active=True)
    app.include_router(users.get_auth_router(backend), prefix="/api/auth", tags=["auth"])
    app.include_router(users.get_register_router(UserRead, UserCreate), prefix="/api/auth", tags=["auth"])

    @app.get("/api/auth/me", response_model=UserRead)
    async def me(user=Depends(current_user)):
        return user

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "version": "0.3.0", "email_verification": False,
                "limits": {"upload_bytes": settings.max_upload_bytes, "rows": settings.max_rows,
                           "columns": settings.max_columns, "files": settings.max_project_files}}

    app.include_router(project_router(database, current_user))
    return app


app = create_app()
