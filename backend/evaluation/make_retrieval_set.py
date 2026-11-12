"""Synthetic, authored relevance judgments. Not imported by product code.

Run once to recreate the fixed corpus. Splits are by theme/document, before tuning.
"""
import json
from pathlib import Path

THEMES = [
 # group, split, metric, colloquial query, scope, denominator, numerator, nearby metric, missing question
 ('service','dev','服务满意率','服务评价说满意的占多少','2026年校园服务','纳入标记为是','服务评价为满意','服务好评率','服务推荐率怎么计算'),
 ('completion','dev','工单办结率','工单办完的比例怎么算','2026年后勤工单','受理状态为已受理','办理结果为办结','工单按时办结率','工单平均耗时怎么算'),
 ('attendance','dev','活动出席率','报名之后到场的占比','2026年春季活动','报名状态为成功','签到结果为到场','活动报名率','活动复购率怎么算'),
 ('returns','dev','订单退货率','买了以后退掉的比例','2026年本店订单','订单状态为已支付','售后结果为已退货','订单退款率','订单退货率2023年旧规则'),
 ('training','dev','培训达标率','培训通过要求的占几成','2026年员工培训','考核资格为有效','考核结果为达标','培训参加率','培训推荐意愿比例'),
 ('conflict','dev','申请通过率','申请审核过了的占比','2026年本部申请','受理标记为是','审批状态为通过','申请受理率','申请通过率两个定义怎么处理'),
 ('delivery','holdout','配送准时率','送货没迟到的占几成','2025年城区配送','配送状态为送达','时效判定为准时','配送送达率','配送破损率口径'),
 ('renewal','holdout','合同续约率','合同续签的比例','2025年企业合同','到期标记为是','续签状态为已续签','合同履约率','合同平均金额怎么计算'),
 ('complaint','holdout','投诉解决率','投诉处理好了的占多少','2025年用户投诉','立案状态为已立案','处理结论为已解决','投诉及时响应率','投诉解决率针对2022年'),
 ('usage','holdout','设备启用率','机器开始使用的比例','2025年实验设备','验收状态为合格','使用标记为已启用','设备利用率','设备故障率计算口径'),
 ('coverage','holdout','回访完成率','客户回访做完的占多少','2025年门店回访','计划标记为纳入','回访结论为完成','回访接通率','回访完成率两个冲突条款'),
 ('qualification','holdout','样品合格率','样品检测过关的比例','2025年批次样品','送检状态为有效','检测结果为合格','样品一次合格率','样品破损率如何定义'),
]


def build():
    docs=[];queries=[]
    for group,split,metric,colloquial,scope,den,num,near,third in THEMES:
        texts=[f'适用范围：{scope}。本文件只按记录行统计，不代表人数，不去重。',
               f'{metric}定义：以{den}的全部记录为分母，以其中{num}的记录为分子。',
               '限制条款：分子字段缺失值仍计入分母，不得因评价或结果为空而排除；空值不匹配分子。显示精度为0位小数。',
               f'{near}另行定义：分母仅限结果非空记录，不得与{metric}混用。',
               '资料管理要求：记录来源位置与上传时间；不得将日期较新直接解释为替代所有旧规则。',
               '长文附录：'+'以下为合成档案说明，不改变指标定义。'*110+'本条不得自动删去缺失值。附录仅解释记录管理，不是新的计算口径。']
        if group in {'conflict','coverage'}:
            texts += [f'{metric}争议条款：同一适用范围内，另一部门要求只保留结果非空的记录作为分母，排除空值；两条尚未裁决，不得自动择新。']
        doc=group+'-main';archive=group+'-archive'
        docs.append({'id':doc,'split':split,'name':'明确标注的合成规则-'+group,'paragraphs':[{'id':f'{doc}:p{i+1}','location':f'正文第{i+1}段','text':t} for i,t in enumerate(texts)]})
        docs.append({'id':archive,'split':split,'name':'合成相近规则-'+group,'paragraphs':[{'id':f'{archive}:p{i+1}','location':f'附表第{i+1}段','text':t} for i,t in enumerate([
            f'2024年归档：{metric}以全部登记记录为分母，结果为空也纳入；仅适用于2024年，不适用于其他年度。',
            f'分校适用规则：{metric}按分校纳入标记为是的记录统计，不代表本部或城区。',
            '统计说明：百分比的分子必须属于分母，不能自动去重；指标名称相近也需要检查定义。',
            '报表格式：表头固定，附件仅作阅读，不是指标规则。',
            f'{near}分子定义与本文件主要指标不同，请先确认用户实际询问的指标。',
            '适用期间不明确时请用户补充，不能凭文件上传时间推断统计期。'])]})
        required=[f'{doc}:p1',f'{doc}:p2',f'{doc}:p3']
        if group in {'conflict','coverage'}:required.append(f'{doc}:p7')
        for n,q in enumerate([scope+'的'+metric+'分母和空值怎么办',scope+'，'+colloquial+'？空白怎么处理',third],1):
            absent=n==3 and group not in {'conflict','coverage'}
            queries.append({'id':f'{group}-{n}','split':split,'theme':group,'query':q,'documents':[doc,archive],
                            'required':[] if absent else required,'conflicts': [f'{doc}:p2',f'{doc}:p7'] if not absent and group in {'conflict','coverage'} else [],
                            'no_evidence':absent,'rationale':'未提供所问指标或期间的规则，不能把名称相近或其他期间定义作为可用依据。' if absent else '需要同时保留适用范围、指标分母分子定义和相邻空值限制。'+('同范围两种相反分母定义均须返回，请用户裁决。' if group in {'conflict','coverage'} else '')})
    return {'version':'synthetic-rules-36-v1','synthetic':True,'split_policy':'按主题及其全部文档预先分组；dev六组18题，holdout六组18题。不按查询随机拆分。',
            'judgment_policy':'required为多个必要段落的AND集合；conflicts是相反规则双方。缺失指标或未提供年度均无可用依据。','documents':docs,'queries':queries}


if __name__=='__main__':
    Path(__file__).with_name('rules36.json').write_text(json.dumps(build(),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
