// Current, deliberately bounded release claims. Roadmap items are never success states.
export const capabilities = [
  { name: '数据体检', state: '有限支持', detail: 'CSV/XLSX空值、重复表头与位置提示；不自动清洗或判断数据真实性。' },
  { name: '统计规则与依据库', state: '已实现', detail: '规则文本/DOCX、本地关键词与BM25检索、逐项确认快照、来源定位及后台冲突阻断。' },
  { name: '对话式分析', state: '有限支持', detail: '记录数、记录占比、单分类字段分组、最高最低/并列、等值并且筛选；方案需人工确认。' },
  { name: '交互图表', state: '有限支持', detail: '分组柱状图、对应数据表、分页与源行联动；不含复杂图表或任意统计。' },
  { name: '报告与图表核验', state: '有限支持', detail: '每次一条百分比；报告文字或PNG/JPEG明确标签，人工确认后由后台计算；不代表整篇通过。' },
  { name: '修改复核', state: '有限支持', detail: '报告文字单条数字修订、保留原因、不可覆盖版本及确定性复核；不含整篇自动改写。' },
  { name: '成果导出', state: '有限支持', detail: '所选报告原句、修订版本与具体复核的PDF和项目导出记录；不含图片核验PDF、DOCX/XLSX或批量导出。' },
  { name: '历史与版本', state: '有限支持', detail: '计算/规则/AI任务/修订/导出快照与过期提示；不含完整文件版本管理与差异对比。' },
]
