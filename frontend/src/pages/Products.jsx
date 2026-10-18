import { useState } from 'react'
import { api, money, TONES, toCsv, download } from '../api.js'
import { useList, Select, ask, Empty, Field, AiBox, Toast, useToast, runAi, Icon, Loading } from '../ui.jsx'

const blank = { name: '', category: '', price: '', details: '' }

export default function Products() {
  const { rows, reload, error } = useList('/products')
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [sel, setSel] = useState(null)
  const [tone, setTone] = useState('friendly')
  const [mode, setMode] = useState('description')
  const [audience, setAudience] = useState('')
  const [text, setText] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, show] = useToast()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    try {
      await api(editing ? `/products/${editing}` : '/products', { method: editing ? 'PUT' : 'POST', body: form })
      setForm(blank); setEditing(null); reload(); show(editing ? 'Product updated' : 'Product saved')
    } catch (err) { show(err.message, 'err') }
  }
  const remove = async (p) => { if (await ask(`Delete "${p.name}"?`, { title: 'Delete product', ok: 'Delete', danger: true })) { await api(`/products/${p.id}`, { method: 'DELETE' }); if (sel?.id === p.id) setSel(null); reload() } }
  const generate = async () => {
    setBusy(true)
    const r = await runAi('/ai/product', { product_id: sel.id, tone, mode, audience }, show)
    setBusy(false)
    if (r) setText(r.text)
  }
  const keep = async () => {
    const field = mode === 'keywords' ? 'keywords' : 'description'
    try { await api(`/products/${sel.id}`, { method: 'PUT', body: { [field]: text } }); reload(); show('Saved to product') } catch (e) { show(e.message, 'err') }
  }

  return (
    <>
      <div className="page-head"><div><h1>Product Studio</h1><p>Manage your catalogue and create product descriptions.</p></div><button className="btn ghost sm" disabled={!rows?.length} onClick={() => download('products.csv', toCsv(rows, ['name', 'category', 'price', 'details', 'description', 'keywords']))}>Download CSV</button></div>
      {error && <p className="warn" role="alert">{error}</p>}
      <div className="grid g2">
        <section className="card">
          <h2>{editing ? 'Edit product' : 'Add product'}</h2>
          <form className="stack" onSubmit={save}>
            <Field label="Name"><input value={form.name} onChange={set('name')} required /></Field>
            <div className="row"><div className="grow"><Field label="Category"><input value={form.category} onChange={set('category')} /></Field></div>
              <div className="grow"><Field label="Price"><input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} /></Field></div></div>
            <Field label="Details (materials, ingredients, features)"><textarea rows={3} value={form.details} onChange={set('details')} /></Field>
            <div className="row"><button className="btn primary"><Icon name="plus" size={16} />{editing ? 'Save changes' : 'Add product'}</button>
              {editing && <button type="button" className="btn ghost" onClick={() => { setEditing(null); setForm(blank) }}>Cancel</button>}</div>
          </form>
        </section>
        <section className="card">
          <h2>Your products</h2>
          {rows && !rows.length && <Empty title="No products yet" hint="Add your first product to start generating descriptions." />}
          {rows?.map((p) => (
            <div className="item" key={p.id}>
              <span><b>{p.name}</b><small>{[p.category, money(p.price)].filter(Boolean).join(' · ')}</small></span>
              <span className="row">
                <button className="btn ghost sm" onClick={() => { setSel(p); setText(null) }}>Write</button>
                <button className="btn ghost sm" onClick={() => { setEditing(p.id); setForm({ name: p.name, category: p.category, price: p.price ?? '', details: p.details }) }}>Edit</button>
                <button className="btn ghost sm danger" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>Delete</button>
              </span>
            </div>
          ))}
        </section>
      </div>
      {sel && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Generate for {sel.name}</h2>
          <div className="row">
            <div className="grow"><Field label="What to write"><Select value={mode} onChange={(e) => setMode(e.target.value)}><option value="description">Description</option><option value="title">Titles</option><option value="keywords">Keywords</option><option value="promo">Promo message</option></Select></Field></div>
            <div className="grow"><Field label="Tone"><Select value={tone} onChange={(e) => setTone(e.target.value)}>{TONES.map((t) => <option key={t}>{t}</option>)}</Select></Field></div>
            <div className="grow"><Field label="Audience (optional)"><input value={audience} onChange={(e) => setAudience(e.target.value)} /></Field></div>
            <button className="btn purple" disabled={busy} onClick={generate}>Generate</button>
          </div>
          {busy && <Loading text="Gemma is writing…" />}
          {sel.description && <p className="hint">Saved description: {sel.description}</p>}
          <AiBox text={text} setText={setText} onRegenerate={generate} onSave={keep} saveLabel="Save to product" />
        </section>
      )}
      <Toast toast={toast} />
    </>
  )
}
