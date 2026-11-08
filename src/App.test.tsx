import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { STORAGE_KEY } from './lib/schedule'
import type { Task } from './lib/schedule'

const now = new Date(2026, 10, 8, 12)

function savedTasks(): Task[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!).tasks
}

function fixture(id: string, date: string, title: string): Task {
  return { id, date, title, time: '09:00', endTime: '10:00', category: 'study', status: 'approved', createdAt: 1 }
}

async function addTask(user: ReturnType<typeof userEvent.setup>, title: string, date?: string) {
  await user.click(screen.getAllByRole('button', { name: 'Thêm công việc' })[0])
  await user.type(screen.getByLabelText(/^Tên công việc/), title)
  if (date) fireEvent.change(within(screen.getByRole('form', { name: 'Tạo công việc' })).getByLabelText(/^Ngày/), { target: { value: date } })
  await user.click(screen.getByRole('button', { name: 'Thêm vào lịch' }))
}

beforeEach(() => {
  localStorage.clear()
  // Freeze the calendar date while leaving UI timers and user-event asynchronous.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('personal timetable flows', () => {
  it('opens the local current month and keeps demo interactions out of saved personal data', async () => {
    const user = userEvent.setup()
    const write = vi.spyOn(Storage.prototype, 'setItem')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Tháng Mười Một' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ngày 08\/11\/2026,/ })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByText('Bạn đang xem lịch mẫu.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ngày mai' }))
    await user.click(screen.getByRole('button', { name: 'Duyệt Cà phê cùng những ý tưởng mới' }))
    expect(within(screen.getByRole('article', { name: 'Cà phê cùng những ý tưởng mới' })).getByText('Chính thức')).toBeInTheDocument()
    expect(write).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('creates a pending personal task, approves it, and keeps approval after remount', async () => {
    const user = userEvent.setup()
    const firstVisit = render(<App />)
    await addTask(user, 'Viết bản kế hoạch tuần')

    expect(screen.queryByText('Bạn đang xem lịch mẫu.')).not.toBeInTheDocument()
    expect(savedTasks()).toHaveLength(1)
    expect(savedTasks()[0]).toMatchObject({ title: 'Viết bản kế hoạch tuần', date: '2026-11-08', status: 'pending' })
    expect(screen.getByRole('button', { name: 'Duyệt Viết bản kế hoạch tuần' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Duyệt Viết bản kế hoạch tuần' }))
    expect(savedTasks()[0].status).toBe('approved')
    firstVisit.unmount()
    render(<App />)

    expect(within(screen.getByRole('article', { name: 'Viết bản kế hoạch tuần' })).getByText('Chính thức')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Duyệt Viết bản kế hoạch tuần' })).not.toBeInTheDocument()
  })

  it('returns an edited approved task to pending and supports undoing deletion', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks: [fixture('existing', '2026-11-08', 'Ý tưởng ban đầu')] }))
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Sửa Ý tưởng ban đầu' }))
    await user.clear(screen.getByLabelText(/^Tên công việc/))
    await user.type(screen.getByLabelText(/^Tên công việc/), 'Ý tưởng đã điều chỉnh')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(savedTasks()).toHaveLength(1)
    expect(savedTasks()[0]).toMatchObject({ id: 'existing', title: 'Ý tưởng đã điều chỉnh', status: 'pending' })
    expect(screen.getByRole('button', { name: 'Duyệt Ý tưởng đã điều chỉnh' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xóa Ý tưởng đã điều chỉnh' }))
    expect(savedTasks()).toEqual([])
    expect(screen.queryByRole('article', { name: 'Ý tưởng đã điều chỉnh' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hoàn tác' }))
    expect(savedTasks()[0]).toMatchObject({ id: 'existing', title: 'Ý tưởng đã điều chỉnh', status: 'pending' })
    expect(screen.getByRole('article', { name: 'Ý tưởng đã điều chỉnh' })).toBeInTheDocument()
  })

  it('rejects a finishing time before the starting time without saving', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Thêm công việc' })[0])
    await user.type(screen.getByLabelText(/^Tên công việc/), 'Buổi học không hợp lệ')
    fireEvent.change(screen.getByLabelText('Bắt đầu'), { target: { value: '11:00' } })
    fireEvent.change(screen.getByLabelText('Kết thúc'), { target: { value: '10:00' } })
    await user.click(screen.getByRole('button', { name: 'Thêm vào lịch' }))

    expect(screen.getByText('Giờ kết thúc phải sau giờ bắt đầu.')).toBeInTheDocument()
    expect(screen.getByLabelText('Kết thúc')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('form', { name: 'Tạo công việc' })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('shows next calendar week Monday through Sunday and excludes the following Monday', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks: [
      fixture('monday', '2026-11-09', 'Kế hoạch thứ Hai'),
      fixture('sunday', '2026-11-15', 'Nghỉ ngơi Chủ nhật'),
      fixture('outside', '2026-11-16', 'Việc của tuần sau nữa'),
    ] }))
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Tuần tới' })[0])

    expect(screen.getByRole('heading', { name: 'Một tuần của bạn' })).toBeInTheDocument()
    expect(screen.getByText(/09[-/]11 — 15[-/]11 · 2026/)).toBeInTheDocument()
    const timeline = within(screen.getByRole('complementary', { name: 'Timeline công việc' }))
    expect(timeline.getByRole('article', { name: 'Kế hoạch thứ Hai' })).toBeInTheDocument()
    expect(timeline.getByRole('article', { name: 'Nghỉ ngơi Chủ nhật' })).toBeInTheDocument()
    expect(timeline.queryByRole('article', { name: 'Việc của tuần sau nữa' })).not.toBeInTheDocument()
  })

  it('opens the month and day of a newly created task outside the visible month', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addTask(user, 'Dự định tháng Mười Hai', '2026-12-02')

    expect(screen.getByRole('heading', { name: 'Tháng Mười Hai' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ngày 02\/12\/2026,/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('article', { name: 'Dự định tháng Mười Hai' })).toBeInTheDocument()
    expect(savedTasks()[0].date).toBe('2026-12-02')
  })


  it('restores tasks from a JSON backup and asks before replacing existing work', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks: [fixture('old', '2026-11-08', 'Việc cũ')] }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<App />)

    const fileContents = JSON.stringify({ version: 1, tasks: [
      fixture('restored', '2026-12-02', 'Việc đã sao lưu'),
    ] })
    const uploadInput = screen.getByLabelText('Nhập bản sao từ tệp JSON')
    await user.upload(uploadInput, new File([fileContents], 'nhip-backup.json', { type: 'application/json' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(savedTasks()[0].id).toBe('old')

    await user.upload(uploadInput, new File([fileContents], 'nhip-backup.json', { type: 'application/json' }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(savedTasks()[0].id).toBe('restored')
    expect(screen.getByRole('article', { name: 'Việc đã sao lưu' })).toBeInTheDocument()
  })

  it('shows an error and leaves the calendar untouched for an invalid JSON backup', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks: [fixture('old', '2026-11-08', 'Việc cũ')] }))
    render(<App />)
    await user.upload(screen.getByLabelText('Nhập bản sao từ tệp JSON'), new File(['{bad'], 'broken.json', { type: 'application/json' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Tệp JSON không đọc được')
    expect(savedTasks()[0].id).toBe('old')
  })

  it('preserves corrupted saved data while allowing clearly warned temporary work', async () => {
    const user = userEvent.setup()
    const original = '{ damaged personal calendar'
    localStorage.setItem(STORAGE_KEY, original)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent('Dữ liệu lịch đã lưu không hợp lệ')
    expect(screen.queryByText('Bạn đang xem lịch mẫu.')).not.toBeInTheDocument()
    await addTask(user, 'Công việc tạm trong phiên')

    expect(screen.getByRole('article', { name: 'Công việc tạm trong phiên' })).toBeInTheDocument()
    expect(screen.getByText('Lịch đang lưu tạm trong phiên này')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original)
    expect(write).not.toHaveBeenCalled()
  })
})
