"""Deterministic, read-only parsers. Source IDs never depend on display sorting."""
import csv
import io
import math
import zipfile
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from docx import Document
from docx.text.paragraph import Paragraph
from docx.table import Table
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter
from .config import Settings


class ParseError(ValueError):
    pass


def scalar(value):
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def make_sheet(asset_id, index, name, records, settings, source_lines=None):
    if not records:
        return {"id": f"s{index}", "name": name, "columns": [], "row_count": 0, "rows": [], "issues": [{"code": "empty_sheet", "message": "空工作表，没有表头或数据。", "count": 1, "locations": []}]}
    width = max(map(len, records))
    row_count = len(records) - 1
    if width > settings.max_columns or row_count > settings.max_rows or len(records) * width > settings.max_cells:
        raise ParseError(f"表格超过当前限制：每表最多 {settings.max_rows} 行、{settings.max_columns} 列及 {settings.max_cells} 个单元格。请拆分后上传。")
    sid = f"s{index}"
    headers = [str(scalar(v)) if v is not None else "" for v in records[0]]
    headers += [""] * (width - len(headers))
    columns = [{"id": f"{asset_id}:v1:{sid}:c{i+1}", "name": header, "label": header or f"未命名列 {i+1}", "index": i + 1, "letter": get_column_letter(i+1)} for i, header in enumerate(headers)]
    issues = []
    counts = Counter(h.strip() for h in headers if h.strip())
    for name_, count in counts.items():
        if count > 1:
            issues.append({"code": "duplicate_header", "message": f"表头“{name_}”重复 {count} 次；各列仍按独立位置保留。", "count": count, "locations": [f"{get_column_letter(i+1)}1" for i, h in enumerate(headers) if h.strip() == name_]})
    empty_headers = [f"{get_column_letter(i+1)}1" for i, h in enumerate(headers) if not h.strip()]
    if empty_headers:
        issues.append({"code": "empty_header", "message": "存在未命名表头，请补充字段含义。", "count": len(empty_headers), "locations": empty_headers[:20]})
    null_counts, null_places = [0] * width, [[] for _ in range(width)]
    rows, ragged, formulas = [], [], []
    for number, record in enumerate(records[1:], 2):
        if len(record) != len(records[0]):
            ragged.append(str(number))
        cells = [scalar(v) for v in record] + [None] * (width - len(record))
        for column, cell in enumerate(cells):
            if isinstance(cell, str) and len(cell) > 100000:
                raise ParseError("单个单元格超过 100000 个字符，暂不支持预览，请拆分。")
            if cell is None or (isinstance(cell, str) and not cell.strip()):
                null_counts[column] += 1
                if len(null_places[column]) < 20:
                    null_places[column].append(f"{get_column_letter(column+1)}{number}")
            if isinstance(cell, str) and cell.startswith("="):
                formulas.append(f"{get_column_letter(column+1)}{number}")
        rows.append({"id": f"{asset_id}:v1:{sid}:r{number}", "source_row": number,
                     "source_line": source_lines[number-1] if source_lines else number, "cells": cells})
    for i, count in enumerate(null_counts):
        if count:
            issues.append({"code": "null_values", "column_id": columns[i]["id"], "message": f"{columns[i]['label']}（{columns[i]['letter']}列）有 {count} 个空值；未填补或删除。", "count": count, "locations": null_places[i]})
    if ragged:
        issues.append({"code": "row_width", "message": "部分记录的列数与表头不同；多余列和缺失位置均已保留。", "count": len(ragged), "locations": ragged[:20]})
    if formulas:
        issues.append({"code": "formula", "message": "公式按原文显示，未执行或重新计算。", "count": len(formulas), "locations": formulas[:20]})
    return {"id": sid, "name": name, "columns": columns, "row_count": row_count, "rows": rows, "issues": issues}


def parse_csv(path, asset_id, options, settings):
    raw = path.read_bytes()
    encoding = options.get("encoding", "auto")
    if encoding == "auto":
        candidates = ["utf-16"] if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else ["utf-8-sig", "gb18030"]
    else:
        candidates = [encoding]
    for codec in candidates:
        try:
            content = raw.decode(codec)
            encoding = codec
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ParseError("CSV 编码无法识别。请选择正确编码后重试，或另存为 UTF-8 CSV。")
    if "\0" in content or not content.strip():
        raise ParseError("CSV 为空或含有二进制内容，请上传有效文本表格。")
    delimiter = options.get("delimiter", "auto")
    if delimiter == "auto":
        try:
            delimiter = csv.Sniffer().sniff(content[:8192], delimiters=",;\t|").delimiter
        except csv.Error:
            delimiter = ","
    reader = csv.reader(io.StringIO(content, newline=""), delimiter=delimiter, strict=True)
    records, lines = [], []
    try:
        for record in reader:
            lines.append(reader.line_num)
            records.append(record)
            if len(records) > settings.max_rows + 1 or len(record) > settings.max_columns:
                raise ParseError("CSV 行数或列数超过当前限制，请拆分后上传。")
    except csv.Error as error:
        raise ParseError("CSV 引号、分隔符或字段长度不合法，请修正文件或切换分隔符后重试。") from error
    sheet = make_sheet(asset_id, 1, "CSV 数据", records, settings, lines)
    return {"kind": "table", "encoding": encoding, "delimiter": delimiter, "sheets": [sheet], "notes": ["第一条记录作为表头；原始记录顺序保留。"]}


def check_archive(path: Path, expected: str):
    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
            if len(entries) > 3000 or sum(item.file_size for item in entries) > 100 * 1024 * 1024:
                raise ParseError("解压后的文档超过当前解析限制，请精简后上传。")
            if expected not in archive.namelist():
                raise ParseError("文件内容与扩展名不符，或文档结构已损坏。")
            for item in entries:
                if item.flag_bits & 1:
                    raise ParseError("暂不支持加密文件，请解除密码后上传。")
                if item.filename.endswith(".xml"):
                    raw = archive.read(item)
                    if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
                        raise ParseError("文档包含不支持的 XML 实体声明。")
    except (zipfile.BadZipFile, RuntimeError) as error:
        raise ParseError("文件不是有效的 Office 文档，可能已损坏或加密。") from error


def parse_xlsx(path, asset_id, settings):
    check_archive(path, "xl/workbook.xml")
    workbook = load_workbook(path, read_only=True, data_only=False, keep_links=False)
    try:
        if len(workbook.worksheets) > 30:
            raise ParseError("工作表超过 30 个，请拆分文件。")
        sheets, total_cells = [], 0
        for index, sheet in enumerate(workbook.worksheets, 1):
            if sheet.max_row and sheet.max_row > settings.max_rows + 1 or sheet.max_column and sheet.max_column > settings.max_columns:
                raise ParseError(f"工作表“{sheet.title}”范围超过限制；请检查远端格式化单元格或拆分文件。")
            records = []
            for row in sheet.iter_rows(values_only=True):
                records.append(list(row))
                total_cells += len(row)
                if len(records) > settings.max_rows + 1 or len(row) > settings.max_columns or total_cells > settings.max_cells:
                    raise ParseError("工作簿超过当前行、列或总单元格限制，请拆分。")
            if len(records) == 1 and all(value is None for value in records[0]):
                records = []
            sheets.append(make_sheet(asset_id, index, sheet.title, records, settings))
        return {"kind": "table", "sheets": sheets, "notes": ["每表第 1 行作为表头；保留空单元格和原始行号。合并单元格只保留左上角值，不自动填充；公式显示原文，不计算。"]}
    finally:
        workbook.close()


def parse_docx(path, asset_id):
    check_archive(path, "word/document.xml")
    document = Document(path)
    paragraphs, total = [], 0

    def add(paragraph, location):
        nonlocal total
        content = paragraph.text
        total += len(content)
        if total > 1000000 or len(paragraphs) >= 20000:
            raise ParseError("报告超过 100 万字符或 20000 个段落，暂不支持，请拆分。")
        if content.strip():
            paragraphs.append({"id": f"{asset_id}:v1:{location}", "location": location, "text": content,
                               "style": paragraph.style.name if paragraph.style else "Normal"})

    for i, block in enumerate(document.iter_inner_content(), 1):
        if isinstance(block, Paragraph):
            add(block, f"body:{i}")
        elif isinstance(block, Table):
            seen = set()
            for r, row in enumerate(block.rows, 1):
                for c, cell in enumerate(row.cells, 1):
                    if cell._tc in seen:
                        continue
                    seen.add(cell._tc)
                    for p, paragraph in enumerate(cell.paragraphs, 1):
                        add(paragraph, f"body:{i}:table:r{r}:c{c}:p{p}")
    if not paragraphs:
        raise ParseError("未找到可读取的正文段落。扫描图片、文本框或仅含页眉页脚的文档暂不支持。")
    return {"kind": "report", "paragraphs": paragraphs, "paragraph_count": len(paragraphs),
            "notes": ["读取正文及正文表格内非空段落；不读取图片、文本框、页眉页脚及批注。来源标识保留正文位置。"]}


def parse_file(path, extension, asset_id, options, settings):
    try:
        if extension == ".csv":
            return parse_csv(path, asset_id, options, settings)
        if extension == ".xlsx":
            return parse_xlsx(path, asset_id, settings)
        if extension == ".docx":
            return parse_docx(path, asset_id)
        if extension == ".txt":
            paragraphs = [{"id": f"{asset_id}:v1:line:{i}", "location": f"line:{i}", "text": line, "style": "Normal"} for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1) if line.strip()]
            return {"kind": "report", "paragraphs": paragraphs, "paragraph_count": len(paragraphs), "notes": ["粘贴文本按非空行分段；原始文本完整保留。"]}
        raise ParseError("暂不支持此格式。")
    except ParseError:
        raise
    except Exception as error:
        raise ParseError("文件解析失败。请确认文件可正常打开、未加密且与扩展名一致；原件已保留，可单独重试。") from error
