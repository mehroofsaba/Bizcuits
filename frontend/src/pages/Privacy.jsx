import { BrandLogo } from '../ui.jsx'

const ITEMS = [
  ['Your account', 'Each business has its own account. Your products, feedback, sales and settings are visible only to you. A menu is public only if you turn on its share link.'],
  ['AI drafts', 'When AI is connected, pressing a draft button sends the text for that item to the AI provider the site owner chose. Without a connection, drafts are made from built-in templates on the server.'],
  ['Sending and posting', 'Nothing is sent or posted automatically. Each message or post needs your confirmation, and it goes to the channel you connected. Saved channel tokens are encrypted.'],
  ['Storage on your device', 'Bizcuits keeps your sign-in and theme choice in your browser storage. It does not use advertising or tracking cookies.'],
  ['Your control', 'In Settings you can download everything as a file or delete your account and all saved data. Imported sales and feedback stay until you clear them or delete the account.'],
]

export default function Privacy() {
  return (
    <div className="container" style={{ maxWidth: 760, paddingTop: 24, paddingBottom: 48 }}>
      <a href="#/" style={{ textDecoration: 'none' }}><BrandLogo size={30} /></a>
      <h1 className="display" style={{ fontSize: 36, margin: '28px 0 16px', color: 'var(--orange)' }}>Privacy &amp; data</h1>
      <div className="stack">{ITEMS.map(([t, d]) => <section className="card" key={t}><h2>{t}</h2><p style={{ margin: 0 }}>{d}</p></section>)}</div>
      <p style={{ marginTop: 24 }}><a className="pill" href="#/">Back to home</a></p>
    </div>
  )
}
