"""Offline transport only. Never contacts a paid service or reads local .env."""
import asyncio
import json
import httpx
import pytest
from app.config import Settings
from app.ai_provider import BailianProvider, AIError, function
from app.ai_audit import token_usage


def test_qwen37_json_tools_timeout_and_persistent_session_budget(tmp_path, monkeypatch):
    settings = Settings(_env_file=None, data_dir=tmp_path, ai_api_key="test-only",
        ai_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", ai_model="qwen3.7-plus", ai_region="cn-beijing",
        ai_request_audit_path=tmp_path / "ledger.json", ai_request_budget=3)
    real_client = httpx.AsyncClient
    bodies = []
    count = 0
    def handle(request):
        nonlocal count
        count += 1
        body = json.loads(request.content)
        bodies.append(body)
        if count == 3:
            return httpx.Response(429, json={"error":{"code":"Throttling","message":"not stored"}})
        return httpx.Response(200, json={"choices":[{"message":{"content":"{}"},"finish_reason":"stop"}],
            "model":"qwen3.7-plus", "usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}})
    def client_factory(**kwargs):
        assert kwargs["timeout"] == 45 and kwargs["follow_redirects"] is False
        return real_client(transport=httpx.MockTransport(handle), **kwargs)
    monkeypatch.setattr(httpx, "AsyncClient", client_factory)
    tools = [function("search_rules", "query", {"query":{"type":"string"}}, ["query"])]
    provider = BailianProvider(settings)
    asyncio.run(provider.complete([{"role":"user","content":"JSON"}], json_mode=True))
    asyncio.run(provider.complete([{"role":"user","content":"tool"}], tools=tools,
        tool_choice={"type":"function","function":{"name":"search_rules"}}))
    with pytest.raises(AIError, match="限流"):
        asyncio.run(provider.complete([]))
    with pytest.raises(AIError, match="预算"):
        asyncio.run(BailianProvider(settings).complete([]))  # recreated provider cannot reset cap
    assert count == 3
    assert bodies[0]["enable_thinking"] is False and bodies[0]["stream"] is False
    assert bodies[0]["response_format"] == {"type":"json_object"}
    assert bodies[0]["max_tokens"] == 2500 and bodies[0]["model"] == "qwen3.7-plus"
    assert bodies[1]["tools"] == tools and bodies[1]["tool_choice"]["function"]["name"] == "search_rules"
    ledger = json.loads(settings.ai_request_audit_path.read_text(encoding="utf-8"))
    assert len(ledger["requests"]) == 3 and ledger["requests"][2]["usage"]["total_tokens"] is None
    assert ledger["requests"][0]["usage"]["total_tokens"] == 15
    assert "test-only" not in json.dumps(ledger) and "Authorization" not in json.dumps(ledger)
    assert token_usage({}) == {"prompt_tokens":None,"completion_tokens":None,"total_tokens":None}
