"""Independent synthetic multi-paragraph rule material, no model access."""
from pathlib import Path
from docx import Document
import make_rule_conflict_demo as original

ROOT=Path(__file__).resolve().parents[2]/'artifacts/retrieval-demo'
if __name__=='__main__':
    original.ROOT=ROOT;original.main()
    doc=Document()
    for text in [
        '适用范围：本资料为独立合成测试。统计表为“合成资料12条.csv”的“CSV”工作表，指标为“纳入记录满意率”。统计范围为纳入标记等于“是”的全部记录。采用记录占比，单位为记录／行，不去重。',
        '纳入记录满意率定义：纳入标记等于“是”的全部记录作为分母；分子为上述范围内服务评价等于“满意”的记录。计算为分子÷分母。',
        '限制条款：服务评价为空的纳入记录也保留在分母，空值不匹配分子等值条件。空值策略必须为保留，不得排除。显示和比较精度为0位小数，采用ROUND_HALF_UP。']:
        doc.add_paragraph(text)
    doc.save(ROOT/'合成统计规则.docx')
