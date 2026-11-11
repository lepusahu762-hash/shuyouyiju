"""Generate synthetic, deterministic files for the browser acceptance check."""
from pathlib import Path
from docx import Document
from openpyxl import Workbook
import sys

out = Path(sys.argv[1] if len(sys.argv) > 1 else '../artifacts/fixtures')
out.mkdir(parents=True, exist_ok=True)
(out / 'survey.csv').write_bytes('学院,人数,人数\nA,60,45\nB,,45\nC,70,54\n'.encode('utf-8-sig'))
workbook = Workbook()
sheet = workbook.active
sheet.title = '学院调查'
for row in [['学院', '有效人数', '满意人数'], ['A 学院', 60, 45], ['B 学院', 50, 45], ['C 学院', 70, 54]]:
    sheet.append(row)
workbook.create_sheet('备注').append(['说明', '单位'])
workbook['备注'].append(['合成测试数据', '人'])
workbook.save(out / 'survey.xlsx')
doc = Document()
doc.add_heading('校园调查报告', 0)
doc.add_paragraph('本次回收问卷 200 份。')
doc.add_paragraph('')
doc.add_paragraph('有效问卷 180 份，满意人数 144 人。')
doc.add_table(rows=1, cols=1).cell(0, 0).text = '表格中的段落'
doc.save(out / 'report.docx')
(out / 'broken.xlsx').write_text('This is not a workbook.', encoding='utf-8')
(out / 'unsupported.pdf').write_text('Unsupported format.', encoding='utf-8')
print(out.resolve())
