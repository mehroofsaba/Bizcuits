import { useState } from 'react'
import { api, TONES, toIcs, download } from '../api.js'
import Publish from '../Publish.jsx'
import { useList, Select, Empty, Field, AiBox, Toast, useToast, runAi, Loading } from '../ui.jsx'

const KINDS = ['Social media caption', 'Product announcement', 'Promotional message', 'Daily special post', 'Short marketing description']
const PLATFORMS = ['', 'Instagram', 'Facebook', 'WhatsApp', 'Email', 'Other']

export default function Content() {
  const products = useList('/products')
  const saved = useList('/content')
  const [pid, setPid] = useState('')
  const [kind, setKind] = useState(KINDS[0])
  const [tone, setTone] = useState('friendly')
  const [plan, setPlan] = useState({ platform: '', campaign: '', plan_date: '', status: 'draft' })
  const [text, setText] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState(null)
  const [pubId, setPubId] = useState(null)
  const [editText, setEditText] = useState('')
  const [toast, show] = useToast()
  const gen = async () => {
    if (!pid) return show('Choose a product first', 'err')
    setBusy(true); const r = await runAi('/ai/content', { product_id: Number(pid), kind, tone }, show); setBusy(false)
    if (r) setText(r.text)
  }
  const keep = async () => { try { await api('/content', { method: 'POST', body: { product_id: pid, kind, tone, body: text, ...plan } }); saved.reload(); show('Content saved') } catch (e) { show(e.message, 'err') } }
  const patch = async (c, body) => { try { await api(`/content/${c.id}`, { method: 'PUT', body }); saved.reload() } catch (e) { show(e.message, 'err') } }
  const name = (id) => products.rows?.find((p) => p.id === id)?.name
  const dated = (saved.rows || []).filter((c) => c.plan_date).sort((a, b) => a.plan_date.localeCompare(b.plan_date))
  const days = [...new Set(dated.map((c) => c.plan_date))]
  const row = (c) => (
    <div className="item" key={c.id} style={{ alignItems: 'flex-start' }}>
      <span style={{ flex: 1 }}><b>{c.kind}{name(c.product_id) ? ` · ${name(c.product_id)}` : ''}</b>
        <small>{[c.platform, c.campaign].filter(Boolean).join(' · ')}</small>
        {editId === c.id ? <><textarea rows={4} value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Edit content" /><span className="row" style={{ marginTop: 6 }}><button className="btn primary sm" onClick={async () => { await patch(c, { body: editText }); setEditId(null) }}>Save</button><button className="btn ghost sm" onClick={() => setEditId(null)}>Cancel</button></span></>
          : <small style={{ whiteSpace: 'pre-wrap', display: 'block' }}>{c.body}</small>}
        {pubId === c.id && <Publish text={c.body} contentId={c.id} show={show} onDone={() => { setPubId(null); saved.reload() }} />}</span>
      <span className="row item-actions">
        <Select aria-label="Status" value={c.status} onChange={(e) => patch(c, { status: e.target.value })} style={{ width: 150 }}><option value="draft">Draft</option><option value="scheduled">Planned</option><option value="posted">Posted by me</option></Select>
        <input type="date" aria-label="Plan date" value={c.plan_date} onChange={(e) => patch(c, { plan_date: e.target.value })} style={{ width: 150 }} />
        <button className="btn ghost sm" onClick={() => { setEditId(c.id); setEditText(c.body) }}>Edit</button>
        <button className="btn ghost sm" onClick={() => navigator.clipboard?.writeText(c.body)}>Copy</button>
        <button className="btn ghost sm" onClick={() => setPubId(pubId === c.id ? null : c.id)}>Publish</button>
        <button className="btn ghost sm danger" onClick={async () => { await api(`/content/${c.id}`, { method: 'DELETE' }); saved.reload() }}>Delete</button>
      </span>
    </div>)
  return (
    <>
      <div className="page-head"><div><h1>Content Studio</h1><p>Turn products into posts. Copy them, or connect a channel and publish or schedule after you confirm.</p></div></div>
      {products.rows && !products.rows.length ? <section className="card"><Empty title="Add a product first" hint="Content Studio writes from your saved product details." /></section> : (
        <section className="card"><h2>What would you like to create?</h2>
          <div className="row">
            <div className="grow"><Field label="Product"><Select value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Choose…</option>{products.rows?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field></div>
            <div className="grow"><Field label="Format"><Select value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Field></div>
            <div className="grow"><Field label="Tone"><Select value={tone} onChange={(e) => setTone(e.target.value)}>{TONES.map((t) => <option key={t}>{t}</option>)}</Select></Field></div>
            <button className="btn primary" disabled={busy} onClick={gen}>Generate</button>
          </div>
          {busy && <Loading text="Gemma is writing…" />}
          {text != null && <div className="row" style={{ marginTop: 12 }}>
            <div className="grow"><Field label="Platform"><Select value={plan.platform} onChange={(e) => setPlan({ ...plan, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p} value={p}>{p || 'None'}</option>)}</Select></Field></div>
            <div className="grow"><Field label="Campaign"><input value={plan.campaign} onChange={(e) => setPlan({ ...plan, campaign: e.target.value })} /></Field></div>
            <div className="grow"><Field label="Plan date"><input type="date" value={plan.plan_date} onChange={(e) => setPlan({ ...plan, plan_date: e.target.value, status: e.target.value ? 'scheduled' : 'draft' })} /></Field></div></div>}
          <AiBox text={text} setText={setText} onRegenerate={gen} onSave={keep} saveLabel="Save content" />
        </section>)}
      <section className="card" style={{ marginTop: 16 }}><div className="row" style={{ justifyContent: 'space-between' }}><h2>Content calendar</h2><button className="btn ghost sm" disabled={!days.length} onClick={() => download('bizcuits-calendar.ics', toIcs(dated), 'text/calendar')}>Add to my calendar (.ics)</button></div>
        {days.length ? days.map((d) => <div className="cal-day" key={d}><b>{new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</b>{dated.filter((c) => c.plan_date === d).map(row)}</div>)
          : <p className="hint">Give saved content a plan date and it appears here, in date order.</p>}
      </section>
      <section className="card" style={{ marginTop: 16 }}><h2>All saved content</h2>
        {saved.rows && !saved.rows.length && <Empty title="Nothing saved" hint="Generated content you keep will appear here." />}
        {saved.rows?.map(row)}
      </section>
      <Toast toast={toast} />
    </>
  )
}
