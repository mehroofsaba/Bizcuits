import { useEffect, useState } from 'react'
import { api, download, THEMES } from '../api.js'
import { Field, Toast, useToast, ask } from '../ui.jsx'

export default function Settings({ user, setUser, theme, setTheme, logout }) {
  const [f, setF] = useState({ name: user.name, business: user.business })
  const [toast, show] = useToast()
  const [bill, setBill] = useState(null)
  useEffect(() => { api('/billing/status').then(setBill).catch(() => {}) }, [])
  const redirect = async (path) => { try { const r = await api(path, { method: 'POST' }); location.href = r.url } catch (e) { show(e.message, 'err') } }
  const save = async (e) => { e.preventDefault(); try { const r = await api('/auth/me', { method: 'PUT', body: f }); setUser(r.user); show('Saved') } catch (err) { show(err.message, 'err') } }
  const exportAll = async () => { download('bizcuits-export.json', JSON.stringify(await api('/export'), null, 2), 'application/json') }
  const del = async () => {
    if (!(await ask('Delete your account and all saved data? This cannot be undone.', { title: 'Delete account', ok: 'Delete everything', danger: true }))) return
    await api('/auth/account', { method: 'DELETE' }); logout()
  }
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p>Your profile, theme and data.</p></div></div>
      <div className="grid g2">
        <section className="card"><h2>Profile</h2>
          <form className="stack" onSubmit={save}>
            <Field label="Your name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Business name"><input value={f.business} onChange={(e) => setF({ ...f, business: e.target.value })} /></Field>
            <small className="hint">Signed in as {user.email}</small>
            <button className="btn primary">Save profile</button>
          </form>
        </section>
        <section className="card"><h2>Theme</h2>
          <div className="theme-row">{Object.entries(THEMES).map(([k, l]) => <button key={k} aria-pressed={theme === k} onClick={() => setTheme(k)}>{l}</button>)}</div>
          <p className="hint">Biscuit Shop is the default. Themes change colours only.</p>
        </section>
        {bill && <section className="card" style={{ gridColumn: '1 / -1' }}><h2>{bill.metered ? `Plan: ${bill.plan === 'pro' ? 'Pro' : 'Free'}` : 'Usage'}</h2>
          <p>Products {bill.usage.products}/{bill.limits.products} · Menu items {bill.usage.menu_items}/{bill.limits.menu_items} · {bill.limits.ai_per_hour} AI drafts per hour · {bill.limits.scheduled} scheduled posts{!bill.metered && ' (limits are high because this server has no paid plans)'}</p>
          <div className="row">{bill.metered && (bill.plan === 'free' ? <button className="btn primary" onClick={() => redirect('/billing/checkout')}>Upgrade to Pro</button> : bill.manage && <button className="btn ghost" onClick={() => redirect('/billing/portal')}>Manage billing</button>)}</div>
          
        </section>}
        <section className="card" style={{ gridColumn: '1 / -1' }}><h2>Your data</h2>
          <p>Everything you save is stored under your account. Imported sales and feedback stay until you clear them. Text you send to an AI button goes to the configured Gemma provider for that request only.</p>
          <div className="row"><button className="btn ghost" onClick={exportAll}>Download all my data</button><button className="btn ghost" onClick={logout}>Sign out</button><button className="btn ghost danger" onClick={del}>Delete account and data</button></div>
        </section>
      </div>
      <Toast toast={toast} />
    </>
  )
}
