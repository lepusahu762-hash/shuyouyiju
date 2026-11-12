"""Independent synthetic data only. Never imported by product code."""
from pathlib import Path
import csv
from docx import Document

ROOT = Path(__file__).resolve().parents[2] / 'artifacts/rule-conflict-demo'


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    with (ROOT / '合成资料12条.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['编号', '纳入标记', '服务评价'])
        writer.writerows((i, '是', '满意' if i <= 4 else '不满意' if i <= 8 else '') for i in range(1,11))
        writer.writerows([(11,'否','满意'), (12,'否','不满意')])
    rule = '本资料为独立合成测试。统计表为“合成资料12条.csv”的“CSV”工作表，指标为“纳入记录满意率”。统计范围为纳入标记等于“是”的全部记录，作为分母；分子为上述范围内服务评价等于“满意”的记录。采用记录占比（分子÷分母），单位为记录／行，不去重。服务评价为空的纳入记录也保留在分母，空值不匹配分子等值条件。空值策略必须为保留，不能排除。显示和比较精度为0位小数，采用ROUND_HALF_UP。'
    for filename, text in [('合成统计规则.docx',rule), ('合成报告50.docx','本资料为独立合成测试。纳入记录满意率为50%。')]:
        doc = Document(); doc.add_paragraph(text); doc.save(ROOT/filename)
    (ROOT/'README.md').write_text('独立合成测试，不代表真实调查。共12条：纳入10条，满意4条、不满意4条、评价为空2条；不纳入2条。明确保留空值后4÷10=40%，报告50%相差10个百分点。错误排除空值将得到4÷8=50%，必须在确认和执行前被阻止。\n规则须在界面逐项结构化并关联原文；AI原建议保持原样，不能伪造成错误分支。\n',encoding='utf-8')
    print(str(ROOT))


if __name__ == '__main__':
    main()
