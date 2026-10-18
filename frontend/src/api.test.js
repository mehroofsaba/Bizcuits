import { describe, it, expect } from 'vitest'
import { money, TONES, toCsv, esc, THEMES, toIcs } from './api.js'

describe('helpers', () => {
  it('formats money', () => { expect(money(18)).toBe('$18'); expect(money(null)).toBe('') })
  it('offers the five content tones', () => { expect(TONES).toContain('playful') })
  it('builds safe csv', () => { expect(toCsv([{ a: 'x"y', b: 1 }], ['a', 'b'])).toBe('a,b\n"x""y","1"') })
  it('escapes html', () => { expect(esc('<b>&')).toBe('&lt;b&gt;&amp;') })
  it('has four themes', () => { expect(Object.keys(THEMES)).toHaveLength(4) })
  it('builds a calendar file', () => { const s = toIcs([{ id: 1, kind: 'Caption', body: 'Hi, there', plan_date: '2026-11-01', platform: 'Instagram' }]); expect(s).toContain('DTSTART;VALUE=DATE:20261101'); expect(s).toContain('SUMMARY:Instagram: Caption'); expect(s).toContain('Hi\\, there') })
})
