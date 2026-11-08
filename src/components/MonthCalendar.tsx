import { Plus } from 'lucide-react'
import { categories, dateKey, getMonthDays, type Task } from '../lib/schedule'

interface MonthCalendarProps {
  month: Date
  selectedDate: string
  today: string
  tasks: Task[]
  onSelect: (date: string) => void
  onAdd: (date: string) => void
}

const weekdays = [
  ['T2', 'Thứ Hai'],
  ['T3', 'Thứ Ba'],
  ['T4', 'Thứ Tư'],
  ['T5', 'Thứ Năm'],
  ['T6', 'Thứ Sáu'],
  ['T7', 'Thứ Bảy'],
  ['CN', 'Chủ nhật'],
]

const fullDate = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
})

export default function MonthCalendar({
  month, selectedDate, today, tasks, onSelect, onAdd,
}: MonthCalendarProps) {
  const days = getMonthDays(month)
  const tasksByDate = new Map<string, Task[]>()
  for (const task of tasks) {
    const dailyTasks = tasksByDate.get(task.date) ?? []
    dailyTasks.push(task)
    tasksByDate.set(task.date, dailyTasks)
  }
  for (const dailyTasks of tasksByDate.values()) {
    dailyTasks.sort((a, b) => a.time.localeCompare(b.time) || a.createdAt - b.createdAt)
  }

  return (
    <div className="month-calendar" aria-label="Lịch tổng quan tháng">
      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map(([short, full], index) => (
          <span key={short} className={index > 4 ? 'is-weekend' : undefined} title={full}>
            {short}
          </span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const key = dateKey(day)
          const dailyTasks = tasksByDate.get(key) ?? []
          const outside = day.getMonth() !== month.getMonth()
          const selected = key === selectedDate
          const current = key === today
          const label = fullDate.format(day)
          const classes = [
            'calendar-day',
            outside && 'is-outside',
            selected && 'is-selected',
            current && 'is-today',
          ].filter(Boolean).join(' ')

          return (
            <div className={classes} key={key}>
              <button
                type="button"
                className="calendar-day-content"
                aria-label={`Ngày ${label}, ${dailyTasks.length} công việc${current ? ', hôm nay' : ''}`}
                aria-pressed={selected}
                aria-current={current ? 'date' : undefined}
                onClick={() => onSelect(key)}
              >
                <span className="calendar-day-number">{day.getDate()}</span>
                <span className="calendar-events">
                  {dailyTasks.slice(0, 2).map((task) => (
                    <span
                      key={task.id}
                      className={`mini-event category-${task.category}${task.status === 'pending' ? ' is-pending' : ''}`}
                      title={`${task.time} · ${task.title} · ${categories.find((category) => category.id === task.category)?.label} · ${task.status === 'pending' ? 'Chờ duyệt' : 'Chính thức'}`}
                    >
                      <span className="event-dot" aria-hidden="true" />
                      <span className="mini-event-title">{task.title}</span>
                    </span>
                  ))}
                  {dailyTasks.length > 2 && (
                    <span className="calendar-more">+{dailyTasks.length - 2} việc khác</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className="calendar-add"
                aria-label={`Thêm công việc ngày ${label}`}
                onClick={() => onAdd(key)}
              >
                <Plus size={14} strokeWidth={1.5} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
