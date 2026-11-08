import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import App, { THEMES, AUTO_BLOCKED_PERIODS, reflowForFixedTasks, autoScheduleTasks, autoArrangeSkillWeek, createSkillSessions, startOfWeekKey, getMonthGrid, summarizeMonth, weeklyClassDates, createWeeklyClassSeries } from './App.jsx'

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
    expect(screen.getByRole('button', { name: /^Auto arrange · Tự xếp lịch$/ })).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: /^Auto arrange · Tự xếp lịch$/ }))
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

describe('eight-week recurring school lessons', () => {
  it('creates exactly eight same-weekday dates and handles year crossing', () => {
    expect(weeklyClassDates('2026-12-21')).toEqual([
      '2026-12-21', '2026-12-28', '2027-01-04', '2027-01-11',
      '2027-01-18', '2027-01-25', '2027-02-01', '2027-02-08',
    ])
    expect(() => weeklyClassDates('2026-02-30')).toThrow('Ngày bắt đầu không tồn tại')
  })

  it('creates a linked eight-lesson series on a fixed weekday', () => {
    let nextId = 0
    const input = { title: 'Toán cao cấp', date: '2026-11-09', startTime: '07:00', endTime: '09:00' }
    const series = createWeeklyClassSeries(input, [], () => String(++nextId))
    expect(series).toHaveLength(8)
    expect(new Set(series.map(x => x.repeatGroupId)).size).toBe(1)
    expect(new Set(series.map(x => x.id)).size).toBe(8)
    expect(series.map(x => x.repeatIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(series.map(x => x.category)).toEqual(Array(8).fill('school'))
    expect(series.every(x => x.startTime === '07:00' && x.endTime === '09:00' && x.status === 'approved')).toBe(true)
  })

  it('rejects the whole series if any of eight future dates has a conflicting task', () => {
    const input = { title: 'Tiếng Anh', date: '2026-11-09', startTime: '08:00', endTime: '10:00' }
    const reservations = [fixed('conflict', '09:00', '11:00', '2026-11-30')]
    expect(() => createWeeklyClassSeries(input, reservations, () => 'id')).toThrow('30/11/2026')
    expect(reservations).toHaveLength(1)
    expect(() => createWeeklyClassSeries({ ...input, startTime: '12:00', endTime: '11:00' }, [])).toThrow('không hợp lệ')
  })

  it('adds all eight lessons from the form and displays a confirmation', () => {
    render(<App />)
    const form = screen.getByRole('form', { name: 'Thêm công việc' })
    fireEvent.change(within(form).getByPlaceholderText('Bạn muốn làm điều gì?'), { target: { value: 'Lịch học môn Toán' } })
    fireEvent.change(within(form).getByLabelText('Nhóm'), { target: { value: 'school' } })
    expect(within(form).getByText('Lịch học cố định · 8 tuần liên tiếp')).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Ngày thực hiện'), { target: { value: '2027-03-08' } })
    fireEvent.change(within(form).getByLabelText('Bắt đầu'), { target: { value: '07:00' } })
    fireEvent.change(within(form).getByLabelText('Kết thúc'), { target: { value: '09:00' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Thêm 8 buổi đi học' }))
    expect(within(form).getByRole('status')).toHaveTextContent('Đã thêm đủ 8 buổi')
    const stored = JSON.parse(localStorage.getItem('nhip.smart-planner.v1'))
    expect(stored.scheduledTasks.filter(x => x.title === 'Lịch học môn Toán')).toHaveLength(8)
    expect(stored.fixedTasks.filter(x => x.title === 'Lịch học môn Toán')).toHaveLength(8)
  })

  it('shows an inline error and never adds partial lessons on conflict', () => {
    render(<App />)
    const form = screen.getByRole('form', { name: 'Thêm công việc' })
    fireEvent.change(within(form).getByPlaceholderText('Bạn muốn làm điều gì?'), { target: { value: 'Học thể dục' } })
    fireEvent.change(within(form).getByLabelText('Nhóm'), { target: { value: 'school' } })
    fireEvent.change(within(form).getByLabelText('Ngày thực hiện'), { target: { value: '2027-03-08' } })
    fireEvent.change(within(form).getByLabelText('Bắt đầu'), { target: { value: '07:00' } })
    fireEvent.change(within(form).getByLabelText('Kết thúc'), { target: { value: '09:00' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Thêm 8 buổi đi học' }))
    fireEvent.change(within(form).getByPlaceholderText('Bạn muốn làm điều gì?'), { target: { value: 'Học thể dục lần hai' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Thêm 8 buổi đi học' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('bị trùng giờ')
    const stored = JSON.parse(localStorage.getItem('nhip.smart-planner.v1'))
    expect(stored.scheduledTasks.filter(x => x.category === 'school')).toHaveLength(8)
  })

  it('can remove a whole linked series without affecting unrelated tasks', () => {
    const series = createWeeklyClassSeries({ title: 'Lớp 8 tuần', date: '2026-11-09', startTime: '07:00', endTime: '09:00' }, [], (() => { let i = 0; return () => String(++i) })())
    localStorage.setItem('nhip.smart-planner.v1', JSON.stringify({
      fixedTasks: series,
      floatingTasks: [],
      scheduledTasks: series,
      currentTheme: 'zen',
    }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)
    fireEvent.change(screen.getByLabelText('Chọn ngày xem lịch'), { target: { value: '2026-11-09' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xóa cả 8 buổi: Lớp 8 tuần' }))
    expect(confirm).toHaveBeenCalled()
    const stored = JSON.parse(localStorage.getItem('nhip.smart-planner.v1'))
    expect(stored.scheduledTasks.filter(x => x.category === 'school')).toHaveLength(0)
  })
})

describe('weekly skill practice and safe task edits', () => {
  it('creates only this week\'s requested number of skill sessions', () => {
    let id = 0
    const sessions = createSkillSessions({ title: 'Luyện đàn', note: 'Bài số 3', category: 'art', priority: 'normal',
      timesPerWeek: '3', duration: '35', date: '2026-11-11' }, () => String(++id))
    expect(sessions).toHaveLength(3)
    expect(sessions.every(task => task.skillWeekStart === '2026-11-09')).toBe(true)
    expect(sessions.map(task => task.skillIndex)).toEqual([1, 2, 3])
    expect(startOfWeekKey('2026-11-15')).toBe('2026-11-09')
    expect(startOfWeekKey('2026-11-16')).toBe('2026-11-16')
    expect(() => createSkillSessions({ timesPerWeek: 8, duration: 35, date: '2026-11-11' })).toThrow()
  })

  it('keeps arranged skill sessions inside selected week without colliding', () => {
    const items = createSkillSessions({ title: 'Luyện guitar', category: 'art', priority: 'high', timesPerWeek: 3,
      duration: 45, date: '2026-11-11' }, (() => { let i = 0; return () => String(++i) })())
    const { placed, remaining } = autoArrangeSkillWeek(items, [], '2026-11-11')
    expect(placed).toHaveLength(3)
    expect(remaining).toHaveLength(0)
    expect(new Set(placed.map(task => task.date)).size).toBe(3)
    expect(placed.every(task => task.date >= '2026-11-09' && task.date <= '2026-11-15' && task.status === 'pending')).toBe(true)
    expect(autoArrangeSkillWeek(items, [], '2026-11-16').placed).toHaveLength(0)
  })

  it('preserves old saved data when opening the enhanced planner', () => {
    const existing = fixed('old-event', '10:00', '12:00')
    existing.title = 'Công việc đã nhập'
    existing.category = 'academic'
    localStorage.setItem('nhip.smart-planner.v1', JSON.stringify({
      fixedTasks: [existing], floatingTasks: [], scheduledTasks: [existing], currentTheme: 'zen',
    }))
    render(<App />)
    fireEvent.change(screen.getByLabelText('Chọn ngày xem lịch'), { target: { value: date } })
    expect(screen.getByText('Công việc đã nhập')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dự định tương lai.' })).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem('nhip.smart-planner.v1'))
    expect(saved.scheduledTasks).toHaveLength(1)
    expect(saved.futurePlans).toEqual([])
  })

  it('edits existing fixed tasks, updates notes, and rejects overlapping hours', () => {
    const a = { ...fixed('edit-one', '10:00', '11:00'), title: 'Công việc cần sửa', category: 'academic', note: '' }
    const b = { ...fixed('edit-two', '13:00', '14:00'), title: 'Công việc khác', category: 'research' }
    localStorage.setItem('nhip.smart-planner.v1', JSON.stringify({
      fixedTasks: [a, b], floatingTasks: [], scheduledTasks: [a, b], currentTheme: 'zen'
    }))
    render(<App />)
    fireEvent.change(screen.getByLabelText('Chọn ngày xem lịch'), { target: { value: date } })
    fireEvent.click(screen.getByRole('button', { name: 'Sửa Công việc cần sửa' }))
    const dialog = screen.getByRole('dialog', { name: 'Sửa công việc' })
    fireEvent.change(within(dialog).getByLabelText('Tên công việc'), { target: { value: 'Công việc mới' } })
    fireEvent.change(within(dialog).getByLabelText('Ghi chú'), { target: { value: 'Đọc chương 4' } })
    fireEvent.change(within(dialog).getByLabelText('Bắt đầu'), { target: { value: '13:10' } })
    fireEvent.change(within(dialog).getByLabelText('Kết thúc'), { target: { value: '14:10' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('trùng')
    expect(screen.getByText('Công việc cần sửa')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Bắt đầu'), { target: { value: '11:30' } })
    fireEvent.change(within(dialog).getByLabelText('Kết thúc'), { target: { value: '12:30' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }))
    expect(screen.getByText('Công việc mới')).toBeInTheDocument()
    expect(screen.getByText('Đọc chương 4')).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem('nhip.smart-planner.v1'))
    expect(saved.fixedTasks.find(task => task.id === 'edit-one').startTime).toBe('11:30')
    expect(saved.scheduledTasks.find(task => task.id === 'edit-one').note).toBe('Đọc chương 4')
    expect(saved.scheduledTasks.find(task => task.id === 'edit-two').startTime).toBe('13:00')
  })

  it('edits waiting tasks and stores future plans without scheduling them', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Sửa Ôn 30 từ vựng tiếng Trung' }))
    const editor = screen.getByRole('dialog', { name: 'Sửa công việc' })
    fireEvent.change(within(editor).getByLabelText('Tên công việc'), { target: { value: 'Ôn từ vựng mới' } })
    fireEvent.change(within(editor).getByLabelText('Thời lượng (phút)'), { target: { value: '25' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Lưu thay đổi' }))
    expect(screen.getByText('Ôn từ vựng mới')).toBeInTheDocument()
    const board = screen.getByRole('region', { name: 'Dự định tương lai' })
    fireEvent.change(within(board).getByLabelText('Tên dự định'), { target: { value: 'Học vẽ' } })
    fireEvent.change(within(board).getByLabelText('Ghi chú dự định'), { target: { value: 'Dự định học mùa hè' } })
    fireEvent.click(within(board).getByRole('button', { name: 'Lưu ý tưởng' }))
    expect(within(board).getByText('Học vẽ')).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem('nhip.smart-planner.v1'))
    expect(saved.floatingTasks.find(t => t.title === 'Ôn từ vựng mới').estimatedDuration).toBe(25)
    expect(saved.futurePlans).toHaveLength(1)
    expect(saved.scheduledTasks.some(t => t.title === 'Học vẽ')).toBe(false)
  })
})

describe('daily protected hours and automatic adjustments', () => {
  const overlaps = (a, from, to) => a.startTime < to && a.endTime > from
  it('never arranges inside 12:00–14:00 or 17:00–19:00, even without existing tasks', () => {
    expect(AUTO_BLOCKED_PERIODS).toEqual([{ start: 720, end: 840 }, { start: 1020, end: 1140 }])
    const waiting = Array.from({ length: 12 }, (_, i) => floating('slot-' + i, 60))
    const result = autoScheduleTasks(waiting, [], date)
    expect(result.placed.length).toBeGreaterThan(0)
    for (const task of result.placed) {
      expect(overlaps(task, '12:00', '14:00')).toBe(false)
      expect(overlaps(task, '17:00', '19:00')).toBe(false)
    }
    expect(result.placed.length + result.remaining.length).toBe(waiting.length)
  })

  it('keeps a task in Waiting List when protected hours leave no adequate gap', () => {
    const reserved = [
      fixed('morning', '08:00', '12:00'),
      fixed('afternoon', '14:00', '17:00'),
      fixed('evening', '19:00', '22:00'),
    ]
    const result = autoScheduleTasks([floating('blocked', 30)], reserved, date)
    expect(result.placed).toHaveLength(0)
    expect(result.remaining.map(task => task.id)).toEqual(['blocked'])
  })

  it('automatically relocates overlapping suggested tasks after a new fixed event', () => {
    const auto = { ...floating('auto', 60), date, startTime: '09:00', endTime: '10:00', status: 'pending', origin: 'floating' }
    const fixedTask = fixed('class', '09:15', '10:45')
    const result = reflowForFixedTasks([auto], [], [fixedTask])
    expect(result.moved).toBe(1)
    expect(result.requeued).toBe(0)
    expect(result.scheduledTasks).toHaveLength(2)
    expect(result.scheduledTasks.find(x => x.id === 'auto').status).toBe('pending')
    const moved = result.scheduledTasks.find(x => x.id === 'auto')
    expect(overlaps(moved, '09:15', '10:45')).toBe(false)
    expect(overlaps(moved, '12:00', '14:00')).toBe(false)
    expect(overlaps(moved, '17:00', '19:00')).toBe(false)
  })

  it('preserves scheduled work not in conflict and all notes and approved statuses', () => {
    const kept = { ...floating('untouched', 30), origin: 'floating', date, startTime: '08:00', endTime: '08:30', status: 'approved', note: 'Important note' }
    const clashing = { ...floating('clashing', 45), origin: 'floating', date, startTime: '17:10', endTime: '17:55', status: 'approved', note: 'Practice' }
    const result = reflowForFixedTasks([kept, clashing], [], [fixed('new', '11:00', '12:00')])
    expect(result.scheduledTasks.find(x => x.id === 'untouched')).toEqual(kept)
    const second = result.scheduledTasks.find(x => x.id === 'clashing')
    expect(second.status).toBe('approved')
    expect(second.note).toBe('Practice')
    expect(overlaps(second, '17:00', '19:00')).toBe(false)
  })

  it('returns impossible work to Waiting List without losing id, title, note, and duration', () => {
    const old = { ...floating('needs-relocation', 90), title: 'Luyện nói', note: 'Bài số 2', origin: 'floating',
      date, startTime: '09:00', endTime: '10:30', status: 'pending' }
    const added = [
      fixed('a', '08:00', '12:00'), fixed('b', '14:00', '17:00'), fixed('c', '19:00', '22:00')
    ]
    const result = reflowForFixedTasks([old], [], added)
    expect(result.moved).toBe(0)
    expect(result.requeued).toBe(1)
    expect(result.scheduledTasks).toEqual(added)
    expect(result.floatingTasks[0]).toMatchObject({ id: old.id, title: 'Luyện nói', note: 'Bài số 2', estimatedDuration: 90 })
    expect(result.floatingTasks[0].date).toBeUndefined()
  })

  it('keeps unrelated dates unchanged when adding an eight-week series', () => {
    const existing = { ...floating('later', 45), origin: 'floating', date: '2027-02-01',
      startTime: '10:00', endTime: '10:45', status: 'pending' }
    const added = [fixed('now', '09:00', '10:00', date)]
    const result = reflowForFixedTasks([existing], [], added)
    expect(result.scheduledTasks).toContain(existing)
    expect(result.moved).toBe(0)
  })

  it('automatically fixes scheduled collisions when a user adds a fixed task via form', () => {
    const original = { ...floating('auto-existing', 60), title: 'Ôn kỹ năng', category: 'art',
      date: '2027-01-18', startTime: '09:00', endTime: '10:00', status: 'pending', origin: 'floating' }
    localStorage.setItem('nhip.smart-planner.v1', JSON.stringify({
      fixedTasks: [], floatingTasks: [], scheduledTasks: [original], futurePlans: [], currentTheme: 'zen',
    }))
    render(<App />)
    const form = screen.getByRole('form', { name: 'Thêm công việc' })
    fireEvent.click(within(form).getByRole('button', { name: 'Cố định giờ' }))
    fireEvent.change(within(form).getByPlaceholderText('Bạn muốn làm điều gì?'), { target: { value: 'Lịch cố định mới' } })
    fireEvent.change(within(form).getByLabelText('Ngày thực hiện'), { target: { value: '2027-01-18' } })
    fireEvent.change(within(form).getByLabelText('Bắt đầu'), { target: { value: '09:30' } })
    fireEvent.change(within(form).getByLabelText('Kết thúc'), { target: { value: '10:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Cố định vào lịch' }))
    const saved = JSON.parse(localStorage.getItem('nhip.smart-planner.v1'))
    const originalAfter = saved.scheduledTasks.find(x => x.id === original.id)
    expect(originalAfter).toBeDefined()
    expect(overlaps(originalAfter, '09:30', '10:30')).toBe(false)
    expect(saved.fixedTasks.some(x => x.title === 'Lịch cố định mới')).toBe(true)
  })
})
