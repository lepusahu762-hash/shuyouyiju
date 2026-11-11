import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Brand, Icon } from '../components/ui'

type Mode = 'login' | 'register'
type Fields = { email: string; password: string; confirm: string }
type Errors = Partial<Fields>

function validate(fields: Fields, mode: Mode): Errors {
  const errors: Errors = {}
  if (!fields.email.trim()) errors.email = '请输入邮箱地址。'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) errors.email = '请输入完整邮箱，例如 name@example.com。'
  if (!fields.password) errors.password = '请输入密码。'
  else if (mode === 'register' && (fields.password.length < 8 || fields.password.length > 72)) errors.password = '密码长度需为 8–72 个字符。'
  else if (mode === 'register' && (!/[a-zA-Z]/.test(fields.password) || !/[0-9]/.test(fields.password))) errors.password = '密码需同时包含英文字母和数字。'
  if (mode === 'register' && !fields.confirm) errors.confirm = '请再次输入密码。'
  else if (mode === 'register' && fields.confirm !== fields.password) errors.confirm = '两次输入的密码不一致，请重新检查。'
  return errors
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>(() => new URLSearchParams(window.location.search).get('mode') === 'register' ? 'register' : 'login')
  const [fields, setFields] = useState<Fields>({ email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const form = useRef<HTMLFormElement>(null)
  const isRegister = mode === 'register'
  useEffect(() => { document.title = `${isRegister ? '注册' : '登录'} · 数有依据` }, [isRegister])
  function changeMode(next: Mode) {
    if (next === mode) return
    setMode(next); setErrors({}); setNotice(''); setShowPassword(false); setShowConfirm(false)
    setFields(current => ({ email: current.email, password: '', confirm: '' }))
    window.history.replaceState(null, '', next === 'register' ? '/auth?mode=register' : '/auth')
  }
  function updateField(name: keyof Fields, value: string) {
    setFields(current => ({ ...current, [name]: value }))
    setErrors(current => ({ ...current, [name]: undefined, ...(name === 'password' ? { confirm: undefined } : {}) }))
    setNotice('')
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate(fields, mode)
    setErrors(nextErrors); setNotice('')
    const first = Object.keys(nextErrors)[0]
    if (first) { form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus(); return }
    // Intentionally no request, storage, session or success state until auth exists.
    setNotice(`认证服务尚未接通，暂时无法${isRegister ? '注册账户' : '登录'}。信息未发送或保存，请先体验示例。`)
  }

  return <div className="auth-page"><a className="skip-link" href="#auth-form">跳到登录注册表单</a><header className="auth-header"><a href="/" aria-label="数有依据，返回首页"><Brand /></a><a className="back-home" href="/"><Icon name="back" />返回首页</a></header><main className="auth-main"><section className="auth-story" aria-label="产品介绍"><p className="section-kicker">从这里，连接数据与结论。</p><h2>让每一次判断，<br />都有迹可循。</h2><p className="auth-story-description">从表格里的一个数字，<br />到报告里的一句结论。</p><div className="auth-evidence-card"><div className="source-card-title"><Icon name="link" /><strong>一条有依据的结论</strong><span className="example-label">合成示例</span></div><p>有效答题问卷的满意率为 <b>80%</b>。</p><div className="auth-equation"><span>144 <small>满意人数</small></span><i>÷</i><span>180 <small>有效答题</small></span><i>=</i><strong>80%</strong></div><div className="auth-card-source"><Icon name="check" />数据、计算与口径，彼此对应。</div></div><div className="auth-story-note"><span /><p>先用示例走一遍，让每一步都清楚。</p></div></section>
      <section className="auth-form-section" aria-labelledby="auth-title"><div className="auth-form-inner"><div className="auth-mobile-brand-note">连接数据与结论，让每一步有据可循。</div><div className="auth-mode" role="group" aria-label="登录或注册"><button type="button" aria-pressed={!isRegister} onClick={() => changeMode('login')}>登录</button><button type="button" aria-pressed={isRegister} onClick={() => changeMode('register')}>注册</button></div><h1 id="auth-title">{isRegister ? '开启有依据的工作。' : '欢迎回到数有依据。'}</h1><p className="auth-subtitle">{isRegister ? '注册界面预览，账户服务即将接入。' : '登录界面预览，先熟悉你的工作入口。'}</p><div className="auth-service-note" id="auth-service-note"><Icon name="info" /><p><strong>认证服务尚未接通</strong><span>当前仅检查输入格式，不会发送或保存信息。<br />你可以直接体验示例，无需创建账户。</span></p></div>
      <form ref={form} id="auth-form" noValidate onSubmit={submit} aria-describedby="auth-service-note"><div className="form-field"><label htmlFor="email">邮箱</label><input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" value={fields.email} required aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} onChange={event => updateField('email', event.target.value)} />{errors.email && <p id="email-error" className="field-error" role="alert">{errors.email}</p>}</div><div className="form-field"><label htmlFor="password">密码</label><div className="password-input"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? '至少 8 位，包含字母和数字' : '请输入密码'} value={fields.password} required aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : isRegister ? 'password-help' : undefined} onChange={event => updateField('password', event.target.value)} /><button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name={showPassword ? 'eyeOff' : 'eye'} /></button></div>{errors.password ? <p id="password-error" className="field-error" role="alert">{errors.password}</p> : isRegister && <p id="password-help" className="field-help">8–72 个字符，同时包含英文字母和数字。</p>}</div>{isRegister && <div className="form-field"><label htmlFor="confirm">确认密码</label><div className="password-input"><input id="confirm" name="confirm" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="请再次输入密码" value={fields.confirm} required aria-invalid={!!errors.confirm} aria-describedby={errors.confirm ? 'confirm-error' : undefined} onChange={event => updateField('confirm', event.target.value)} /><button type="button" aria-label={showConfirm ? '隐藏确认密码' : '显示确认密码'} aria-pressed={showConfirm} onClick={() => setShowConfirm(!showConfirm)}><Icon name={showConfirm ? 'eyeOff' : 'eye'} /></button></div>{errors.confirm && <p id="confirm-error" className="field-error" role="alert">{errors.confirm}</p>}</div>}{notice && <p className="auth-submit-notice" role="alert">{notice}</p>}<button className="button button-primary auth-submit" type="submit">{isRegister ? '注册' : '登录'}<Icon name="arrow" /></button><p className="auth-button-note">当前提交仅校验表单，{isRegister ? '不会创建账户' : '不会建立登录会话'}。</p></form><div className="auth-alternative"><span>想先了解产品？</span><a href="/#demo">体验示例<Icon name="arrow" /></a></div></div></section></main><footer className="auth-footer"><span>© 2026 数有依据</span><a href="/#faq">使用与数据说明</a></footer></div>
}
