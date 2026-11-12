"""Optional single-process local acceptance ledger. Reserve before each real HTTP attempt.

Persists the run-wide cap across task creation and backend restarts. No messages,
headers, keys or model reasoning are written here. This is not a billing report.
"""
from datetime import datetime, timezone
import json
from threading import Lock

_lock = Lock()
TOKEN_KEYS = ("prompt_tokens", "completion_tokens", "total_tokens")


def token_usage(usage):
    usage = usage if isinstance(usage, dict) else {}
    return {key: usage[key] if isinstance(usage.get(key), int) and not isinstance(usage[key], bool) else None
            for key in TOKEN_KEYS}


class RequestAudit:
    def __init__(self, path, limit):
        self.path, self.limit = path, limit

    def read(self):
        if not self.path.exists():
            return {"limit": self.limit, "requests": []}
        data = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(data.get("requests"), list):
            raise ValueError("invalid ledger")
        return data

    def write(self, data):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.path)

    def reserve(self, model):
        with _lock:
            data = self.read()
            if len(data["requests"]) >= min(self.limit, data["limit"]):
                raise ValueError("request budget exhausted")
            ordinal = len(data["requests"]) + 1
            data["requests"].append({"ordinal": ordinal, "model": model,
                "started_at": datetime.now(timezone.utc).isoformat(), "status": "reserved",
                "usage": token_usage(None)})
            self.write(data)
            return ordinal

    def finish(self, ordinal, **summary):
        with _lock:
            data = self.read()
            data["requests"][ordinal-1].update(**summary, finished_at=datetime.now(timezone.utc).isoformat())
            self.write(data)
