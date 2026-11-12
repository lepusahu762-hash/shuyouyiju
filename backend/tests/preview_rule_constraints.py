"""Isolated, explicitly OFFLINE wrong-null proposal for browser acceptance."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import create_app
from app.config import Settings
from test_rule_constraints import NullProvider


class OfflineProvider(NullProvider):
    is_test = True


app = create_app(Settings(_env_file=None, data_dir=Path(__file__).resolve().parents[2]/'artifacts/rules-browser-data',
    ai_api_key='OFFLINE-NOT-A-SECRET', ai_base_url='https://dashscope.aliyuncs.com/compatible-mode/v1',
    ai_model='OFFLINE-CONFLICT-FIXTURE', ai_region='cn-beijing',
    allowed_origins='http://127.0.0.1:5174,http://localhost:5174'), OfflineProvider())

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8001)
