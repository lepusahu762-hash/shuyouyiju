"""Explicit OFFLINE demo-prefill browser acceptance. Never production/real AI.

Run from backend: .venv/Scripts/python.exe -m uvicorn preview_demo_prefill:app --app-dir tests
Stores only synthetic QA data. All network model requests are replaced at app creation.
"""
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND/'tests'))
from app.main import create_app
from app.config import Settings
from test_ai import ScriptedProvider
from test_analysis import Model
from test_images import label


class DemoProvider(ScriptedProvider):
    is_test = True

    async def complete(self, messages, **kwargs):
        if isinstance(messages[-1]['content'], list):
            self.calls += 1
            target = {**label(), 'label': '满意50%', 'metric': '有效记录满意率',
                      'period': '不限定期间', 'bbox': {'x': .28, 'y': .35, 'width': .22, 'height': .13}}
            return {'content': json.dumps({'candidates': [target], 'message': '离线固定识别，非真实模型'}, ensure_ascii=False)}, {}
        if kwargs.get('tools') and kwargs['tools'][0]['function']['name'] == 'propose_analysis':
            response, _ = await Model().complete(messages, **kwargs)
            self.calls += 1
            fn = response['tool_calls'][0]['function']
            args = json.loads(fn['arguments']); args['questions'] = []
            fn['arguments'] = json.dumps(args, ensure_ascii=False)
            return response, {}
        self.value = '50'
        response, _ = await super().complete(messages, **kwargs)
        if response.get('content'):
            data = json.loads(response['content'])
            for candidate in data.get('candidates', []): candidate['metric'] = '有效记录满意率'
            if data.get('plan'):
                data['plan'].update(metric='有效记录满意率', scope_description='纳入状态为有效；不限定期间')
                data['questions'] = []
            response['content'] = json.dumps(data, ensure_ascii=False)
        return response, {}  # mock usage is unknown; never report it as real tokens


app = create_app(Settings(_env_file=None, data_dir=BACKEND.parent/'artifacts/demo-prefill/offline-data',
    ai_api_key='offline-not-a-secret', ai_model='OFFLINE-SCRIPTED-NOT-LIVE', ai_region='cn-beijing',
    ai_base_url='https://dashscope.aliyuncs.com/compatible-mode/v1',
    allowed_origins='http://127.0.0.1:4178'), DemoProvider())
