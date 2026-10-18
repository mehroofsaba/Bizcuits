import { useState } from 'react'
import { api } from '../api.js'
import { Logo, Mascot, Field } from '../ui.jsx'

/** token present: choose a new password. No token: ask for a reset email. */
export default function Reset({ token }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('')
    try {
      if (token) { await api('/auth/reset', { method: 'POST', body: { token, password } }); setDone(true) }
      else { const r = await api('/auth/forgot', { method: 'POST', body: { email } }); setMsg(r.message) }
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <div className="auth-wrap">
      <div className="card auth">
        <a href="#/" style={{ textDecoration: 'none' }}><Logo size={36} /></a>
        <Mascot size={80} />
        <h1 style={{ fontSize: 24 }}>{token ? 'Choose a new password' : 'Reset your password'}</h1>
        {done ? <><p>Your password is updated.</p><a className="btn primary" href="#/app" style={{ justifyContent: 'center' }}>Sign in</a></> : (
          <form className="stack" onSubmit={submit} style={{ textAlign: 'left' }}>
            {token ? <Field label="New password (8+ characters)"><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
              : <Field label="Account email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>}
            {err && <p className="warn" role="alert">{err}</p>}
            {msg && <p className="banner" role="status">{msg}</p>}
            <button className="btn primary" disabled={busy} style={{ justifyContent: 'center' }}>{token ? 'Save password' : 'Send reset link'}</button>
            <a href="#/app" className="hint">Back to sign in</a>
          </form>)}
      </div>
    </div>
  )
}
