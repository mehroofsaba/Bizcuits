import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { api, getToken, setSession } from './api.js'
import { BrandLogo, Icon, Mascot, Loading, ConfirmHost } from './ui.jsx'
import Landing from './pages/Landing.jsx'
import Auth from './pages/Auth.jsx'
import PublicMenu from './pages/PublicMenu.jsx'
import Settings from './pages/Settings.jsx'
import Connections from './pages/Connections.jsx'
import Reset from './pages/Reset.jsx'
import Privacy from './pages/Privacy.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Products from './pages/Products.jsx'
import Content from './pages/Content.jsx'
import Replies from './pages/Replies.jsx'
import Feedback from './pages/Feedback.jsx'
import Analytics from './pages/Analytics.jsx'
import Tasks from './pages/Tasks.jsx'
import Menu from './pages/Menu.jsx'

export const NAV = [
  ['home', 'Home', 'home', Dashboard], ['products', 'Products', 'box', Products], ['menu', 'Menu', 'book', Menu],
  ['content', 'Content', 'pen', Content], ['replies', 'Customers', 'users', Replies], ['feedback', 'Feedback', 'star', Feedback],
  ['analytics', 'Analytics', 'chart', Analytics], ['tasks', 'Tasks', 'check', Tasks], ['connections', 'Connections', 'link', Connections], ['settings', 'Settings', 'menu', Settings],
]

const parse = () => {
  const h = location.hash
  if (h.startsWith('#/privacy')) return { privacy: true }
  if (h.startsWith('#/menu/')) return { menu: h.split('/')[2] }
  if (h.startsWith('#/reset/')) return { reset: h.split('/')[2] }
  if (h.startsWith('#/forgot')) return { forgot: true }
  if (h.startsWith('#/app')) return { page: h.split('/')[2] || 'home' }
  return {}
}

export default function App() {
  const [r, setR] = useState(parse())
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(!!getToken())
  const [theme, setThemeState] = useState(localStorage.getItem('bz_theme') || 'biscuit')
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const setTheme = (t) => { setThemeState(t); localStorage.setItem('bz_theme', t) }
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    const on = () => { setR(parse()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (!getToken()) return
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setSession(null)).finally(() => setChecking(false))
  }, [])
  useEffect(() => { setOpen(false) }, [r.page])
  // Leaves the sample workspace and opens the sign-in screen (the label and the action agree).
  const toSignIn = () => { setSession(null); setUser(null); location.hash = '#/app' }
  const logout = () => { setSession(null); setUser(null); location.hash = '#/' }

  if (r.privacy) return <Privacy />
  if (r.menu) return <PublicMenu slug={r.menu} />
  if (r.reset || r.forgot) return <Reset token={r.reset} />
  if (!r.page) return <Landing />
  if (checking) return <div className="auth-wrap"><Loading text="Opening your workspace…" /></div>
  if (!user) return <Auth onAuth={setUser} />

  const Current = (NAV.find((n) => n[0] === r.page) || NAV[0])[3]
  const go = (p) => { location.hash = `#/app/${p}` }
  const pageId = (NAV.find((n) => n[0] === r.page) || NAV[0])[0]
  return (
    <div className="shell">
      <div className="top"><a href="#/app" style={{ textDecoration: 'none' }} aria-label="Bizcuits home"><BrandLogo size={26} /></a>
        <button className="menu-btn" aria-label="Open menu" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(!open)}><Icon name={open ? 'x' : 'menu'} /></button></div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className="side" id="sidebar" data-open={open}>
        <a href="#/" style={{ textDecoration: 'none' }} aria-label="Bizcuits home"><BrandLogo size={28} /></a>
        <nav aria-label="Workspace" style={{ display: 'contents' }}>
          {NAV.map(([id, label, icon]) => (
            <a key={id} href={`#/app/${id}`} className="nav" aria-current={r.page === id ? 'page' : undefined}><Icon name={icon} /><span>{label}</span></a>
          ))}
        </nav>
        <div className="side-foot side-mascot"><Mascot size={60} /></div>
      </aside>
      <main className={`main ${pageId === 'home' ? 'page-home' : 'polished'}`}>
        {user.is_demo && <div className="banner" role="note"><span>You are in the sample workspace. Everything here is example data.</span><button className="btn purple sm" onClick={toSignIn}>Sign in</button></div>}
        <AnimatePresence mode="wait">
          <motion.div key={r.page} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.18 }}>
            <Current go={go} user={user} setUser={setUser} theme={theme} setTheme={setTheme} logout={logout} />
          </motion.div>
        </AnimatePresence>
      </main>
      <ConfirmHost />
    </div>
  )
}
