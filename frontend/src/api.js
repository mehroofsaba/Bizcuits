// Thin fetch wrapper. All data goes through the Flask API with the signed-in user's token.
export const getToken = () => localStorage.getItem('bz_token')
export const setSession = (token) => (token ? localStorage.setItem('bz_token', token) : localStorage.removeItem('bz_token'))

export async function api(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData
  const headers = isForm || !body ? {} : { 'Content-Type': 'application/json' }
  if (getToken()) headers.Authorization = 'Bearer ' + getToken()
  let res
  try {
    res = await fetch('/api' + path, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined })
  } catch {
    throw new Error('Cannot reach the server. On the free plan it may be waking up, so try again in a minute.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && data.auth) { setSession(null); if (location.hash.startsWith('#/app')) location.reload() }
    const err = new Error(data.error || 'Something went wrong. Try again.')
    err.data = data
    throw err
  }
  return data
}

export const money = (n) => (n == null || n === '' ? '' : '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }))
export const TONES = ['friendly', 'professional', 'playful', 'elegant', 'concise']

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
export function toCsv(rows, cols) {
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')
}
export function download(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click(); URL.revokeObjectURL(url)
}
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/** Printable menu page (opened in a new window, then printed or saved as PDF by the browser). */
export function printMenu(business, items) {
  const cats = [...new Set(items.map((i) => i.category || 'Other'))]
  const html = `<!doctype html><title>${esc(business)} menu</title><style>body{font-family:Georgia,serif;max-width:640px;margin:32px auto;color:#593522}h1{text-align:center}h2{border-bottom:2px solid #E8753F;padding-bottom:4px;margin-top:28px}.i{display:flex;justify-content:space-between;margin:10px 0}.i small{display:block;color:#8A6B58}</style><h1>${esc(business)}</h1>${cats.map((c) => `<h2>${esc(c)}</h2>${items.filter((i) => (i.category || 'Other') === c).map((i) => `<div class="i"><div><b>${esc(i.name)}</b><small>${esc(i.description)}${i.allergens ? ` · Allergens: ${esc(i.allergens)}` : ''}</small></div><b>${i.price != null ? money(i.price) : ''}</b></div>`).join('')}`).join('')}<script>onload=()=>print()</script>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

export const THEMES = { biscuit: 'Biscuit Shop', grape: 'Grape Soda', sticker: 'Sticker Club', peachy: 'Peachy Paper' }

/** Calendar file (.ics) for planned content, so it can be added to Google/Apple/Outlook calendars for free. */
export function toIcs(items) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const ev = items.filter((c) => c.plan_date).map((c) => {
    const d = c.plan_date.replace(/-/g, '')
    const next = new Date(c.plan_date + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + 1)
    const txt = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m)
    return ['BEGIN:VEVENT', `UID:bizcuits-${c.id}@bizcuits`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`,
      `SUMMARY:${txt([c.platform, c.kind].filter(Boolean).join(': '))}`, `DESCRIPTION:${txt(c.body)}`, 'END:VEVENT'].join('\r\n')
  })
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bizcuits//EN', ...ev, 'END:VCALENDAR'].join('\r\n')
}
