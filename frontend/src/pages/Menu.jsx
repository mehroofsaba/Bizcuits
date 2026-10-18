import { useState } from 'react'
import { api, money, toCsv, download, printMenu } from '../api.js'
import { useList, Select, Empty, Field, AiBox, Toast, useToast, runAi, Loading } from '../ui.jsx'

const blank = { name: '', category: '', price: '', description: '', ingredients: '', allergens: '' }

export default function Menu({ user, setUser }) {
  const { rows, reload } = useList('/menu')
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [sel, setSel] = useState(null)
  const [mode, setMode] = useState('translate')
  const [language, setLanguage] = useState('Spanish')
  const [text, setText] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, show] = useToast()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    try { await api(editing ? `/menu/${editing}` : '/menu', { method: editing ? 'PUT' : 'POST', body: form }); setForm(blank); setEditing(null); reload(); show('Item saved') } catch (err) { show(err.message, 'err') }
  }
  const gen = async () => { setBusy(true); const r = await runAi('/ai/menu', { item_id: sel.id, mode, language }, show); setBusy(false); if (r) setText(r.text) }
  const share = async (enabled) => { const r = await api('/menu/share', { method: 'POST', body: { enabled } }); setUser(r.user) }
  const link = `${location.origin}/#/menu/${user.menu_slug}`
  const cats = [...new Set((rows || []).map((r) => r.category || 'Uncategorised'))]
  const name = user.business || user.name || 'Menu'
  return (
    <>
      <div className="page-head"><div><h1>Menu & Catalogue</h1><p>Organise items, reword or translate them, then share or print.</p></div>
        <div className="row"><button className="btn ghost sm" disabled={!rows?.length} onClick={() => printMenu(name, rows)}>Print menu</button>
          <button className="btn ghost sm" disabled={!rows?.length} onClick={() => download('menu.csv', toCsv(rows, ['category', 'name', 'price', 'description', 'ingredients', 'allergens']))}>Download CSV</button></div></div>
      <section className="card" style={{ marginBottom: 16 }}><h2>Mobile menu link</h2>
        {user.menu_public ? <div className="row"><input readOnly value={link} aria-label="Public menu link" className="grow" onFocus={(e) => e.target.select()} /><button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(link); show('Link copied') }}>Copy</button><button className="btn ghost sm" onClick={() => share(false)}>Turn off</button></div>
          : <div className="row"><span className="grow hint">Anyone with the link can view your menu once you turn this on.</span><button className="btn purple sm" onClick={() => share(true)}>Share menu</button></div>}
      </section>
      <div className="grid g2">
        <section className="card"><h2>{editing ? 'Edit item' : 'Add item'}</h2>
          <form className="stack" onSubmit={save}>
            <div className="row"><div className="grow"><Field label="Name"><input value={form.name} onChange={set('name')} required /></Field></div><div className="grow"><Field label="Category"><input value={form.category} onChange={set('category')} /></Field></div><div style={{ width: 100 }}><Field label="Price"><input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} /></Field></div></div>
            <Field label="Description"><textarea rows={2} value={form.description} onChange={set('description')} /></Field>
            <Field label="Ingredients (from you)"><input value={form.ingredients} onChange={set('ingredients')} /></Field>
            <Field label="Allergens (from you)"><input value={form.allergens} onChange={set('allergens')} /></Field>
            <div className="row"><button className="btn primary">{editing ? 'Save changes' : 'Add item'}</button>{editing && <button type="button" className="btn ghost" onClick={() => { setEditing(null); setForm(blank) }}>Cancel</button>}</div>
          </form>
        </section>
        <section className="card"><h2>Items</h2>
          {!rows && <Loading />}
          {rows && !rows.length && <Empty title="No menu items" hint="Add an item to organise your menu." />}
          {cats.map((c) => (<div key={c}><span className="tag">{c}</span>
            {rows.filter((r) => (r.category || 'Uncategorised') === c).map((r) => (
              <div className="item" key={r.id}><span><b>{r.name}</b><small>{money(r.price)}{r.allergens ? ` · Allergens: ${r.allergens}` : ''}</small></span>
                <span className="row"><button className="btn ghost sm" onClick={() => { setSel(r); setText(null) }}>Write</button>
                  <button className="btn ghost sm" onClick={() => { setEditing(r.id); setForm({ name: r.name, category: r.category, price: r.price ?? '', description: r.description, ingredients: r.ingredients, allergens: r.allergens }) }}>Edit</button>
                  <button className="btn ghost sm danger" onClick={async () => { await api(`/menu/${r.id}`, { method: 'DELETE' }); reload() }}>Delete</button></span></div>))}</div>))}
        </section>
      </div>
      {sel && (<section className="card" style={{ marginTop: 16 }}><h2>Write for {sel.name}</h2>
        <div className="row"><div className="grow"><Field label="Task"><Select value={mode} onChange={(e) => setMode(e.target.value)}><option value="translate">Translate</option><option value="simple">Simpler words</option><option value="delivery">Delivery platform text</option><option value="special">Daily special post</option></Select></Field></div>
          {mode === 'translate' && <div className="grow"><Field label="Language"><input value={language} onChange={(e) => setLanguage(e.target.value)} /></Field></div>}
          <button className="btn purple" disabled={busy} onClick={gen}>Generate</button></div>
        {busy && <Loading text="Gemma is writing…" />}
        <AiBox text={text} setText={setText} onRegenerate={gen} onSave={async () => { await api(`/menu/${sel.id}`, { method: 'PUT', body: { description: text } }); reload(); show('Description updated') }} saveLabel="Use as description" />
        <p className="hint">Allergen and ingredient details come only from what you entered. Always check them yourself.</p>
      </section>)}
      <Toast toast={toast} />
    </>
  )
}
