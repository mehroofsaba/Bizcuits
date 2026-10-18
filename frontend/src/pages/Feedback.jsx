import { useEffect, useState } from 'react'
import { api, download } from '../api.js'
import { useList, Select, Empty, Field, Toast, useToast, runAi, Loading } from '../ui.jsx'

export default function Feedback({ go }) {
  const list = useList('/feedback')
  const products = useList('/products')
  const [ins, setIns] = useState(null)
  const [bulk, setBulk] = useState('')
  const [pid, setPid] = useState('')
  const [errors, setErrors] = useState([])
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, show] = useToast()
  const refresh = () => { list.reload(); api('/feedback/insights').then(setIns).catch((e) => show(e.message, 'err')) }
  useEffect(() => { api('/feedback/insights').then(setIns).catch(() => setIns(null)) }, [])
  const add = async () => {
    try { await api('/feedback/bulk', { method: 'POST', body: { text: bulk, product_id: pid } }); setBulk(''); refresh(); show('Comments added') } catch (e) { show(e.message, 'err') }
  }
  const upload = async (e) => {
    const f = e.target.files[0]; if (!f) return
    const fd = new FormData(); fd.append('file', f); setErrors([])
    try { const r = await api('/feedback/import', { method: 'POST', body: fd }); setErrors(r.errors); refresh(); show(`Imported ${r.imported} comments`) } catch (err) { setErrors(err.data?.errors || [err.message]) }
    e.target.value = ''
  }
  const toTask = async (t) => { await api('/tasks', { method: 'POST', body: { title: t.suggestion, related: `Feedback: ${t.count} comments mention ${t.name.toLowerCase()}` } }); show('Task added') }
  const reply = (body) => { localStorage.setItem('bz_reply_seed', body); go('replies') }
  const sum = async () => { setBusy(true); const r = await runAi('/feedback/summary', {}, show); setBusy(false); if (r) setSummary(r.text) }
  const S = { positive: ['Positive', 'pos'], neutral: ['Neutral', 'neu'], negative: ['Negative', 'neg'] }
  return (
    <>
      <div className="page-head"><div><h1>Feedback Insights</h1><p>Understand your customers, find patterns, take action.</p></div></div>
      <section className="card"><h2>Add comments</h2>
        <Field label="Paste one review or comment per line"><textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} /></Field>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="grow"><Field label="About product (optional)"><Select value={pid} onChange={(e) => setPid(e.target.value)}><option value="">All / not specified</option>{products.rows?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field></div>
          <button className="btn primary" onClick={add}>Add comments</button>
          <button className="btn ghost" onClick={() => download('feedback-template.csv', 'comment,rating\n')}>CSV template</button>
          <label className="btn ghost" style={{ cursor: 'pointer' }}>Import CSV<input type="file" accept=".csv" className="sr" onChange={upload} /></label>
        </div>
        <p className="hint">CSV needs a comment, review, feedback, body or text column. A rating column (1 to 5) is optional.</p>
        {errors.length > 0 && <div className="warn" role="alert">{errors.map((e) => <div key={e}>{e}</div>)}</div>}
      </section>
      {ins ? (<>
        <div className="grid g3" style={{ marginTop: 16 }}>
          {Object.entries(S).map(([k, [label, cls]]) => (<div className="card stat" key={k}><span className={`tag ${cls}`}>{label}</span><div className="kpi">{ins.sentiment[k].percent}%</div><small className="hint">{ins.sentiment[k].count} of {ins.total} comments</small></div>))}
        </div>
        <section className="card" style={{ marginTop: 16 }}><h2>Top themes</h2>
          {ins.themes.length ? ins.themes.map((t) => (<div key={t.name} style={{ marginBottom: 16 }}>
            <div className="item" style={{ borderBottom: 0, paddingBottom: 4 }}><b>{t.name}</b><span className="row"><span>{t.count} comments · {t.percent}%</span></span></div>
            <div className="meter"><i style={{ width: `${t.percent}%` }} /></div>
            <div className="item"><small>Suggestion: {t.suggestion}</small><button className="btn ghost sm" onClick={() => toTask(t)}>Add as task</button></div>
            {t.examples.map((e) => <div className="item" key={e.id}><small>“{e.body}”</small><button className="btn ghost sm" onClick={() => reply(e.body)}>Draft reply</button></div>)}
          </div>)) : <p className="hint">No recurring themes found in these comments yet.</p>}
          <p className="hint">{ins.note}</p>
          <div className="row"><button className="btn purple sm" disabled={busy} onClick={sum}>Summarize with Gemma</button></div>
          {busy && <Loading text="Gemma is summarizing…" />}
          {summary && <p className="aibox">{summary}</p>}
        </section>
      </>) : <section className="card" style={{ marginTop: 16 }}><Empty title="No feedback yet" hint="Paste or import customer comments to see themes and percentages." /></section>}
      {list.rows?.length > 0 && <section className="card" style={{ marginTop: 16 }}><h2>All comments ({list.rows.length})</h2>
        {list.rows.slice(0, 30).map((r) => <div className="item" key={r.id}><small>{r.body}{r.rating ? ` (${r.rating}/5)` : ''}</small><button className="btn ghost sm danger" onClick={async () => { await api(`/feedback/${r.id}`, { method: 'DELETE' }); refresh() }}>Delete</button></div>)}</section>}
      <Toast toast={toast} />
    </>
  )
}
