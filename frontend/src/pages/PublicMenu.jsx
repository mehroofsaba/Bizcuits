import { useEffect, useState } from 'react'
import { api, money } from '../api.js'
import { Logo, Loading } from '../ui.jsx'

export default function PublicMenu({ slug }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api(`/public/menu/${slug}`).then(setD).catch((e) => setErr(e.message)) }, [slug])
  if (err) return <div className="pmenu"><Logo size={28} /><p className="warn">{err}</p></div>
  if (!d) return <div className="pmenu"><Loading text="Loading menu…" /></div>
  const cats = [...new Set(d.items.map((i) => i.category || 'Other'))]
  return (
    <div className="pmenu">
      <h1>{d.business}</h1>
      {cats.map((c) => (
        <section key={c}><h2 style={{ color: 'var(--grape)', marginTop: 24 }}>{c}</h2>
          {d.items.filter((i) => (i.category || 'Other') === c).map((i) => (
            <div className="it" key={i.name}><div><b>{i.name}</b><div className="hint">{i.description}</div>{i.allergens && <div className="hint">Allergens (as listed by the business): {i.allergens}</div>}</div><b>{i.price != null ? money(i.price) : ''}</b></div>
          ))}
        </section>
      ))}
      <p className="hint" style={{ textAlign: 'center', marginTop: 28 }}>Made with Bizcuits. Ask staff to confirm allergen details.</p>
    </div>
  )
}
