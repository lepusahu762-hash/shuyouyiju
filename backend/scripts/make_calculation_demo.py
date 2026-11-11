"""Independent synthetic acceptance materials; never loaded by product code."""
from pathlib import Path
import csv
import sys
from docx import Document
from openpyxl import Workbook


def rows():
    return [[f"T{i:03d}", "有效" if i <= 180 else "无效", "满意" if i <= 144 or i > 180 else "一般", "甲组" if i <= 100 else "乙组"] for i in range(1, 201)]


def generate(out):
    out.mkdir(parents=True, exist_ok=True)
    header = ["记录编号", "记录状态", "反馈选项", "分组"]
    with (out / "合成测试_200条记录.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(header)
        writer.writerows(rows())
    workbook = Workbook()
    workbook.active.title = "合成记录"
    for row in [header] + rows():
        workbook.active.append(row)
    workbook.save(out / "合成测试_200条记录.xlsx")
    doc = Document()
    doc.add_heading("合成测试报告（用于演示，不是真实调查）", 0)
    doc.add_paragraph("以记录状态为有效的记录为范围，反馈选项为满意的记录占比为72%。")
    doc.add_paragraph("以记录状态为有效的记录为范围，反馈选项为满意的记录占比为80%。")
    doc.add_paragraph("用于严格精度演示的独立指标为3.12%。")
    doc.save(out / "合成测试_数字结论.docx")
    (out / "README.txt").write_text("合成测试材料：总记录200；有效180；有效且满意144。无效记录中的20条也写为满意，用于验证分子必须来自分母范围。默认不去重，单位为记录/行。\n", encoding="utf-8")
    return out


if __name__ == "__main__":
    print(generate(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "artifacts" / "calculation-demo").resolve())
