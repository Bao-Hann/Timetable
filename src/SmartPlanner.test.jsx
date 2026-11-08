import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import App, { THEMES, autoScheduleTasks } from './App.jsx'

const date = '2026-11-08'
const fixed = (id, startTime, endTime, day = date) => ({ id, date: day, startTime, endTime, origin: 'fixed', status: 'approved' })
const floating = (id, estimatedDuration = 30, priority = 'normal') => ({ id, title: id, category: 'academic', estimatedDuration, priority })

beforeEach(() => window.localStorage.clear())

describe('smart planner engine', () => {
  it('provides all six visual themes', () => {
    expect(Object.keys(THEMES)).toEqual(['zen', 'midnight', 'eclat', 'botanical', 'academia', 'vado'])
  })

  it('keeps approved and pending reservations intact, places tasks without overlaps', () => {
    const reserved = [fixed('class', '09:00', '11:00'), fixed('pending', '13:00', '14:00')]
    const items = [floating('first', 30, 'high'), floating('second', 75, 'normal'), floating('third', 45, 'low')]
    const { placed, remaining } = autoScheduleTasks(items, reserved, date)
    expect(placed).toHaveLength(3)
    expect(remaining).toHaveLength(0)
    expect(placed.map(x => x.status)).toEqual(['pending', 'pending', 'pending'])
    const sorted = [...reserved, ...placed].sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].startTime >= sorted[i-1].endTime).toBe(true)
  })

  it('leaves unschedulable tasks waiting and respects day boundaries', () => {
    const { placed, remaining } = autoScheduleTasks([floating('large', 90)], [fixed('busy', '08:00', '22:00')], date)
    expect(placed).toHaveLength(0)
    expect(remaining.map(x => x.id)).toEqual(['large'])
    expect(autoScheduleTasks([floating('short', 30)], [fixed('other', '08:00', '22:00', '2026-11-09')], date).placed[0].startTime).toBe('08:00')
  })

  it('uses a 15-minute break where possible', () => {
    const { placed } = autoScheduleTasks([floating('a', 30)], [fixed('before', '08:00', '09:00'), fixed('after', '11:00', '12:00')], date)
    expect(placed[0].startTime).toBe('09:15')
    expect(placed[0].endTime).toBe('09:45')
  })

  it('prioritizes important tasks before routine tasks', () => {
    const { placed } = autoScheduleTasks([floating('low', 45, 'low'), floating('urgent', 45, 'high')], [], date)
    expect(placed.map(x => x.id)).toEqual(['urgent', 'low'])
  })
})

describe('smart planner interface', () => {
  it('switches between themes and displays the awaiting list', () => {
    render(<App />)
    expect(screen.getByText('Một dự định mới.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /AI Magic/ })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Đổi giao diện'), { target: { value: 'midnight' } })
    expect(screen.getByLabelText('Đổi giao diện')).toHaveValue('midnight')
  })
})
