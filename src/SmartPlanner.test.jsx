import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import App, { THEMES, autoScheduleTasks, getMonthGrid, summarizeMonth } from './App.jsx'

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
    expect(screen.getByRole('button', { name: /Auto arrange/ })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Đổi giao diện'), { target: { value: 'midnight' } })
    expect(screen.getByLabelText('Đổi giao diện')).toHaveValue('midnight')
  })
})

describe('monthly calendar and day drill-down', () => {
  it('creates a Monday-first month grid across month boundaries', () => {
    const grid = getMonthGrid(new Date(2026, 10, 1, 12))
    expect(grid).toHaveLength(42)
    expect(grid[0].getDay()).toBe(1)
    expect(grid[0].getDate()).toBe(26)
    expect(grid[41].getDate()).toBe(6)
  })

  it('counts each status and scheduled day without counting outside the selected month', () => {
    const summary = summarizeMonth([
      fixed('a', '08:00', '09:00'),
      { ...fixed('b', '10:00', '11:00'), status: 'pending' },
      fixed('other', '08:00', '09:00', '2026-12-01'),
    ], new Date(2026, 10, 1))
    expect(summary).toMatchObject({ total: 2, approved: 1, pending: 1, daysWithTasks: 1 })
    expect(summary.byDate.get(date)).toHaveLength(2)
  })

  it('opens selected calendar day and updates timeline', () => {
    render(<App />)
    const dateButton = screen.getByRole('button', { current: 'date' })
    fireEvent.click(dateButton)
    expect(dateButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 2, name: new RegExp(new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()), 'i') })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tháng tiếp theo' }))
    const next = new Date(); next.setMonth(next.getMonth() + 1)
    expect(screen.getByRole('heading', { name: new RegExp(new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(next), 'i') })).toBeInTheDocument()
  })

  it('shows clear Auto arrange feedback for unavailable tasks', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Auto arrange/ }))
    expect(screen.getAllByText(/Đã tự xếp|Không tìm được khoảng trống/).length).toBeGreaterThan(0)
  })
})

describe('waiting list input regression', () => {
  it('adds a floating task with a non-multiple-of-five duration and persists it', () => {
    render(<App />)
    const form = screen.getByRole('form', { name: 'Thêm công việc' })
    fireEvent.change(within(form).getByPlaceholderText('Bạn muốn làm điều gì?'), { target: { value: 'Luyện nói tiếng Trung' } })
    fireEvent.change(within(form).getByLabelText('Ước tính (phút)'), { target: { value: '17' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Thêm vào danh sách chờ' }))
    expect(screen.getByText('Luyện nói tiếng Trung')).toBeInTheDocument()
    expect(within(form).getByRole('status')).toHaveTextContent('Đã thêm')
    const stored = JSON.parse(localStorage.getItem('nhip.smart-planner.v1'))
    expect(stored.floatingTasks.some((item) => item.title === 'Luyện nói tiếng Trung' && item.estimatedDuration === 17)).toBe(true)
  })

  it('provides an inline error when duration is empty or invalid', () => {
    render(<App />)
    const form = screen.getByRole('form', { name: 'Thêm công việc' })
    fireEvent.change(within(form).getByPlaceholderText('Bạn muốn làm điều gì?'), { target: { value: 'Đọc sách' } })
    fireEvent.change(within(form).getByLabelText('Ước tính (phút)'), { target: { value: '' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Thêm vào danh sách chờ' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Hãy nhập thời lượng')
    expect(screen.queryByText('Đọc sách')).not.toBeInTheDocument()
  })
})
