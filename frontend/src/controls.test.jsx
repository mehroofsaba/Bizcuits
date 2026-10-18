// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { useState } from 'react'
import { Select, ConfirmHost, ask } from './ui.jsx'

afterEach(cleanup)

function Demo({ onPick }) {
  const [v, setV] = useState('')
  return <Select aria-label="Tone" value={v} onChange={(e) => { setV(e.target.value); onPick(e.target.value) }}>
    <option value="">Any</option><option value="friendly">Friendly</option><option value="playful">Playful</option><option value="elegant">Elegant</option>
  </Select>
}

describe('themed dropdown', () => {
  it('opens with the keyboard, moves with arrows, selects with Enter, closes with Escape', () => {
    const pick = vi.fn()
    render(<Demo onPick={pick} />)
    const box = screen.getByRole('combobox', { name: 'Tone' })
    expect(box.getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(box.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('option')).toHaveLength(4)
    fireEvent.keyDown(box, { key: 'ArrowDown' }); fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(pick).toHaveBeenCalledWith('playful')
    expect(box.getAttribute('aria-expanded')).toBe('false')
    expect(box.textContent).toContain('Playful')
    fireEvent.keyDown(box, { key: ' ' }); fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it('supports type-to-find, mouse selection and marks the chosen option', () => {
    const pick = vi.fn()
    render(<Demo onPick={pick} />)
    const box = screen.getByRole('combobox')
    fireEvent.keyDown(box, { key: 'Enter' }); fireEvent.keyDown(box, { key: 'e' }); fireEvent.keyDown(box, { key: 'Enter' })
    expect(pick).toHaveBeenCalledWith('elegant')
    fireEvent.click(box)
    expect(screen.getByRole('option', { selected: true }).textContent).toContain('Elegant')
    fireEvent.mouseDown(screen.getByRole('option', { name: /Friendly/ }))
    expect(pick).toHaveBeenLastCalledWith('friendly')
  })
})

describe('themed confirmation dialog', () => {
  it('resolves true on confirm, false on cancel and Escape', async () => {
    render(<ConfirmHost />)
    let p
    act(() => { p = ask('Delete it?', { title: 'Delete product', ok: 'Delete', danger: true }) })
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(document.activeElement.textContent).toBe('Cancel') // destructive actions focus Cancel first
    fireEvent.click(screen.getByText('Delete', { selector: 'button' }))
    expect(await p).toBe(true)
    act(() => { p = ask('Send?', { ok: 'Send' }) })
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(await p).toBe(false)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
