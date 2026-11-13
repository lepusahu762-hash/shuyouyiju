"""Synthetic fixture integrity; no application DB or model required."""
import csv
import importlib.util
from pathlib import Path
from docx import Document
from openpyxl import load_workbook
from PIL import Image
import pytest


def test_unified_fixtures_agree(tmp_path):
    spec = importlib.util.spec_from_file_location("demo", Path(__file__).parents[1]/"scripts/make_unified_demo.py")
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    fonts = [Path("C:/Windows/Fonts/msyh.ttc"), Path("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"), Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")]
    font = next((f for f in fonts if f.is_file()), None)
    if not font: pytest.skip("Fixture image requires a local CJK font; run generator with --font")
    result = module.generate(tmp_path, str(font))
    with (tmp_path/"统一演示_12条.csv").open(encoding="utf-8-sig", newline="") as f: rows=list(csv.reader(f))
    assert len(rows)-1 == 12
    valid=[r for r in rows[1:] if r[1]=="有效"]
    assert len(valid)==10 and sum(r[2]=="满意" for r in valid)==4
    assert sum(r[2]=="" for r in valid)==2
    assert {g:(sum(r[2]=="满意" for r in valid if r[0]==g),sum(r[0]==g for r in valid)) for g in ["A","B"]} == {"A":(3,6),"B":(1,4)}
    wb=load_workbook(tmp_path/"统一演示_12条_替代.xlsx", read_only=True)
    assert [["" if v is None else v for v in r] for r in wb.active.values]==rows
    assert [p.text for p in Document(tmp_path/"统一演示_报告50.docx").paragraphs]==[module.REPORT]
    with Image.open(tmp_path/"统一演示_满意50.png") as im: assert im.size==(1100,680) and im.format=="PNG"
    assert "保留空值" in (tmp_path/"统一演示_规则.txt").read_text("utf8")
    assert result["unit"]=="记录/行" and result["overall"]=="40%"
