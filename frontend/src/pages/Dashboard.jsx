import { useEffect, useState } from 'react'
import { api, money } from '../api.js'
import { Mascot, Icon, Empty, Loading } from '../ui.jsx'

const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

export default function Dashboard({ go, user }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api('/dashboard').then(setD).catch((e) => setErr(e.message)) }, [])
  const quick = [['Create product', 'box', 'c-orange', 'products'], ['Generate content', 'pen', 'c-grape', 'content'], ['Analyze feedback', 'star', 'c-yellow', 'feedback'], ['Add task', 'check', 'c-grape', 'tasks']]
  const addTip = async () => { await api('/tasks', { method: 'POST', body: { title: 'Review product descriptions', related: d.tip.suggestion } }); setD({ ...d, tip: null }); go('tasks') }
  return (
    <>
      <div className="page-head">
        <div><h1 className="display">{hello()}{user.name ? `, ${user.name}` : ''}!</h1><p>Here is what is happening with your business.</p></div>
        <Mascot size={56} wave />
      </div>
      {err && <p className="warn" role="alert">{err}</p>}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        {quick.map(([t, i, c, to]) => <button key={t} className="quick" onClick={() => go(to)}><span className={`chip ${c}`}><Icon name={i} /></span>{t}</button>)}
      </div>
      {!d && !err && <Loading text="Loading your dashboard…" />}
      {d?.tip && <div className="tip"><span><b>Customers find some descriptions unclear.</b> {d.tip.count} comments mention it. Suggested follow-up: review the product description.</span><button className="btn primary sm" onClick={addTip}>Add as task</button></div>}
      {d && (
        <div className="grid g2">
          <section className="card"><h2>Recent activity</h2>
            {d.activity.length ? d.activity.map((a) => <div className="item" key={a.id}><span>{a.text}</span><small>{(a.created_at || '').slice(0, 10)}</small></div>)
              : <Empty title="Nothing yet" hint="Add a product or a task and it will show up here." />}
          </section>
          <section className="card"><h2>Upcoming tasks{d.overdue > 0 && <span className="tag neg" style={{ marginLeft: 8 }}>{d.overdue} overdue</span>}</h2>
            {d.tasks.length ? d.tasks.map((t) => <div className="item" key={t.id}><span><b>{t.title}</b><small>{t.due_date || 'No due date'}</small></span></div>)
              : <Empty title="No open tasks" hint="Add a task to plan your next step."><button className="btn primary sm" onClick={() => go('tasks')}>Add task</button></Empty>}
            {d.completed.length > 0 && <><small className="hint">Recently completed</small>{d.completed.map((t) => <div className="item" key={t.id}><span className="done-t">{t.title}</span></div>)}</>}
          </section>
          <section className="card"><h2>Your business at a glance</h2>
            {d.sales ? (<><div className="kpi">{money(d.sales.total_sales)}</div><small className="hint">Total recorded sales from your imported file</small>
              {d.sales.top_products.slice(0, 3).map((p, i) => <div className="item" key={p.product}><span>{i + 1}. {p.product}</span><b>{p.units}</b></div>)}</>)
              : <Empty title="No sales data" hint="Import a CSV in Analytics to see totals here."><button className="btn ghost sm" onClick={() => go('analytics')}>Import sales</button></Empty>}
          </section>
          <section className="card"><h2>Your workspace</h2>
            <div className="item"><span>Products</span><b>{d.counts.products}</b></div><div className="item"><span>Saved content</span><b>{d.counts.contents}</b></div>
            <div className="item"><span>Feedback comments</span><b>{d.counts.feedback}</b></div><div className="item"><span>Tasks</span><b>{d.counts.tasks}</b></div>
          </section>
        </div>
      )}
    </>
  )
}
