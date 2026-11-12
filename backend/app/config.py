from pathlib import Path
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SYJ_", env_file=BACKEND_ROOT / ".env", extra="ignore")
    data_dir: Path = BACKEND_ROOT / "data"
    cookie_secure: bool = False  # Set true behind HTTPS outside local development.
    session_seconds: int = Field(default=604800, ge=60, le=2592000)
    allowed_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:8000,http://localhost:8000"
    max_upload_bytes: int = Field(default=20 * 1024 * 1024, ge=1024, le=100 * 1024 * 1024)
    max_rows: int = Field(default=50000, ge=1, le=100000)
    max_columns: int = Field(default=200, ge=1, le=1000)
    max_cells: int = Field(default=1000000, ge=1)
    max_project_files: int = Field(default=20, ge=1, le=200)
    # Embedded CJK TrueType font. Empty uses the local Windows SimSun or Linux
    # WenQuanYi font, otherwise export fails explicitly instead of broken glyphs.
    pdf_font_path: Path | None = None
    ai_api_key: SecretStr = SecretStr("")
    ai_base_url: str = ""
    ai_model: str = ""
    ai_region: str = ""
    ai_timeout_seconds: int = Field(default=45, ge=5, le=120)
    ai_max_tokens: int = Field(default=2500, ge=256, le=8000)
    ai_max_requests: int = Field(default=6, ge=1, le=6)
    ai_max_tool_calls: int = Field(default=4, ge=1, le=6)
    # Optional local acceptance guard; unset during normal operation. Never stores credentials.
    ai_request_audit_path: Path | None = None
    ai_request_budget: int = Field(default=12, ge=1, le=12)

    @property
    def storage_dir(self) -> Path:
        return self.data_dir.resolve() / "originals"

    @property
    def database_url(self) -> str:
        return "sqlite+aiosqlite:///" + (self.data_dir.resolve() / "shuyouyiju.sqlite3").as_posix()
