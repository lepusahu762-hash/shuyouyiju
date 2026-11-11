import type { Column } from '../api'
import type { Condition } from '../calculationTypes'
import { Icon } from './ui'

export function CalculationConditions({ title, help, columns, items, onChange, disabled }: {
  title: string; help: string; columns: Column[]; items: Condition[]; onChange: (items: Condition[]) => void; disabled: boolean;
}) {
  function change(index: number, patch: Partial<Condition>) { onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item)) }
  return <fieldset className="condition-set" disabled={disabled}><legend>{title}</legend><p>{help}</p>{items.map((item, index) => <div className="condition-row" key={index}>
    <span className="condition-number">{index === 0 ? '条件' : '并且'} {index + 1}</span><button type="button" className="remove-condition" aria-label={`删除${title}条件${index+1}`} onClick={() => onChange(items.filter((_, i) => i !== index))}><Icon name="close" /></button>
    <label>字段<select aria-label={`${title}字段${index+1}`} value={item.column_id} onChange={event => change(index, { column_id: event.target.value })}><option value="">请选择字段</option>{columns.map(column => <option key={column.id} value={column.id}>{column.letter} · {column.label}</option>)}</select></label>
    <div className="condition-value"><label>等值方式<select aria-label={`${title}方式${index+1}`} value={item.kind} onChange={event => change(index, { kind: event.target.value as Condition['kind'], value: '' })}><option value="text">文本完全相等</option><option value="number">十进制数值相等</option><option value="boolean">布尔值相等</option></select></label><label>等于{item.kind === 'boolean' ? <select aria-label={`${title}值${index+1}`} value={item.value} onChange={event => change(index, { value: event.target.value })}><option value="">请选择</option><option value="true">true</option><option value="false">false</option></select> : <input aria-label={`${title}值${index+1}`} value={item.value} maxLength={1000} placeholder={item.kind === 'number' ? '例如 1 或 1.5' : '输入原始单元格文本'} onChange={event => change(index, { value: event.target.value })} />}</label></div>
  </div>)}<button type="button" className="add-condition" disabled={!columns.length || items.length >= 10} onClick={() => onChange([...items, { column_id: '', kind: 'text', value: '' }])}><Icon name="plus" />添加{title}条件</button></fieldset>
}
