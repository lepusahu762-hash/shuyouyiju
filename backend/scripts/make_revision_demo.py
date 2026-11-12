"""Independent synthetic files for the revision workflow, never product logic."""
from pathlib import Path
import csv
from docx import Document


def main():
    output = Path(__file__).resolve().parents[2] / 'artifacts/revision-demo'
    output.mkdir(parents=True, exist_ok=True)
    with (output/'独立合成修订12条.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['编号', '纳入标记', '服务评价'])
        writer.writerows((i,'是','满意' if i<=4 else '不满意' if i<=8 else '') for i in range(1,11))
        writer.writerows([(11,'否','满意'),(12,'否','不满意')])
    materials = {
        '合成修订报告.docx': '本期纳入记录的满意率为50%，参考比例为25%。',
        '合成修订规则.docx': '独立合成测试：本期纳入标记为是的全部记录进入分母，服务评价为空也保留。分子为服务评价为满意的记录。单位为记录／行，不去重，显示和比较精度0位小数。',
    }
    for name,text in materials.items():
        document = Document()
        document.add_paragraph(text)
        document.save(output/name)
    (output/'README.md').write_text('独立合成资料，不代表真实调查。共12行，纳入10行，其中满意4行、不满意4行、评价空值2行，另2行不纳入。保留空值后4/10=40%。核验报告第一处50%，同段25%属于其他对象，不能同时替换。保存40%后应待复核，实际复核后才显示单条一致；45%仍存在5个百分点差异。修改期间或对象应阻止复用旧方案。\n',encoding='utf-8')
    print(output)


if __name__ == '__main__':
    main()
