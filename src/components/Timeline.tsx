import { Check, CheckCheck, Clock3, Coffee, Leaf, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { categories, groupTasksByDate, parseDateKey } from '../lib/schedule'
import type { Task } from '../lib/schedule'

interface TimelineProps {
  tasks: Task[]
  selectedDate: string
  isWeek: boolean
  onApprove: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onAdd: () => void
  hasFilters: boolean
  onClearFilters: () => void
}

const dayFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long', day: '2-digit', month: '2-digit',
})

function dayLabel(value: string) {
  const date = parseDateKey(value)
  if (!date) return value
  const label = dayFormatter.format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function Timeline({
  tasks, selectedDate, isWeek, onApprove, onEdit, onDelete, onAdd,
  hasFilters, onClearFilters,
}: TimelineProps) {
  const groups = groupTasksByDate(tasks)

  return (
    <>
      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true"><Coffee size={29} strokeWidth={1} /></div>
          <h3>Một khoảng thảnh thơi.</h3>
          <p>{hasFilters
            ? 'Chưa có công việc phù hợp với bộ lọc trong khoảng thời gian này.'
            : isWeek
              ? 'Tuần này chưa có kế hoạch. Dành chỗ cho điều bạn muốn làm nhé.'
              : 'Ngày này chưa có kế hoạch. Một khởi đầu nhẹ nhàng cũng thật tốt.'}</p>
          <button type="button" className="text-button" onClick={hasFilters ? onClearFilters : onAdd}>
            {hasFilters ? 'Xem tất cả công việc' : 'Thêm một dự định'}<Plus size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="timeline" aria-label={isWeek ? 'Công việc trong tuần' : `Công việc ${dayLabel(selectedDate)}`}>
          {Array.from(groups, ([date, dailyTasks]) => (
            <section className="timeline-day" key={date} aria-label={`Công việc ${dayLabel(date)}`}>
              {isWeek && <h3 className="timeline-group-title">{dayLabel(date)}</h3>}
              {dailyTasks.map(task => {
                const category = categories.find(item => item.id === task.category)
                const pending = task.status === 'pending'
                return (
                  <article
                    key={task.id}
                    className={`timeline-item ${pending ? 'is-pending' : 'is-approved'}`}
                    aria-labelledby={`task-title-${task.id}`}
                  >
                    <div className="timeline-time">
                      <time dateTime={`${task.date}T${task.time}`}>{task.time}</time>
                      <span aria-hidden="true" />
                    </div>
                    <div className={`task-card category-${task.category}`}>
                      <div className="task-card-top">
                        <span className="task-category">
                          <span className="category-dot" style={{ backgroundColor: category?.color }} aria-hidden="true" />
                          {category?.label}
                        </span>
                        <div className="task-actions">
                          <button type="button" aria-label={`Sửa ${task.title}`} title="Chỉnh sửa" onClick={() => onEdit(task)}>
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                          <button type="button" aria-label={`Xóa ${task.title}`} title="Xóa công việc" onClick={() => onDelete(task)}>
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <h4 id={`task-title-${task.id}`}>{task.title}</h4>
                      <p className="task-duration"><Clock3 size={12} aria-hidden="true" />{task.time} — {task.endTime}</p>
                      {task.location && <p className="task-location"><MapPin size={12} aria-hidden="true" />{task.location}</p>}
                      {task.notes && <p className="task-notes">{task.notes}</p>}
                      <div className="task-card-bottom">
                        <span className="task-status">{pending
                          ? <><span className="pending-ring" aria-hidden="true" />Chờ duyệt</>
                          : <><CheckCheck size={13} aria-hidden="true" />Chính thức</>}</span>
                        {pending && <button type="button" className="approve-button" onClick={() => onApprove(task.id)} aria-label={`Duyệt ${task.title}`}>
                          <Check size={14} aria-hidden="true" />Duyệt
                        </button>}
                      </div>
                    </div>
                  </article>
                )
              })}
            </section>
          ))}
        </div>
      )}
      <button type="button" className="add-day-button" onClick={onAdd}><Plus size={15} aria-hidden="true" />Thêm công việc{!isWeek && tasks.length > 0 ? ' cho ngày này' : ''}</button>
      <div className="detail-footnote"><Leaf size={13} aria-hidden="true" />Làm từng việc, tận hưởng từng ngày.</div>
    </>
  )
}
