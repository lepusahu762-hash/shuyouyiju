"""Independent synthetic fixtures for the webpage onboarding/pause regression."""
import csv
from pathlib import Path
from openpyxl import Workbook


def make():
    out = Path(__file__).resolve().parents[2] / 'artifacts/rule-onboarding-demo'
    out.mkdir(parents=True, exist_ok=True)
    rows = [['组别', '状态', '评价'], ['A', '有效', '满意'], ['A', '有效', '一般'],
            ['B', '有效', '满意'], ['B', '有效', '']]
    with (out / '独立合成_暂停4条.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        csv.writer(stream).writerows(rows)
    book = Workbook()
    sheet = book.active
    sheet.title = '独立合成'
    for row in rows:
        sheet.append(row)
    book.save(out / '独立合成_暂停4条.xlsx')
    (out / '独立合成_统计规则.txt').write_text(
        '独立合成测试规则，不是真实调查。有效记录满意率：以状态为有效的全部记录为分母，'
        '评价为满意的记录为分子。基础空值策略为遇空值暂停，不去重，按记录/行统计，'
        '显示0位小数，不限定期间。按组别探索分组，分组字段空值保留为空值组。'
        '整体暂停时所有分组计数仅供诊断，不产生正式百分比及最高最低结论。', encoding='utf-8')
    return out


if __name__ == '__main__':
    print(make())
