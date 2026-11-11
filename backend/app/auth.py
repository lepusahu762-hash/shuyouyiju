import re
import uuid
from fastapi import Depends
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, schemas
from fastapi_users.authentication import AuthenticationBackend, CookieTransport
from fastapi_users.authentication.strategy.db import DatabaseStrategy
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi_users.exceptions import InvalidPasswordException
from fastapi_users_db_sqlalchemy.access_token import SQLAlchemyAccessTokenDatabase
from pydantic import field_validator
from .config import Settings
from .database import Database
from .models import AccessToken, User


class UserRead(schemas.BaseUser[uuid.UUID]):
    created_at: str


class UserCreate(schemas.BaseUserCreate):
    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    async def validate_password(self, password, user):
        if not 8 <= len(password) <= 72 or not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
            raise InvalidPasswordException(reason="密码需为 8–72 个字符，同时包含英文字母和数字。")


def setup_auth(database: Database, settings: Settings):
    async def user_db(session=Depends(database.session)):
        yield SQLAlchemyUserDatabase(session, User)

    async def manager(db=Depends(user_db)):
        yield UserManager(db)

    async def access_db(session=Depends(database.session)):
        yield SQLAlchemyAccessTokenDatabase(session, AccessToken)

    def strategy(db=Depends(access_db)):
        return DatabaseStrategy(db, lifetime_seconds=settings.session_seconds)

    transport = CookieTransport(cookie_name="syj_session", cookie_max_age=settings.session_seconds,
                                cookie_secure=settings.cookie_secure, cookie_httponly=True,
                                cookie_samesite="lax", cookie_path="/")
    backend = AuthenticationBackend(name="database-cookie", transport=transport, get_strategy=strategy)
    users = FastAPIUsers[User, uuid.UUID](manager, [backend])
    return users, backend
