"""Portable, synthetic-only demo fixtures. Does not read DB, config, or call AI."""
import argparse
import csv
import json
import os
from pathlib import Path
from docx import Document
from openpyxl import Workbook
from PIL import Image, ImageDraw, ImageFont

RULE = ('独立合成参赛演示，非真实调查。使用“统一演示_12条.csv”的“CSV 数据”工作表；'
        '也提供内容相同的XLSX作为替代，不应重复纳入计算。指标为“有效记录满意率”。'
        '统计单位为记录/行，不自动称为人数，不去重，不限定期间。'
        '分母为纳入状态等于“有效”的全部记录；分子在上述分母内筛选反馈等级等于“满意”的记录。'
        '反馈等级为空的有效记录仍计入分母，必须保留空值，不得因评价缺失排除。'
        '采用分子记录数÷分母记录数×100%，显示及比较均为0位小数，十进制四舍五入后严格相等。'
        '可按所属学院分组；分组字段为空时保留为空值组，零分母不产生百分比、不参加排名。'
        '报告文字和图中“满意50%”标签均为待核验陈述，不是规则给出的答案。')
REPORT = '本独立合成演示中，有效记录满意率为50%。'


def generate(output: Path, font_path: str | None = None):
    output.mkdir(parents=True, exist_ok=True)
    rows = ([['A', '有效', '满意']] * 3 + [['A', '有效', '一般']] * 2 + [['A', '有效', '']] +
            [['B', '有效', '满意']] + [['B', '有效', '一般']] * 2 + [['B', '有效', '']] +
            [['A', '无效', '满意'], ['', '无效', '']])
    headers = ['所属学院', '纳入状态', '反馈等级']
    with (output/'统一演示_12条.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer=csv.writer(f);writer.writerow(headers);writer.writerows(rows)
    wb=Workbook();ws=wb.active;ws.title='独立合成'
    for r in [headers, *rows]:ws.append(r)
    wb.save(output/'统一演示_12条_替代.xlsx')
    doc=Document();doc.add_paragraph(REPORT);doc.save(output/'统一演示_报告50.docx')
    (output/'统一演示_规则.txt').write_text(RULE, encoding='utf-8')
    (output/'统一演示_报告50.txt').write_text(REPORT, encoding='utf-8')
    candidates=[font_path, os.environ.get('SYJ_DEMO_FONT'), 'C:/Windows/Fonts/msyh.ttc',
                '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']
    font_file=next((Path(x) for x in candidates if x and Path(x).is_file()),None)
    if not font_file:raise SystemExit('表格/报告已生成；图片需中文字体。请用 --font 指定本机中文TTF/TTC路径。')
    font=lambda n:ImageFont.truetype(str(font_file),n)
    im=Image.new('RGB',(1100,680),'white');draw=ImageDraw.Draw(im)
    draw.text((55,30),'独立合成参赛演示 · 非真实调查',font=font(26),fill='#667085')
    draw.text((55,90),'有效记录满意率',font=font(46),fill='#182033')
    draw.text((55,160),'统计单位：记录 · 不限定期间',font=font(26),fill='#667085')
    draw.line((130,530,980,530),fill='#d7dfea',width=2)
    draw.rounded_rectangle((280,320,540,530),radius=8,fill='#3159eb')
    draw.text((335,250),'50%',font=font(52),fill='#182033')
    draw.text((355,550),'满意',font=font(34),fill='#182033')
    draw.text((55,620),'仅核验明确标签；不能按柱高推算数值。报告与图片均保留原件。',font=font(23),fill='#667085')
    im.save(output/'统一演示_满意50.png')
    manifest={'synthetic':True,'total':12,'denominator':10,'numerator':4,'overall':'40%',
              'A':{'numerator':3,'denominator':6,'display':'50%'},'B':{'numerator':1,'denominator':4,'display':'25%'},
              'null_evaluations_in_scope':2,'excluded_scope':2,'unit':'记录/行','period':'不限定期间','precision':0,
              'upload':['统一演示_12条.csv','统一演示_报告50.docx','统一演示_满意50.png'],
              'paste_as_rules':'统一演示_规则.txt','xlsx':'替代表格，不与CSV重复参与计算'}
    (output/'合成答案与准备清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),'utf-8')
    return manifest


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[2]/'artifacts/unified-demo-fixtures');parser.add_argument('--font')
    args=parser.parse_args();generate(args.output,args.font);print(args.output.resolve())
