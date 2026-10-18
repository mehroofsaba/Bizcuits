import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Field, Toast, useToast, Empty } from '../ui.jsx'

const HELP = {
  facebook: 'Posts to a Facebook Page you manage. Create a Page access token in the Meta developer dashboard.',
  telegram: 'Posts to a channel or chat where your bot is an admin. Create a bot with @BotFather.',
  mastodon: 'Free. Posts to your Mastodon account. Create an access token under Preferences > Development with the write:statuses permission.',
  bluesky: 'Free. Posts to your Bluesky account (300 characters max). Create an app password under Settings > Privacy and security.',
  discord: 'Free. Posts to a Discord channel. Create a webhook under Channel settings > Integrations.',
  whatsapp: 'Sends replies to customers through the WhatsApp Business Cloud API. Outside the 24-hour customer window WhatsApp may require approved templates.',
}

function Card({ ch, reload, show }) {
  const [vals, setVals] = useState({})
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await api(`/integrations/${ch.kind}`, { method: 'PUT', body: { config: vals } }); setVals({}); reload(); show('Saved') } catch (err) { show(err.message, 'err') } finally { setBusy(false) }
  }
  const check = async () => { try { const r = await api(`/integrations/${ch.kind}/verify`, { method: 'POST' }); show(`Connected: ${r.detail}`) } catch (err) { show(err.message, 'err') } }
  return (
    <section className="card conn-card">
      <div className="conn-head"><h2>{ch.label}</h2>{ch.connected && <span className="tag pos">Connected</span>}</div>
      <p className="conn-desc">{HELP[ch.kind]}</p>
      <form className="conn-form" onSubmit={save}>
        {ch.fields.map((f) => <Field key={f.key} label={f.label}><input type={/token|password|webhook/i.test(f.key) ? 'password' : 'text'} autoComplete="off" value={vals[f.key] || ''} placeholder={ch.saved[f.key] ? `${ch.saved[f.key]} (saved, leave blank to keep)` : ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} required={!ch.saved[f.key]} /></Field>)}
        <div className="row conn-actions"><button className="btn primary" disabled={busy}>Save</button>
          {ch.connected && <><button type="button" className="btn ghost" onClick={check}>Check connection</button>
            <button type="button" className="btn ghost danger" onClick={async () => { await api(`/integrations/${ch.kind}`, { method: 'DELETE' }); reload() }}>Disconnect</button></>}</div>
      </form>
    </section>
  )
}

export default function Connections() {
  const [list, setList] = useState([])
  const [out, setOut] = useState(null)
  const [toast, show] = useToast()
  const reload = () => { api('/integrations').then(setList).catch((e) => show(e.message, 'err')); api('/outbox').then(setOut).catch(() => setOut([])) }
  useEffect(reload, [])
  const cls = { sent: 'pos', failed: 'neg', scheduled: 'neu', sending: 'neu' }
  return (
    <>
      <div className="page-head"><div><h1>Connections</h1><p>Connect your own accounts. Bizcuits only sends when you press send and confirm.</p></div></div>
      <div className="conn-grid">{list.map((c) => <Card key={c.kind} ch={c} reload={reload} show={show} />)}</div>
      <p className="hint">Your tokens are encrypted before they are stored and are never shown again. Instagram and X are not supported (they need image uploads or paid API access).</p>
      <section className="card" style={{ marginTop: 16 }}><h2>Outbox</h2>
        <p className="hint">Scheduled posts go out only while the server is awake. The site owner sets a timed ping to keep this reliable.</p>
        {out && !out.length && <Empty title="Nothing sent yet" hint="Posts and messages you send or schedule will be listed here." />}
        {out?.map((o) => (
          <div className="item" key={o.id}><span><b>{o.channel} <span className={`tag ${cls[o.status]}`}>{o.status}</span></b><small>{o.status === 'scheduled' ? `Goes out ${new Date(o.send_at.replace(' ', 'T') + 'Z').toLocaleString()}` : o.result}</small><small>{o.body.slice(0, 120)}</small></span>
            <button className="btn ghost sm danger" onClick={async () => { await api(`/outbox/${o.id}`, { method: 'DELETE' }); reload() }}>{o.status === 'scheduled' ? 'Cancel' : 'Remove'}</button></div>))}
      </section>
      <Toast toast={toast} />
    </>
  )
}
