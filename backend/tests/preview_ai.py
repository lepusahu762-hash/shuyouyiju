"""EXPLICITLY SIMULATED local browser QA server, isolated from backend/data.

Never use this module for the real application. No network model calls or secrets.
"""
from pathlib import Path
import json
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import create_app
from app.config import Settings
from test_ai import ScriptedProvider


class BrowserFixtureProvider(ScriptedProvider):
    is_test = True

    async def complete(self, messages, **kwargs):
        if 'candidates' in messages[-1]['content']:
            source = json.loads(messages[-1]['content'].split('原文数据：')[1])
            text = source['excerpt']
            self.point = '个百分点' in text
            match = re.search(r'(\d+(?:\.\d+)?)\s*[%％]', text)
            if match:
                self.value = match[1]
        return await super().complete(messages, **kwargs)


app = create_app(Settings(data_dir=Path(__file__).resolve().parents[2] / 'artifacts/ai-browser-data',
    ai_api_key='SIMULATION-NOT-A-SECRET', ai_base_url='https://dashscope.aliyuncs.com/compatible-mode/v1',
    ai_model='SIMULATED-PROVIDER-NOT-LIVE', ai_region='cn-beijing',
    allowed_origins='http://127.0.0.1:5174,http://localhost:5174'), BrowserFixtureProvider())

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8001)
