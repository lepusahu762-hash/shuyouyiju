"""Text-only, embedded-font PDF. User material is escaped, never interpreted."""
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone, timedelta
from html import escape
import re
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle, HRFlowable

STATUS = {"consistent": "单条数字与数据一致", "different": "存在差异", "pending": "待复核",
          "manual_required": "待人工核验", "stale": "依据或版本已变化 - 待复核", "insufficient": "证据不足",
          "needs_confirmation": "需要确认", "completed": "计算完成"}
NULL = {"keep": "保留空值记录，空值不匹配等值条件", "exclude": "排除条件字段有空值的记录", "block": "遇条件字段空值暂停数值产出"}


def local_time(value):
    if not value:
        return "未提供"
    return datetime.fromisoformat(value).astimezone(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S") + " UTC+08:00（北京时间）"


def font_name(settings):
    candidates = [settings.pdf_font_path] if settings.pdf_font_path else [Path("C:/Windows/Fonts/simsun.ttc"), Path("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc")]
    path = next((p for p in candidates if p and p.is_file()), None)
    if not path:
        raise ValueError("缺少中文字体。请在后台设置 SYJ_PDF_FONT_PATH 为可嵌入的中文 TrueType 字体路径后重试。")
    name = "SYJ-CJK-" + __import__('hashlib').sha256(str(path.resolve()).encode()).hexdigest()[:12]
    if name not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(name, str(path), subfontIndex=0))
    return name


def plain(value):
    text = "未提供" if value is None else str(value)
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)


def build_pdf(snapshot, settings):
    font = font_name(settings)
    body = ParagraphStyle('body', fontName=font, fontSize=10, leading=17, wordWrap='CJK', spaceAfter=8, splitLongWords=True)
    small = ParagraphStyle('small', parent=body, fontSize=8, leading=13, spaceAfter=5)
    title = ParagraphStyle('title', parent=body, fontSize=23, leading=33, textColor=colors.HexColor('#182238'), spaceAfter=14)
    heading = ParagraphStyle('heading', parent=body, fontSize=13, leading=21, textColor=colors.HexColor('#2956ae'), spaceBefore=15, spaceAfter=9, keepWithNext=True)
    alert = ParagraphStyle('alert', parent=body, backColor=colors.HexColor('#f1f5ff'), borderPadding=10, spaceBefore=6, spaceAfter=16)
    story = []
    def p(value, style=body):
        return Paragraph(escape(plain(value)).replace('\n','<br/>'), style)
    def add(value, style=body):
        story.append(p(value, style))
    def section(value):
        add(value, heading)
    def kv(key,value):
        add(f"{key}：{plain(value)}")
    def highlighted(text, token_index):
        from .revisions import TOKEN
        matches = list(TOKEN.finditer(text))
        if token_index < len(matches):
            m = matches[token_index]
            safe = escape(plain(text[:m.start()])) + '<span backColor="#fff0bf" textColor="#6a4b00">' + escape(m.group()) + '</span>' + escape(plain(text[m.end():]))
            story.append(Paragraph(safe.replace('\n','<br/>'), body))
        else:
            add(text)
            add("修订后的目标数字位置无法可靠对应，未高亮替代数字，需人工定位。",small)
    def calculation(run, result, label):
        add(label, heading)
        if not run:
            add("未选定该版本的复核记录。没有填写此版本的分子、分母、计算值或差异，也没有套用原核验结果。")
            return
        r=run['result'];spec=run['spec'];source=run['source']
        kv('记录数',f"完整工作表 {r['total']} 行；纳入 {r['included']}；排除 {r['excluded']}；条件字段空值 {r['null_rows']} 行。单位：记录/行，不去重。")
        kv('分子 / 分母',f"{r['numerator']} / {r['denominator']}")
        kv('计算过程',f"{r['numerator']} ÷ {r['denominator']} × 100% = {r['display_value']}%" if r['display_value'] is not None else '无可用百分比，不能推断为0%')
        kv('未舍入值',r.get('unrounded_decimal'));kv('精确分数',r.get('exact_fraction'))
        kv('显示及比较精度',f"{spec['precision']} 位小数；ROUND_HALF_UP")
        kv('报告值 / 计算值',f"{result['reported_value']}% / {result.get('calculated_value') if result.get('calculated_value') is not None else '未产生'}%")
        kv('计算值 - 报告值',f"{result['difference_pp']} 个百分点" if result.get('difference_pp') is not None else '尚未比较')
        kv('比较规则',result.get('comparison_rule'))
        kv('统计指标',spec['metric']);kv('统计对象与范围说明',spec['scope_description'])
        def conditions(items):
            columns={c['id']:c['label'] for c in source['columns']}
            return ' 并且 '.join(f"{columns.get(c['column_id'],c['column_id'])} = {c['value']}（{c['kind']}）" for c in items) or '全部记录，无附加条件'
        kv('分母范围条件',conditions(spec['scope']));kv('分子条件',conditions(spec['numerator']))
        kv('空值策略',NULL.get(spec['null_policy'],spec['null_policy']))
        kv('数据文件 / 工作表',f"{source['name']} / {source['sheet_name']}")
        kv('来源标识',source['source_id']);kv('计算记录',run['id']);kv('计算方法版本',run['method_version'])
        kv('原文件SHA256',source['sha256']);kv('解析内容指纹',source['parsed_fingerprint'])

    add("数有依据",small)
    add("单条结论 PDF 核验报告",title)
    add("本次仅核验所选单条百分比，不代表整篇报告通过。修订版本号属于该原句，不是整篇文件版本号。",alert)
    kv('项目',snapshot['project_name']);kv('报告资料',snapshot['report']['name'])
    kv('导出时间',local_time(snapshot['exported_at']));kv('导出标识',snapshot['export_id'])
    kv('导出时状态',STATUS.get(snapshot['status'],snapshot['status']))
    kv('选定复核',snapshot['recheck']['id'] if snapshot['recheck'] else '未选复核记录 - 待复核；不填入其他版本结果')
    for warning in snapshot['warnings']:
        add('未解决事项：'+warning,alert)
    section('01  原句与修订')
    kv('原稿位置',snapshot['report']['paragraph']['location']);kv('段落来源',snapshot['report']['paragraph']['id'])
    kv('选定目标',f"原句第 {snapshot['target_index']+1} 处百分比，仅黄色标记数字为本次对象")
    add('只读原句');highlighted(snapshot['report']['paragraph']['text'],snapshot['target_index'])
    add(f"修订句 v{snapshot['revision']['version']}（该原句的版本）")
    if snapshot['semantic_changed']:
        add(snapshot['revision']['text']);add('目标数字：修订含义或非目标文字变化，不能可靠继承原目标定位；待人工核验。',alert)
    else:
        highlighted(snapshot['revision']['text'],snapshot['target_index'])
    kv('修改原因',snapshot['revision']['reason'] or '未填写修改原因')
    kv('修改操作',snapshot['revision']['action']);kv('修订保存时间',local_time(snapshot['revision']['created_at']))
    kv('修订版本ID',snapshot['revision']['id']);kv('父版本',snapshot['revision'].get('parent_id') or '原稿')
    section('02  原核验与本次所选复核')
    original=snapshot['original_check'];event=snapshot['recheck']
    kv('原核验时间',local_time(original['created_at']));kv('原核验保存状态',STATUS.get(original['result']['status'],original['result']['status']))
    kv('原核验在导出时的状态',STATUS.get(snapshot['original_current_status'],snapshot['original_current_status']))
    if snapshot['original_stale_reasons']:add('原核验失效原因：'+'；'.join(snapshot['original_stale_reasons']))
    kv('原核验ID',original['id']);add(original['result']['message'])
    kv('所选复核时间',local_time(event['created_at']) if event else '尚未复核 / 未选择')
    kv('所选复核保存状态',STATUS.get(event['result']['status'],event['result']['status']) if event else '待复核')
    if event:
        add(event['result']['message']);kv('导出时复核有效性','已过期：'+'；'.join(event['stale_reasons']) if event['stale'] else '所选版本和依据在导出时未显示过期')
    calculation(snapshot['original_run'],original['result'],'03  原核验计算依据（不作为未复核修订的结果）')
    calculation(snapshot['selected_run'],event['result'] if event else None,'04  所选修订版本的复核计算')
    section('05  原始行证据摘录')
    evidence=snapshot['evidence'];run=snapshot['selected_run'] or snapshot['original_run']
    add(evidence['label'])
    add(f"本报告摘录 {len(evidence['rows'])} 条（上限 {evidence['limit']}）；完整计算涉及 {run['result']['total']} 行，纳入分母 {run['result']['denominator']} 行，分子 {run['result']['numerator']} 行。计算使用完整工作表，不是只使用此摘录。")
    add('按保存证据的原始顺序摘录；字段过多或单元格过长时显式节选。全部证据可在项目内按计算记录分页查看。',small)
    cells=[[p('源行 / 稳定标识',small),p('字段与原始值',small),p('参与情况',small)]]
    for row in evidence['rows']:
        values=[];remaining=1000
        for column,cell in zip(run['source']['columns'][:10],row['row']['cells'][:10]):
            # Keep each evidence row on one page. Embedded newlines/tabs are
            # ordinary whitespace, and a bounded excerpt cannot exceed a frame.
            value='（空值）' if cell is None or str(cell).strip()=='' else re.sub(r'\s+',' ',plain(cell))
            if len(value)>180:value=value[:180]+'（本单元格节选）'
            label=re.sub(r'\s+',' ',plain(column['label']))
            if len(label)>60:label=label[:60]+'（列名节选）'
            line=label+'：'+value
            if len(line)>remaining:
                values.append('后续字段超出本行摘录长度，未列出。');break
            values.append(line);remaining-=len(line)
        if len(run['source']['columns'])>10:values.append('仅摘录前10个字段，其他字段未列出。')
        cells.append([p(f"源行 {row['row']['source_row']}\n{row['row']['id']}",small),p('\n'.join(values),small),p('分子及分母' if row['in_numerator'] else '分母内未匹配分子' if row['in_scope'] else '已排除',small)])
    table=LongTable(cells,colWidths=[116,304,91],repeatRows=1,hAlign='LEFT',splitByRow=1,splitInRow=0)
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf2fb')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),.6,colors.HexColor('#c5d1e6')),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#e4e8ef'))]))
    story.append(table)
    section('06  规则原文与快照')
    for label,rule in [('原修改依据规则',snapshot['original_rule']),('所选复核规则',snapshot['selected_rule'])]:
        add(label,heading)
        if not rule:
            add('无该阶段的已保存规则快照；没有用当前其他规则补填。');continue
        kv('规则版本',f"v{rule['version']} / {rule['id']}");kv('内容指纹',rule['fingerprint'])
        seen=set()
        for key,source in rule['sources'].items():
            identity=(source['paragraph_id'],source['quote'])
            if identity in seen:continue
            seen.add(identity)
            kv('规则来源',f"{source['name']} / {source['location']}");add(source['quote'])
            kv('段落标识',source['paragraph_id']);kv('规则资料版本指纹',source['version'])
    section('07  未解决事项与能力边界')
    for warning in snapshot['warnings'] or ['本次所选单条数字在已确认口径下未显示未解决差异，不表示原始数据真实或整篇报告通过。']:
        add('• '+warning)
    add('仅支持已确认范围、字段、空值策略及精度下的单条百分比。没有自动判断整篇报告、因果关系或未提供的基期数据。导出仅读取已保存结果，不重新计算、核验或调用模型。')
    add('本PDF是生成时的独立快照。之后资料、规则和修订变化不会改写此文件；当前有效性请在有权限的项目导出记录中查看。未提供整篇合并、批量、DOCX或XLSX导出。')
    story.append(Spacer(1,12));story.append(HRFlowable(width='100%',thickness=.5,color=colors.HexColor('#d6dfed')))
    add('文档结束 - 数有依据 · 单条核验快照',small)
    output=BytesIO()
    def footer(canvas,doc):
        canvas.saveState();canvas.setFont(font,8);canvas.setFillColor(colors.HexColor('#6f7c91'))
        canvas.drawString(42, A4[1]-27,'数有依据 / 单条百分比核验 / 快照报告')
        canvas.drawString(42,25,'仅核验选定单条，不代表整篇报告通过')
        canvas.drawRightString(A4[0]-42,25,f'第 {doc.page} 页')
        canvas.restoreState()
    doc=SimpleDocTemplate(output,pagesize=A4,rightMargin=42,leftMargin=42,topMargin=47,bottomMargin=45,title='单条结论核验报告',author='数有依据',allowSplitting=True)
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    return output.getvalue()
