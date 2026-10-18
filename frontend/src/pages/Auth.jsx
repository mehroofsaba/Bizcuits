import { useState } from 'react'
import { api, setSession } from '../api.js'
import { Logo, Mascot, Field } from '../ui.jsx'

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', name: '', business: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const go = async (path, body) => {
    setBusy(true); setErr('')
    try { const r = await api(path, { method: 'POST', body }); setSession(r.token); onAuth(r.user) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="auth-wrap">
      <div className="card auth">
        <a href="#/" style={{ textDecoration: 'none' }}><Logo size={36} /></a>
        <Mascot size={84} wave className="" />
        <div className="tabs" role="tablist">
          {[['login', 'Sign in'], ['register', 'Create account']].map(([k, l]) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setErr('') }}>{l}</button>)}
        </div>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); go(mode === 'login' ? '/auth/login' : '/auth/register', f) }}>
          {mode === 'register' && <><Field label="Your name"><input value={f.name} onChange={set('name')} autoComplete="name" /></Field><Field label="Business name"><input value={f.business} onChange={set('business')} /></Field></>}
          <Field label="Email"><input type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></Field>
          <Field label="Password (8+ characters)"><input type="password" required minLength={8} value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></Field>
          {err && <p className="warn" role="alert">{err}</p>}
          <button className="btn primary" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        {mode === 'login' && <a href="#/forgot" className="hint">Forgot your password?</a>}
        <button className="btn ghost" disabled={busy} onClick={() => go('/auth/demo')}>Try the sample workspace</button>
        <small className="hint">The sample workspace is a separate account filled with clearly labelled example data.</small>
      </div>
    </div>
  )
}
