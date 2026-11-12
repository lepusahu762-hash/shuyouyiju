"""Server-only Bailian Chat Completions adapter. No document instructions are trusted."""
import json
from urllib.parse import urlparse
import httpx


class AIError(Exception):
    pass


def configuration(settings):
    missing = [name for name in ("ai_api_key", "ai_base_url", "ai_model", "ai_region")
               if not (getattr(settings, name).get_secret_value() if name == "ai_api_key" else getattr(settings, name)).strip()]
    try:
        url = urlparse(settings.ai_base_url)
        port = url.port
    except ValueError:
        url = urlparse("")
        port = None
    valid = (url.scheme == "https" and bool(url.hostname) and
             (url.hostname.endswith(".maas.aliyuncs.com") or url.hostname in {
                 "dashscope.aliyuncs.com", "dashscope-intl.aliyuncs.com", "dashscope-us.aliyuncs.com"})
             and url.path.rstrip("/") == "/compatible-mode/v1" and not url.query and not url.fragment
             and not url.username and not url.password and port in {None, 443})
    region_hosts = {"cn-beijing": "dashscope.aliyuncs.com", "ap-southeast-1": "dashscope-intl.aliyuncs.com",
                    "us-east-1": "dashscope-us.aliyuncs.com", "ap-northeast-1": "", "cn-hongkong": ""}
    region_valid = settings.ai_region in region_hosts and (url.hostname == region_hosts.get(settings.ai_region) or
                   bool(url.hostname and url.hostname.endswith("." + settings.ai_region + ".maas.aliyuncs.com")))
    error = "模型地址必须是百炼官方 HTTPS compatible-mode/v1 地址。" if settings.ai_base_url and not valid else None
    if valid and settings.ai_region and not region_valid:
        error = "地域与模型地址不匹配，请按百炼控制台的同地域端点填写。"
    return {"configured": not missing and valid and region_valid, "missing": ["SYJ_" + key.upper() for key in missing],
            "configuration_error": error,
            "provider": "阿里云百炼（按模型 API 用量计费）", "model": settings.ai_model,
            "region": settings.ai_region, "max_requests": settings.ai_max_requests,
            "max_tool_calls": settings.ai_max_tool_calls, "timeout_seconds": settings.ai_timeout_seconds}


class BailianProvider:
    def __init__(self, settings):
        self.settings = settings

    async def complete(self, messages, tools=None, tool_choice=None, json_mode=False):
        settings = self.settings
        if not configuration(settings)["configured"]:
            raise AIError("真实 AI 尚未接通：请在后台本地 .env 中补全模型配置并重启。")
        if len(json.dumps(messages, ensure_ascii=False)) > 60000:
            raise AIError("必要字段与规则超过首版单次6万字符限制，请精简项目资料后重试；本次未向模型发送内容。")
        body = {"model": settings.ai_model, "messages": messages, "max_tokens": settings.ai_max_tokens,
                "temperature": 0, "stream": False, "enable_thinking": False}
        if tools:
            body.update(tools=tools, tool_choice=tool_choice)
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        try:
            async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds, follow_redirects=False) as client:
                response = await client.post(settings.ai_base_url.rstrip("/") + "/chat/completions",
                    headers={"Authorization": "Bearer " + settings.ai_api_key.get_secret_value()}, json=body)
            if response.status_code == 429:
                raise AIError("模型服务限流或额度不足（429）。请检查控制台额度，稍后重试；已完成结果保留。")
            if response.status_code in {401, 403}:
                raise AIError("模型鉴权失败：请在本地检查 API Key、地域及工作空间权限，勿将密钥发到聊天中。")
            if response.status_code >= 400:
                raise AIError(f"模型 API 请求失败（HTTP {response.status_code}），请检查模型、地域和工具调用支持。")
            data = response.json()
            message = data["choices"][0]["message"]
            if not isinstance(message, dict) or data["choices"][0].get("finish_reason") == "length":
                raise AIError("模型输出不完整，请检查输出长度配置后重试。")
            return message, data.get("usage", {})
        except httpx.TimeoutException:
            raise AIError("模型请求超时。未确认完成的请求仍计入调用上限，可在剩余额度内重试。") from None
        except httpx.HTTPError:
            raise AIError("模型服务连接失败，请检查后台网络和服务地址。") from None
        except (ValueError, KeyError, IndexError, TypeError):
            raise AIError("模型响应格式错误，没有生成核验通过结果。") from None


def json_content(message):
    try:
        value = json.loads(message.get("content") or "")
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (ValueError, TypeError):
        raise AIError("模型输出不是要求的 JSON 对象，请重试；未生成核验结果。") from None


def function(name, description, properties, required):
    return {"type": "function", "function": {"name": name, "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required, "additionalProperties": False}}}


def tool_arguments(message, name):
    try:
        calls = message["tool_calls"]
        if len(calls) != 1 or calls[0]["type"] != "function" or calls[0]["function"]["name"] != name:
            raise ValueError()
        args = json.loads(calls[0]["function"]["arguments"])
        if not isinstance(args, dict):
            raise ValueError()
        return calls[0]["id"], args
    except (ValueError, KeyError, TypeError, IndexError):
        raise AIError("模型未按要求调用允许的工具，已停止执行；没有运行任意代码或其他工具。") from None
