import { useState } from 'react'
import { api } from '../api.js'
import Publish from '../Publish.jsx'
import { useList, Select, Empty, Field, AiBox, Toast, useToast, runAi, Loading } from '../ui.jsx'

const TONES = ['warm', 'professional', 'apologetic', 'concise', 'friendly']

export default function Replies() {
  const policies = useList('/policies')
  const [p, setP] = useState({ title: '', body: '' })
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState(localStorage.getItem('bz_reply_seed') || '')
  const [tone, setTone] = useState('warm')
  const [text, setText] = useState(null)
  const [needs, setNeeds] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, show] = useToast()
  localStorage.removeItem('bz_reply_seed')
  const addPolicy = async (e) => { e.preventDefault(); try { await api(editing ? `/policies/${editing}` : '/policies', { method: editing ? 'PUT' : 'POST', body: p }); setP({ title: '', body: '' }); setEditing(null); policies.reload(); show('Saved') } catch (err) { show(err.message, 'err') } }
  const draft = async () => {
    setBusy(true); const r = await runAi('/ai/reply', { message: msg, tone }, show); setBusy(false)
    if (r) { setText(r.text); setNeeds(r.needs_info) }
  }
  return (
    <>
      <div className="page-head"><div><h1>Customer Replies</h1><p>Draft replies from your approved policies. Replies only go out when you confirm a send.</p></div></div>
      <div className="grid g2">
        <section className="card"><h2>Reply drafter</h2>
          <div className="stack">
            <Field label="Customer message"><textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
            <div className="row"><div className="grow"><Field label="Tone"><Select value={tone} onChange={(e) => setTone(e.target.value)}>{TONES.map((t) => <option key={t}>{t}</option>)}</Select></Field></div>
              <button className="btn primary" disabled={busy} onClick={draft}>Draft reply</button></div>
          </div>
          {busy && <Loading text="Gemma is drafting…" />}
          <AiBox text={text} setText={setText} onRegenerate={draft} notice={needs ? 'Your saved information is not enough to answer fully. Add the missing policy or edit this draft before using it.' : ''} />
          {text != null && <Publish text={text} only="whatsapp" show={show} />}
        </section>
        <section className="card"><h2>Approved information</h2>
          <form className="stack" onSubmit={addPolicy}>
            <Field label="Title (e.g. Returns)"><input value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} required /></Field>
            <Field label="What customers can expect"><textarea rows={3} value={p.body} onChange={(e) => setP({ ...p, body: e.target.value })} required /></Field>
            <div className="row"><button className="btn purple">{editing ? 'Save changes' : 'Save policy'}</button>{editing && <button type="button" className="btn ghost" onClick={() => { setEditing(null); setP({ title: '', body: '' }) }}>Cancel</button>}</div>
          </form>
          {policies.rows && !policies.rows.length && <Empty title="No policies yet" hint="Add delivery, returns or FAQ details so replies stay accurate." />}
          {policies.rows?.map((x) => <div className="item" key={x.id}><span><b>{x.title}</b><small>{x.body}</small></span><span className="row"><button className="btn ghost sm" onClick={() => { setEditing(x.id); setP({ title: x.title, body: x.body }) }}>Edit</button><button className="btn ghost sm danger" onClick={async () => { await api(`/policies/${x.id}`, { method: 'DELETE' }); policies.reload() }}>Delete</button></span></div>)}
        </section>
      </div>
      <Toast toast={toast} />
    </>
  )
}
