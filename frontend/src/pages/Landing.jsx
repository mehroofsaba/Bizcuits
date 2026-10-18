import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { BrandLogo, Mascot, Icon } from '../ui.jsx'
import { REPO_URL } from '../config.js'

const FEATURES = [
  ['Product Studio', 'box', 'products', '#FFE4D8', 'var(--orange)'],
  ['Content Studio', 'pen', 'content', '#DDF2DC', '#2E9B57'],
  ['Customer Replies', 'chat', 'replies', '#E6DEFA', 'var(--grape)'],
  ['Feedback Insights', 'star', 'feedback', '#FFF0C4', '#E0A100'],
  ['Sales Analytics', 'chart', 'analytics', '#E6DEFA', 'var(--grape)'],
  ['Task Manager', 'check', 'tasks', '#FFE4D8', 'var(--orange)'],
]

// Soft bubbles around the edges. `at` is when each one pops in (seconds), `d` is its float period.
const BUBBLES = [
  { s: 190, c: 'var(--lav)', top: 110, left: -70, o: 0.45, d: 12, at: 0.15 },
  { s: 150, c: 'var(--peach)', top: 130, right: -60, o: 0.5, d: 14, at: 0.3 },
  { s: 34, c: 'var(--butter)', top: 60, left: '17%', o: 0.8, d: 9, at: 0.5 },
  { s: 26, c: 'var(--pink)', top: 330, right: '15%', o: 0.6, d: 11, at: 0.7 },
  { s: 46, c: 'var(--lav)', top: 400, left: '9%', o: 0.55, d: 13, at: 0.9 },
  { s: 54, c: 'var(--butter)', top: 250, right: '7%', o: 0.55, d: 10, at: 1.1 },
]

const LETTERS = 'Bizcuits'.split('')
const INTRO_MS = 2300 // the Vademecum section waits for the intro to finish before it plays

/** Words rise out of a mask, one after another. Layout is fixed, only transforms move. */
function Words({ text, delay, reduce }) {
  const words = text.split(' ')
  return (
    <span aria-hidden="true" style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', padding: '.06em 0 .16em', margin: '-.06em 0 -.16em' }}>
      {words.map((w, i) => (
        <span key={i} style={{ display: 'inline-block' }}>
          <motion.span
            style={{ display: 'inline-block' }}
            initial={reduce ? false : { y: '115%', rotate: 4 }}
            animate={{ y: 0, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 130, damping: 15, delay: delay + i * 0.12 }}
          >{w}</motion.span>
          {i < words.length - 1 && '\u00a0'}
        </span>
      ))}
    </span>
  )
}

export default function Landing() {
  const reduce = !!useReducedMotion()
  const vadeRef = useRef(null)
  const inView = useInView(vadeRef, { once: true, margin: '-40px' })
  const [introDone, setIntroDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), INTRO_MS)
    return () => clearTimeout(t)
  }, [])
  const showVade = reduce || (inView && introDone)

  // Scroll without changing the URL hash (the app listens to hash changes and would jump back to the top).
  const toFeatures = (e) => {
    e.preventDefault()
    document.getElementById('vademecum')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const btnTransition = 'background .15s, box-shadow .15s'
  const container = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } } }
  const card = { hidden: { opacity: 0, y: 30, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 170, damping: 15 } } }

  return (
    <div className="land">
      {/* 1. Header drops in first */}
      <motion.header className="container nav-top" initial={reduce ? false : { opacity: 0, y: -22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
        <a href="#/" style={{ textDecoration: 'none' }} aria-label="Bizcuits home"><BrandLogo size={30} /></a>
        <nav aria-label="Main">
          <motion.a className="btn purple sm" href="#vademecum" onClick={toFeatures} style={{ transition: btnTransition }}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.25 }}>Features</motion.a>
          <motion.a className="btn primary sm" href="#/app" style={{ transition: btnTransition }}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, boxShadow: ['0 4px 0 #C95A27, 0 0 0 0 rgba(232,117,63,.45)', '0 4px 0 #C95A27, 0 0 0 12px rgba(232,117,63,0)'] }}
            whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
            transition={{ opacity: { delay: 0.35 }, scale: { type: 'spring', stiffness: 260, damping: 14, delay: 0.35 }, boxShadow: { delay: 3.2, duration: 1.4, repeat: Infinity, repeatDelay: 1.6, ease: 'easeOut' } }}>Get started</motion.a>
        </nav>
      </motion.header>

      <section className="container hero">
        {/* 2. Bubbles pop in one by one, then drift gently */}
        {BUBBLES.map((b, i) => (
          <motion.span key={i} aria-hidden="true" style={{ position: 'absolute', zIndex: 0, pointerEvents: 'none', width: b.s, height: b.s, top: b.top, left: b.left, right: b.right }}
            initial={reduce ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 150, damping: 9, delay: b.at }}>
            <motion.span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: b.c, opacity: b.o }}
              animate={reduce ? undefined : { y: [0, -16, 0, 10, 0], x: [0, 8, 0, -8, 0] }}
              transition={{ duration: b.d, repeat: Infinity, ease: 'easeInOut', delay: b.at + 1 }} />
          </motion.span>
        ))}

        {/* 3. Wordmark: letters drop and bounce one by one, then the whole word pulses once */}
        <h1 className="hero-logo">
          <motion.span style={{ display: 'inline-block' }} animate={reduce ? undefined : { scale: [1, 1.05, 1] }} transition={{ delay: 1.5, duration: 0.7, ease: 'easeInOut' }}>
            <span className="brand brand-xl" style={{ fontSize: 'clamp(60px, 11vw, 150px)' }}>
              <span className="logo" style={{ fontSize: '1em' }} role="img" aria-label="Bizcuits">
                {LETTERS.map((c, i) => (
                  <motion.span key={i} className={i % 2 ? 'lp' : 'lo'} aria-hidden="true" style={{ display: 'inline-block', transformOrigin: '50% 90%' }}
                    initial={reduce ? false : { y: '-1.2em', opacity: 0, rotate: i % 2 ? 16 : -16, scaleX: 0.8, scaleY: 1.3 }}
                    animate={{ y: 0, opacity: 1, rotate: 0, scaleX: 1, scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 250, damping: 10, mass: 0.9, delay: 0.4 + i * 0.09 }}>{c}</motion.span>
                ))}
              </span>
              {/* 4. The biscuit pops out beside the final "s", then waves */}
              <span className="brand-mascot" aria-hidden="true" style={{ animation: 'none' }}>
                <motion.span style={{ display: 'block', width: '100%', height: '100%' }}
                  initial={reduce ? false : { scale: 0, rotate: -50, x: '-70%', opacity: 0 }} animate={{ scale: 1, rotate: 0, x: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 190, damping: 9, delay: 1.35 }}>
                  <Mascot size="100%" wave />
                </motion.span>
              </span>
              <svg className="brand-ticks" viewBox="0 0 20 24" aria-hidden="true">
                {['M3 4l7-2', 'M6 11l9-1', 'M4 19l8 3'].map((d, i) => (
                  <motion.path key={d} d={d} fill="none" stroke="#7450B8" strokeWidth="2.2" strokeLinecap="round"
                    initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.35, delay: 1.85 + i * 0.12 }} />
                ))}
              </svg>
            </span>
          </motion.span>
        </h1>

        {/* 5. Tagline rises out of a mask, word by word */}
        <p className="tagline display">
          <span className="sr">Something for every business thing.</span>
          <Words text="Something for every" delay={1.7} reduce={reduce} /><br />
          <em><Words text="business thing." delay={2.0} reduce={reduce} /></em>
        </p>
      </section>

      {/* 6. Vademecum plays after the intro, once it is on screen */}
      <section className="container sect" id="vademecum" ref={vadeRef}>
        <motion.h2 className="display vtitle" initial={reduce ? false : { opacity: 0, y: 26, scale: 0.9 }} animate={showVade ? { opacity: 1, y: 0, scale: 1 } : undefined}
          transition={{ type: 'spring', stiffness: 150, damping: 14 }}>Vademecum</motion.h2>
        <motion.div className="vade" variants={container} initial={reduce ? false : 'hidden'} animate={showVade ? 'show' : 'hidden'}>
          {FEATURES.map(([name, icon, to, bg, fg]) => (
            <motion.a className="fcard" key={name} href={`#/app/${to}`} variants={card} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} style={{ background: bg, transition: 'box-shadow .15s' }}>
              <span className="ftile" style={{ color: fg }}><Icon name={icon} size={26} /></span><span>{name}</span>
            </motion.a>
          ))}
        </motion.div>
      </section>

      <motion.footer className="container land-foot" initial={reduce ? false : { opacity: 0 }} animate={showVade ? { opacity: 1 } : undefined} transition={{ duration: 0.6, delay: 0.7 }}>
        <span className="copy">© Bizcuits</span>
        <span className="pills">
          <a className="pill" href="#/privacy"><Icon name="shield" size={15} />Privacy &amp; data</a>
          {REPO_URL && <a className="pill" href={REPO_URL} target="_blank" rel="noreferrer"><Icon name="github" size={15} />GitHub &amp; docs</a>}
        </span>
      </motion.footer>
    </div>
  )
}
