import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUpRight, Clock3, X } from 'lucide-react'
import { categories } from '../lib/schedule'
import type { Category, Task, TaskInput } from '../lib/schedule'

interface TaskFormProps {
  date: string
  editingTask?: Task | null
  onSave: (input: TaskInput, id?: string) => void
  onCancel: () => void
}

type FormErrors = Partial<Record<keyof TaskInput | 'form', string>>

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(2000, 0, 1, 12)
  parsed.setFullYear(year, month - 1, day)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)

export default function TaskForm({ date, editingTask, onSave, onCancel }: TaskFormProps) {
  const prefix = useId()
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(editingTask?.title ?? '')
  const [taskDate, setTaskDate] = useState(editingTask?.date ?? date)
  const [time, setTime] = useState(editingTask?.time ?? '09:00')
  const [endTime, setEndTime] = useState(editingTask?.endTime ?? '10:00')
  const [category, setCategory] = useState<Category>(editingTask?.category ?? 'study')
  const [location, setLocation] = useState(editingTask?.location ?? '')
  const [notes, setNotes] = useState(editingTask?.notes ?? '')
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => { titleRef.current?.focus() }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: FormErrors = {}
    if (!title.trim()) nextErrors.title = 'Đặt tên cho công việc của bạn nhé.'
    else if (title.trim().length > 160) nextErrors.title = 'Tên công việc cần tối đa 160 ký tự.'
    if (!isValidDate(taskDate)) nextErrors.date = 'Chọn một ngày hợp lệ.'
    if (!validTime(time)) nextErrors.time = 'Chọn giờ bắt đầu.'
    if (!validTime(endTime)) nextErrors.endTime = 'Chọn giờ kết thúc.'
    else if (validTime(time) && endTime <= time) nextErrors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    try {
      onSave({ title: title.trim(), date: taskDate, time, endTime, category, location: location.trim() || undefined, notes: notes.trim() || undefined }, editingTask?.id)
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Chưa lưu được công việc. Bạn thử lại nhé.' })
    }
  }

  const errorId = (field: string) => `${prefix}-${field}-error`

  return (
    <form className="task-form" aria-label={editingTask ? 'Chỉnh sửa công việc' : 'Tạo công việc'} onSubmit={handleSubmit} noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{editingTask ? 'ĐIỀU CHỈNH KẾ HOẠCH' : 'THÊM MỘT ĐIỀU Ý NGHĨA'}</p>
          <h2 className="mt-2 font-serif text-3xl">{editingTask ? 'Một chút thay đổi.' : 'Một dự định mới.'}</h2>
        </div>
        <button type="button" className="icon-button shrink-0" onClick={onCancel} aria-label="Đóng biểu mẫu"><X size={18} strokeWidth={1.5} /></button>
      </div>

      {!editingTask && <p className="form-intro mt-4 flex items-start gap-2 text-sm leading-relaxed"><Clock3 size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" />Công việc mới sẽ chờ bạn duyệt trước khi trở thành lịch chính thức.</p>}

      <div className="form-field">
        <label htmlFor={`${prefix}-title`}>Tên công việc <span className="sr-only">(bắt buộc)</span></label>
        <input ref={titleRef} id={`${prefix}-title`} name="title" value={title} onChange={event => setTitle(event.target.value)} placeholder="Bạn muốn dành thời gian cho điều gì?" maxLength={160} autoComplete="off" required aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? errorId('title') : undefined} />
        {errors.title && <p className="field-error" id={errorId('title')}>{errors.title}</p>}
      </div>

      <div className="form-field">
        <label htmlFor={`${prefix}-date`}>Ngày <span className="sr-only">(bắt buộc)</span></label>
        <input id={`${prefix}-date`} name="date" type="date" value={taskDate} onChange={event => setTaskDate(event.target.value)} required aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? errorId('date') : undefined} />
        {errors.date && <p className="field-error" id={errorId('date')}>{errors.date}</p>}
      </div>

      <div className="form-row grid grid-cols-2 gap-5">
        <div className="form-field">
          <label htmlFor={`${prefix}-time`}>Bắt đầu</label>
          <input id={`${prefix}-time`} name="time" type="time" value={time} onChange={event => setTime(event.target.value)} required aria-invalid={Boolean(errors.time)} aria-describedby={errors.time ? errorId('time') : undefined} />
          {errors.time && <p className="field-error" id={errorId('time')}>{errors.time}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${prefix}-endTime`}>Kết thúc</label>
          <input id={`${prefix}-endTime`} name="endTime" type="time" value={endTime} onChange={event => setEndTime(event.target.value)} required aria-invalid={Boolean(errors.endTime)} aria-describedby={errors.endTime ? errorId('endTime') : undefined} />
          {errors.endTime && <p className="field-error" id={errorId('endTime')}>{errors.endTime}</p>}
        </div>
      </div>

      <fieldset className="category-picker form-field">
        <legend>Nhóm công việc</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {categories.map(item => <label key={item.id} className={`category-option${category === item.id ? ' is-selected' : ''}`}>
            <input type="radio" name={`${prefix}-category`} value={item.id} checked={category === item.id} onChange={() => setCategory(item.id)} className="sr-only" />
            <span className="category-dot" style={{ backgroundColor: item.color }} aria-hidden="true" /><span>{item.label}</span>
          </label>)}
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor={`${prefix}-location`}>Địa điểm <span className="font-normal opacity-60">· tùy chọn</span></label>
        <input id={`${prefix}-location`} name="location" value={location} onChange={event => setLocation(event.target.value)} placeholder="Một nơi bạn muốn đến" maxLength={160} />
      </div>
      <div className="form-field">
        <label htmlFor={`${prefix}-notes`}>Ghi chú <span className="font-normal opacity-60">· tùy chọn</span></label>
        <textarea id={`${prefix}-notes`} name="notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Một vài điều cần nhớ…" maxLength={2000} rows={2} />
      </div>

      {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
      {Object.keys(errors).some(key => key !== 'form') && <p className="sr-only" role="alert">Kiểm tra lại các trường được đánh dấu.</p>}
      <div className="mt-7 flex items-center justify-between gap-4">
        <button type="button" className="secondary-button" onClick={onCancel}>Hủy</button>
        <button type="submit" className="primary-button">{editingTask ? 'Lưu thay đổi' : 'Thêm vào lịch'}<ArrowUpRight size={17} strokeWidth={1.5} /></button>
      </div>
    </form>
  )
}
