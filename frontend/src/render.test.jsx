import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import Landing from './pages/Landing.jsx'
import Auth from './pages/Auth.jsx'
import Settings from './pages/Settings.jsx'
import { Mascot, Logo, Empty } from './ui.jsx'

describe('screens render', () => {
  it('landing follows the reference layout', () => {
    const html = renderToString(<Landing />)
    for (const t of ['Something for every', 'business thing.', 'Vademecum', 'Product Studio', 'Content Studio', 'Customer Replies', 'Feedback Insights', 'Sales Analytics', 'Task Manager', 'Features', 'Get started', 'Privacy &amp; data', '© Bizcuits']) expect(html).toContain(t)
    for (const gone of ['A little', 'minus the busywork', 'Sign in', 'Explore features', 'How it works', 'Made for', 'How the AI helps']) expect(html).not.toContain(gone)
    expect((html.match(/Get started/g) || []).length).toBe(1) // only the header button
    expect((html.match(/aria-label="Bizcuits"/g) || []).length).toBe(2) // small header logo + large hero wordmark
    expect(html).toContain('href="#/privacy"')
  })
  it('auth, settings and shared pieces render', () => {
    expect(renderToString(<Auth onAuth={() => {}} />)).toContain('Try the sample workspace')
    expect(renderToString(<Settings user={{ name: 'A', business: 'B', email: 'a@b.c' }} setUser={() => {}} theme="biscuit" setTheme={() => {}} logout={() => {}} />)).toContain('Grape Soda')
    expect(renderToString(<><Mascot /><Logo /><Empty title="x" hint="y" /></>)).toContain('Bizcuits')
  })
})

import Reset from './pages/Reset.jsx'
import Privacy from './pages/Privacy.jsx'
import Connections from './pages/Connections.jsx'
describe('new screens', () => {
  it('reset screens render', () => {
    expect(renderToString(<Reset />)).toContain('Send reset link')
    expect(renderToString(<Reset token="abc" />)).toContain('Choose a new password')
    expect(renderToString(<Connections />)).toContain('Connections')
  })
})

describe('privacy page', () => { it('renders its destination', () => { expect(renderToString(<Privacy />)).toContain('Your control') }) })

import { Select, ConfirmHost, BrandLogo } from './ui.jsx'
describe('shared controls', () => {
  it('themed dropdown is an accessible combobox that shows the selected label', () => {
    const html = renderToString(<Select value="b" aria-label="Pick"><option value="a">Apple</option><option value="b">Banana</option></Select>)
    expect(html).toContain('role="combobox"'); expect(html).toContain('aria-haspopup="listbox"'); expect(html).toContain('Banana'); expect(html).not.toContain('role="option"')
  })
  it('brand logo carries the mascot and the dialog host is idle', () => {
    expect(renderToString(<BrandLogo size={28} />)).toContain('brand-mascot')
    expect(renderToString(<ConfirmHost />)).toBe('')
  })
})
