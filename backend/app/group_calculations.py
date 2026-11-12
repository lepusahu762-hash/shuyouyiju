"""One typed categorical partition, using exactly the existing row engine."""
from fractions import Fraction
from fastapi import HTTPException
from .calculations import calculate, blank, digest, REASONS

GROUP_REASON='group_null_excluded'
REASONS[GROUP_REASON]='分组字段为空，按明确的分组策略排除'


def typed_group(value):
    kind='null' if blank(value) else 'boolean' if isinstance(value,bool) else 'number' if isinstance(value,(int,float)) else 'text'
    value=None if kind=='null' else value
    return digest({'type':kind,'value':value}),kind,value


def extrema(groups,operation):
    usable=[g for g in groups if g['result']['status']=='completed']
    if not usable:return {'lowest':[],'highest':[],'rule':'仅对有有效值的组按精确分数比较，不按舍入值排名；同值全部返回。'}
    def exact(g):
        f=g['result']['exact_fraction'];return Fraction(f['numerator'],f['denominator'])
    low=min(map(exact,usable));high=max(map(exact,usable))
    return {'lowest':[g['key'] for g in usable if exact(g)==low],'highest':[g['key'] for g in usable if exact(g)==high],
            'rule':'以各组精确分数比较；并列全部列出；不是显著性检验或因果解释。'}


def calculate_groups(sheet,body):
    indexes={c['id']:i for i,c in enumerate(sheet['columns'])}
    if body.group_by not in indexes:raise HTTPException(422,'分组字段不存在于所选工作表。')
    if body.group_null_policy is None:raise HTTPException(409,'需要明确确认分组字段空值处理方式。')
    index=indexes[body.group_by];partitions={};meta={};excluded=[]
    for ordinal,row in enumerate(sheet['rows']):
        key,kind,value=typed_group(row['cells'][index])
        row={**row,'group_key':key}
        if kind=='null' and body.group_null_policy=='exclude':excluded.append((ordinal,row));continue
        partitions.setdefault(key,[]).append((ordinal,row));meta[key]=(kind,value)
    # At most max_rows groups; persist all, only render a bounded chart window.
    accepted=[row for rows in partitions.values() for _,row in rows]
    overall,_=calculate({**sheet,'rows':accepted},body)
    evidence=[];groups=[]
    for key,rows in partitions.items():
        result,items=calculate({**sheet,'rows':[r for _,r in rows]},body)
        kind,value=meta[key]
        groups.append({'key':key,'type':kind,'value':value,'label':'（分组空值）' if kind=='null' else str(value),'result':result})
        evidence.extend({**item,'ordinal':rows[i][0]} for i,item in enumerate(items))
    evidence.extend({'ordinal':ordinal,'row':row,'in_scope':False,'in_numerator':False,'reason':GROUP_REASON} for ordinal,row in excluded)
    evidence.sort(key=lambda x:x['ordinal'])
    null_count=sum(blank(r['cells'][index]) for r in sheet['rows'])
    if null_count and body.group_null_policy=='block':
        for result in [overall,*[g['result'] for g in groups]]:
            result.update(status='needs_confirmation',message='分组字段存在空值，按已选策略暂停产出数值。',exact_fraction=None,display_value=None,unrounded_decimal=None)
    overall.update(total=len(sheet['rows']),excluded=overall['excluded']+len(excluded),group_null_rows=null_count,
                   group_null_excluded=len(excluded),groups=groups,group_count=len(groups),group_by=body.group_by,
                   group_null_policy=body.group_null_policy,chart_limit=20)
    overall['reasons'][GROUP_REASON]={'count':len(excluded),'label':REASONS[GROUP_REASON]}
    overall['extrema']=extrema(groups,body.operation)
    overall['aggregation_note']='总体由总体分子÷总体分母计算，不平均各组百分比。各组数值单位为记录/行；不同类型的同名值分开。'
    return overall,evidence
