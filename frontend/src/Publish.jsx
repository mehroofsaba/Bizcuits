import { useEffect, useState } from 'react'
import { api } from './api.js'
import { Field, Select, ask } from './ui.jsx'

/** Send or schedule a message. Always shows a confirmation first; nothing leaves Bizcuits without a click here. */
export default function Publish({ text, contentId, only, show, onDone }) {
  const [list, setList] = useState(null)
  const [ch, setCh] = useState('')
  const [to, setTo] = useState('')
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { api('/integrations').then((r) => { const ok = r.filter((i) => i.connected && (!only || i.kind === only)); setList(ok); setCh(ok[0]?.kind || '') }).catch(() => setList([])) }, [only])
  if (!list) return null
  if (!list.length) return <p className="hint">Connect {only ? 'WhatsApp' : 'a channel'} in <a href="#/app/connections">Connections</a> to send from here.</p>
  const label = list.find((i) => i.kind === ch)?.label
  const scheduled = when && ch !== 'whatsapp'
  const go = async () => {
    if (!text.trim()) return show('There is nothing to send yet', 'err')
    if (!(await ask(`This goes to ${label}${ch === 'whatsapp' ? ` (${to})` : ''}:\n\n${text.slice(0, 300)}`, { title: scheduled ? 'Schedule this post?' : 'Send this now?', ok: scheduled ? 'Schedule' : 'Send' }))) return
    setBusy(true)
    try {
      await api('/send', { method: 'POST', body: { channel: ch, body: text, to, content_id: contentId, confirm: true, send_at: scheduled ? new Date(when).toISOString() : undefined } })
      show(scheduled ? 'Scheduled. See Connections > Outbox' : 'Sent!'); onDone?.()
    } catch (e) { show(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <div className="row" style={{ marginTop: 8 }}>
      {list.length > 1 && <div className="grow"><Field label="Send to"><Select value={ch} onChange={(e) => setCh(e.target.value)}>{list.map((i) => <option key={i.kind} value={i.kind}>{i.label}</option>)}</Select></Field></div>}
      {ch === 'whatsapp' && <div className="grow"><Field label="Customer number with country code"><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="15551234567" inputMode="tel" /></Field></div>}
      {ch !== 'whatsapp' && <div className="grow"><Field label="Schedule for (optional)"><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field></div>}
      <button className="btn purple" disabled={busy || !ch} onClick={go}>{scheduled ? 'Schedule' : `Send to ${label}`}</button>
    </div>
  )
}
