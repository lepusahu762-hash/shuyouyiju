"""Independent synthetic documents for live acceptance after local credentials exist."""
from pathlib import Path
import csv
from docx import Document
from make_calculation_demo import generate, rows


def ai_demo(out):
    generate(out)
    doc = Document()
    doc.add_heading("合成测试报告 · AI单条核验（非真实调查）", 0)
    doc.add_paragraph("在本次调查的有效记录中，满意率为72%。")
    doc.add_paragraph("在本次调查的有效记录中，满意率为80%。")
    doc.add_paragraph("满意率比去年提升8个百分点。")
    doc.save(out / "合成测试_AI报告.docx")
    rule = "本次调查的满意率：统计单位为记录／行，不去重。分母为“记录状态”等于“有效”的全部记录；分子为分母中“反馈选项”等于“满意”的记录。保留空值，空值不匹配等值条件；以0位小数展示及比较。没有去年同口径记录。"
    doc = Document()
    doc.add_heading("合成统计规则（用于验收）", 0)
    doc.add_paragraph(rule)
    doc.save(out / "合成测试_统计规则.docx")
    (out / "合成测试_统计规则.txt").write_text(rule, encoding="utf-8")
    with (out / "改名合成测试_200条.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["反馈编号", "参与资格", "体验评价", "类别"])
        writer.writerows([[row[0], "纳入" if row[1] == "有效" else "不纳入", "认可" if row[2] == "满意" else "其他", row[3]] for row in rows()])
    (out / "改名合成测试_规则.txt").write_text("满意率：分母为“参与资格”等于“纳入”的记录；分子为其中“体验评价”等于“认可”的记录。单位为记录／行，不去重，保留空值且不匹配，精度为0位小数。", encoding="utf-8")
    (out / "AI演示步骤.txt").write_text("全部为独立合成验收资料。原名表和改名表请放在两个项目中，避免规则冲突。\n上传200条记录CSV或XLSX、AI报告DOCX、统计规则DOCX。也可在资料页粘贴规则txt内容。\n指定规则资料→选72%段落→提取并选择一条→核对分母180/分子144的定义→确认规则和方案→计算80%，差8个百分点。\n用80%段落验证一致；用提升8个百分点段落验证证据不足。没有真实模型凭据时不要把模拟验收当作真实调用成功。\n", encoding="utf-8")
    return out


if __name__ == "__main__":
    print(ai_demo(Path(__file__).resolve().parents[2] / "artifacts/ai-demo").resolve())
