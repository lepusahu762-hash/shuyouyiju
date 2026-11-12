"""Generate independent, explicitly labelled synthetic analysis data, no model call."""
from pathlib import Path
import csv
from openpyxl import Workbook

OUT=Path(__file__).resolve().parents[2]/'artifacts/analysis-demo'
RULE='有效记录满意率：以纳入状态为有效的全部记录为分母，反馈等级为满意的记录为分子。保留反馈空值，不去重，按记录/行统计，显示0位小数。不限定期间；可按所属学院探索分组，分组字段空值处理由用户另行明确。'


def make():
    OUT.mkdir(parents=True,exist_ok=True)
    rows=[['A','有效','满意']]*3+[['A','有效','一般']]*2+[['A','有效','']]+[['B','有效','满意']]+[['B','有效','一般']]*2+[['B','有效','']]+[['A','无效','满意'],['','无效','']]
    headers=['所属学院','纳入状态','反馈等级']
    with (OUT/'独立合成_学院12条.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f);w.writerow(headers);w.writerows(rows)
    wb=Workbook();ws=wb.active;ws.title='独立合成';ws.append(headers)
    for row in rows:ws.append(row)
    wb.save(OUT/'独立合成_学院12条.xlsx')
    (OUT/'独立合成_统计规则.txt').write_text(RULE,encoding='utf-8')
    (OUT/'合成答案说明.txt').write_text('独立合成验收资料，不是真实调查。\nA纳入6条，满意3、一般2、空值1；B纳入4条，满意1、一般2、空值1。\n另有2条范围外记录，其中一条分组空值。\n保留空值：A=50%，B=25%，总体4/10=40%；不能平均成37.5%。\n分组空值keep时显示独立空值组，因分母0没有百分比，不参加最高最低排名。',encoding='utf-8')
    return OUT


if __name__=='__main__':print(make())
