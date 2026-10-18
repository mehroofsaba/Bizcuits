import { Children, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { api } from './api.js'

export function Mascot({ size = 96, className = '', wave = false }) {
  const bumps = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2
    return [60 + Math.cos(a) * 34, 60 + Math.sin(a) * 34]
  })
  return (
    <svg className={`mascot ${className}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Bizcuits biscuit mascot">
      <g fill="#593522" stroke="#593522" strokeWidth="6">
        {bumps.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="20" />)}
        <circle cx="60" cy="60" r="38" />
      </g>
      <g fill="#FFD977">
        {bumps.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="20" />)}
        <circle cx="60" cy="60" r="38" />
      </g>
      <g fill="#E8753F" opacity=".75"><circle cx="40" cy="34" r="2.6" /><circle cx="82" cy="38" r="2.2" /><circle cx="86" cy="78" r="2.6" /><circle cx="34" cy="82" r="2.2" /></g>
      <g className="eyes" fill="#593522"><ellipse cx="47" cy="58" rx="4.2" ry="5.4" /><ellipse cx="73" cy="58" rx="4.2" ry="5.4" /></g>
      <circle cx="38" cy="68" r="5" fill="#F28CB5" opacity=".7" /><circle cx="82" cy="68" r="5" fill="#F28CB5" opacity=".7" />
      <path d="M52 70q8 8 16 0" fill="none" stroke="#593522" strokeWidth="3.4" strokeLinecap="round" />
      {wave && <path className="wave" d="M104 50q10-8 12 2" fill="none" stroke="#593522" strokeWidth="4" strokeLinecap="round" />}
    </svg>
  )
}

export function Logo({ size = 34, bounce = false }) {
  const reduce = useReducedMotion()
  const el = (
    <span className="logo" style={{ fontSize: size }} aria-label="Bizcuits" role="img">
      {'Bizcuits'.split('').map((c, i) => <span key={i} className={i % 2 ? 'lp' : 'lo'} aria-hidden="true">{c}</span>)}
    </span>
  )
  if (!bounce || reduce) return el
  return <motion.span style={{ display: 'inline-block' }} initial={{ y: -40, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 11 }}>{el}</motion.span>
}

const PATHS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  box: 'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10',
  pen: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  chat: 'M4 5h16v11H9l-5 4z',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.5M18 14c2 .6 3 2.3 3 4',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  check: 'M4 12l5 5L20 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  plus: 'M12 5v14M5 12h14',
  book: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12',
  x: 'M6 6l12 12M18 6L6 18',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
}
export function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name]} /></svg>
}

export function useList(path) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const reload = useCallback(() => api(path).then((r) => { setRows(r); setError('') }).catch((e) => setError(e.message)), [path])
  useEffect(() => { reload() }, [reload])
  return { rows, reload, error }
}

export function Loading({ text = 'Working on it…' }) {
  return <div className="loading" role="status"><Mascot size={44} className="bounce-loop" /><span>{text}</span></div>
}

export function Empty({ title, hint, children }) {
  return (
    <div className="empty">
      <Mascot size={72} />
      <h3>{title}</h3>
      <p>{hint}</p>
      {children}
    </div>
  )
}

export function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export function Toast({ toast }) {
  return <div className="toast-wrap" aria-live="polite">{toast && <div className={`toast ${toast.kind}`}>{toast.kind === 'ok' && <Mascot size={26} className="bounce" />}{toast.text}</div>}</div>
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((text, kind = 'ok') => { setToast({ text, kind }); setTimeout(() => setToast(null), 3200) }, [])
  return [toast, show]
}

/** Editable AI result with copy + save. AI text is a suggestion; the user edits before saving. */
export const aiState = { source: 'ai' }

export function AiBox({ text, setText, onSave, saveLabel = 'Save', onRegenerate, notice }) {
  const [copied, setCopied] = useState(false)
  if (text == null) return null
  const copy = () => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="aibox">
      {notice && <p className="warn" role="alert">{notice}</p>}
      <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} aria-label="Generated text, editable" />
      <div className="row">
        {onRegenerate && <button className="btn ghost" onClick={onRegenerate}>Regenerate</button>}
        <button className="btn ghost" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        {onSave && <button className="btn primary" onClick={onSave}>{saveLabel}</button>}
      </div>
      <p className="hint">{aiState.source === 'template' ? 'Built from your saved details with a free built-in template (no AI connected). Edit it freely.' : 'Gemma wrote this as a suggestion. Check the facts before you use it.'}</p>
    </div>
  )
}

export async function runAi(path, body, show) {
  try { const r = await api(path, { method: 'POST', body }); if (r.source) aiState.source = r.source; return r } catch (e) { show(e.message, 'err'); return null }
}

/** Wordmark with the biscuit tucked against the final "s". Everything is sized in em, so it scales with `size`. */
export function BrandLogo({ size = 30, big = false, bounce = false }) {
  return (
    <span className={`brand ${big ? 'brand-xl' : ''}`} style={{ fontSize: size }}>
      <Logo size="1em" bounce={bounce} />
      <span className="brand-mascot" aria-hidden="true"><Mascot size="100%" /></span>
      <svg className="brand-ticks" viewBox="0 0 20 24" aria-hidden="true"><path d="M3 4l7-2M6 11l9-1M4 19l8 3" fill="none" stroke="#7450B8" strokeWidth="2.2" strokeLinecap="round" /></svg>
    </span>
  )
}

/**
 * Themed dropdown. Drop-in for <select>: pass <option> children, get onChange({ target: { value } }).
 * Follows the ARIA combobox + listbox pattern: arrow keys, Home/End, Enter/Space, Escape, type-to-find.
 */
export function Select({ value, onChange, children, disabled, style, className = '', ...aria }) {
  const opts = Children.toArray(children).filter(isValidElement).map((o) => {
    const label = Children.toArray(o.props.children).join('')
    return { value: o.props.value !== undefined ? String(o.props.value) : label, label }
  })
  const id = useId()
  const root = useRef(null), list = useRef(null), btn = useRef(null), buf = useRef({ s: '', t: 0 })
  const [open, setOpen] = useState(false)
  const current = Math.max(0, opts.findIndex((o) => o.value === String(value ?? '')))
  const [active, setActive] = useState(current)
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (!root.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])
  useEffect(() => { if (open) list.current?.children[active]?.scrollIntoView?.({ block: "nearest" }) }, [open, active])
  const show = () => { setActive(current); setOpen(true) }
  const choose = (i) => { if (opts[i]) onChange?.({ target: { value: opts[i].value } }); setOpen(false); btn.current?.focus() }
  const key = (e) => {
    const last = opts.length - 1
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(last) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1) {
      const now = Date.now(), b = buf.current
      b.s = now - b.t > 700 ? e.key.toLowerCase() : b.s + e.key.toLowerCase(); b.t = now
      const hit = opts.findIndex((o) => o.label.toLowerCase().startsWith(b.s))
      if (hit >= 0) setActive(hit)
    }
  }
  return (
    <div className={`sel ${className}`} style={style} ref={root}>
      <button type="button" ref={btn} className="sel-btn" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled} onClick={() => (open ? setOpen(false) : show())} onKeyDown={key} {...aria}>
        <span className="sel-val">{opts[current]?.label || '\u00a0'}</span>
        <svg className="sel-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg>
      </button>
      {open && (
        <ul className="sel-list" role="listbox" id={`${id}-list`} ref={list} tabIndex={-1}>
          {opts.map((o, i) => (
            <li key={o.value + i} id={`${id}-${i}`} role="option" aria-selected={i === current} className={i === active ? 'on' : ''}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(i) }}>
              <span>{o.label || '\u00a0'}</span>{i === current && <Icon name="check" size={15} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Themed confirmation dialog. `await ask(message, { title, ok, danger })` resolves true or false. */
let opener = null
export function ask(message, opts = {}) {
  return new Promise((resolve) => {
    if (!opener) return resolve(window.confirm(message))
    opener({ message, title: 'Please confirm', ok: 'OK', danger: false, ...opts, resolve })
  })
}

export function ConfirmHost() {
  const [req, setReq] = useState(null)
  const cancelRef = useRef(null), okRef = useRef(null)
  useEffect(() => { opener = setReq; return () => { opener = null } }, [])
  useEffect(() => { if (req) (req.danger ? cancelRef : okRef).current?.focus() }, [req])
  if (!req) return null
  const done = (v) => { req.resolve(v); setReq(null) }
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); done(false) }
    if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === cancelRef.current ? okRef : cancelRef).current.focus() }
  }
  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) done(false) }}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg" onKeyDown={onKey}>
        <h2 id="dlg-title">{req.title}</h2>
        <p id="dlg-msg" className="modal-msg">{req.message}</p>
        <div className="row end">
          <button ref={cancelRef} className="btn ghost" onClick={() => done(false)}>Cancel</button>
          <button ref={okRef} className={`btn ${req.danger ? 'danger-solid' : 'primary'}`} onClick={() => done(true)}>{req.ok}</button>
        </div>
      </div>
    </div>
  )
}
