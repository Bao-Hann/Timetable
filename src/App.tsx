import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ArrowDownToLine, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Flower2, Inbox, Leaf, Plus, RotateCcw, Upload, SlidersHorizontal, Sparkles, Sun, X } from 'lucide-react'
import MonthCalendar from './components/MonthCalendar'
import TaskForm from './components/TaskForm'
import Timeline from './components/Timeline'
import { addDays, approveTask, categories, createDemoTasks, createTask, dateKey, getNextWeek, loadTasks, parseBackup, parseDateKey, saveTasks, sortTasks, startOfWeek } from './lib/schedule'
import type { Category, Task, TaskInput } from './lib/schedule'

const monthNames = ['Một', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Mười Một', 'Mười Hai']
const shortDate = (date: Date) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date)
const weekday = (date: Date) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(date)
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 12)
interface Notice { message: string; deletedTask?: Task }

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Không đọc được nội dung tệp.'))
    reader.onerror = () => reject(new Error('Không đọc được tệp sao lưu.'))
    reader.readAsText(file, 'UTF-8')
  })
}

export default function App() {
  const [initial] = useState(() => loadTasks())
  const [today, setToday] = useState(() => dateKey(new Date()))
  const [isDemo, setIsDemo] = useState(!initial.hasSavedData && !initial.warning)
  const [tasks, setTasks] = useState<Task[]>(() => !initial.hasSavedData && !initial.warning ? createDemoTasks(new Date()) : initial.tasks)
  const [month, setMonth] = useState(() => monthStart(new Date()))
  const [selectedDate, setSelectedDate] = useState(today)
  const [view, setView] = useState<'month' | 'week'>('month')
  const [category, setCategory] = useState<Category | null>(null)
  const [pendingOnly, setPendingOnly] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [storageWarning, setStorageWarning] = useState(initial.warning)
  const [helpOpen, setHelpOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const detailRef = useRef<HTMLElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.deletedTask ? 9000 : 4500)
    return () => window.clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    const refresh = () => setToday(dateKey(new Date()))
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  function update(next: Task[], demo = isDemo) {
    setTasks(next)
    if (!demo && initial.canSave && !saveTasks(next)) setStorageWarning('Trình duyệt chưa lưu được thay đổi. Hãy tải bản sao để giữ lịch của bạn.')
  }
  function selectDate(key: string, scroll = false) {
    const date = parseDateKey(key)
    if (!date) return
    setSelectedDate(key)
    setMonth(monthStart(date))
    setFormOpen(false)
    setEditingTask(null)
    if (scroll) window.requestAnimationFrame(() => detailRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }))
  }
  function openForm(key = selectedDate, task: Task | null = null) {
    setSelectedDate(key)
    const date = parseDateKey(key)
    if (date) setMonth(monthStart(date))
    setEditingTask(task)
    setFormOpen(true)
  }
  function closeForm() {
    setFormOpen(false)
    setEditingTask(null)
    window.requestAnimationFrame(() => addRef.current?.focus())
  }
  function save(input: TaskInput, id?: string) {
    const created = createTask(input)
    const old = tasks.find(task => task.id === id)
    const nextTask = old ? { ...created, id: old.id, createdAt: old.createdAt } : created
    const next = old ? tasks.map(task => task.id === id ? nextTask : task) : [...(isDemo ? [] : tasks), nextTask]
    if (!old && isDemo) setIsDemo(false)
    update(next, Boolean(old && isDemo))
    setCategory(null)
    setPendingOnly(false)
    selectDate(input.date)
    setView('month')
    setNotice({ message: old ? 'Đã cập nhật. Công việc đang chờ duyệt.' : 'Đã thêm công việc vào lịch riêng, đang chờ duyệt.' })
    window.requestAnimationFrame(() => addRef.current?.focus())
  }
  function approve(id: string) {
    update(approveTask(tasks, id))
    setNotice({ message: isDemo ? 'Đã duyệt công việc trong lịch mẫu.' : 'Đã duyệt. Một kế hoạch chính thức của bạn.' })
  }
  function remove(task: Task) {
    update(tasks.filter(item => item.id !== task.id))
    setNotice({ message: 'Đã xóa công việc.', deletedTask: task })
  }
  function undoDelete() {
    if (!notice?.deletedTask) return
    update([...tasks.filter(task => task.id !== notice.deletedTask!.id), notice.deletedTask])
    setNotice({ message: 'Đã khôi phục công việc.' })
  }
  function startPersonal() {
    setIsDemo(false)
    update([], false)
    setCategory(null)
    setPendingOnly(false)
    setNotice({ message: 'Một trang mới cho những dự định của bạn.' })
    openForm(today)
  }
  function goToday() {
    const now = dateKey(new Date())
    setToday(now)
    selectDate(now)
  }
  function goNextWeek() {
    selectDate(dateKey(getNextWeek(new Date()).start))
    setView('week')
  }
  function move(direction: number) {
    if (view === 'week') selectDate(dateKey(addDays(parseDateKey(selectedDate)!, direction * 7)))
    else selectDate(dateKey(new Date(month.getFullYear(), month.getMonth() + direction, 1, 12)))
  }
  function download() {
    const blob = new Blob([JSON.stringify({ version: 1, tasks: sortTasks(tasks) }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nhip-${today}${isDemo ? '-mau' : ''}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice({ message: isDemo ? 'Đã tải bản sao lịch mẫu.' : 'Đã tải bản sao lịch của bạn.' })
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Tệp quá lớn (tối đa 10 MB). Lịch hiện tại vẫn được giữ nguyên.')
      }
      const imported = parseBackup(await readTextFile(file))
      if (!isDemo && tasks.length > 0 &&
          !window.confirm('Nhập bản sao sẽ thay thế toàn bộ lịch hiện có trên trình duyệt này. Bạn đã tải bản sao của lịch hiện tại chưa?')) {
        return
      }
      setIsDemo(false)
      update(imported, false)
      setCategory(null)
      setPendingOnly(false)
      setView('month')
      selectDate(imported[0]?.date ?? today)
      setImportError(null)
      setNotice({ message: `Đã nhập ${imported.length} công việc từ bản sao.` })
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Không thể đọc bản sao. Lịch hiện tại không thay đổi.')
    }
  }

  const selected = parseDateKey(selectedDate)!
  const weekStart = startOfWeek(selected)
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const weekEnd = addDays(weekStart, 6)
  const filtered = sortTasks(tasks.filter(task => (!category || task.category === category) && (!pendingOnly || task.status === 'pending')))
  const monthTasks = tasks.filter(task => task.date.startsWith(dateKey(month).slice(0, 7)))
  const pendingCount = tasks.filter(task => task.status === 'pending').length
  const detailTasks = filtered.filter(task => view === 'week' ? task.date >= dateKey(weekStart) && task.date <= dateKey(weekEnd) : task.date === selectedDate)
  const hasFilters = Boolean(category || pendingOnly)

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Đến lịch trình</a>
    <aside className="sidebar" aria-label="Điều hướng chính">
      <a className="brand" href="./" aria-label="Nhịp — trang chủ"><span className="brand-mark"><Flower2 size={26} strokeWidth={1.3} /></span><span>nhịp<span className="brand-dot">.</span></span></a>
      <div className="sidebar-caption">MỖI NGÀY, MỘT CHÚT Ý NGHĨA</div>
      <nav className="main-nav">
        <button className={!pendingOnly && view === 'month' ? 'nav-item active' : 'nav-item'} onClick={() => { setView('month'); setPendingOnly(false); setCategory(null) }}><CalendarDays size={18} /><span>Lịch của tôi</span><span className="nav-active-dot" /></button>
        <button className={pendingOnly ? 'nav-item active' : 'nav-item'} onClick={() => { setPendingOnly(!pendingOnly); setFormOpen(false) }} aria-pressed={pendingOnly}><Inbox size={18} /><span>Chờ duyệt</span><span className="nav-count">{pendingCount}</span></button>
        <button className={view === 'week' && !pendingOnly ? 'nav-item active' : 'nav-item'} onClick={() => { goNextWeek(); setPendingOnly(false) }}><ArrowUpRight size={18} /><span>Tuần tới</span></button>
      </nav>
      <div className="sidebar-categories"><p className="eyebrow">NHỮNG ĐIỀU BẠN QUAN TÂM</p>{categories.map(item => <button key={item.id} className={`category-nav ${category === item.id ? 'active' : ''}`} aria-pressed={category === item.id} onClick={() => setCategory(category === item.id ? null : item.id)}><span className="category-dot" style={{ background: item.color }} /><span>{item.label}</span><span className="category-count">{tasks.filter(task => task.category === item.id).length}</span></button>)}</div>
      <div className="sidebar-bottom"><div className="breathing-card"><div className="orbit-art" aria-hidden="true"><span /><span /><Leaf size={38} strokeWidth={.8} /></div><p>Chừa một chút<br /><em>khoảng thở.</em></p><span>Không phải ngày nào cũng cần kín lịch.</span></div><button className="help-button" onClick={() => setHelpOpen(!helpOpen)} aria-expanded={helpOpen}><CircleHelp size={16} /><span>Một chút hướng dẫn</span><ArrowUpRight size={14} /></button></div>
    </aside>
    <main id="main-content" className="workspace">
      <header className="page-header"><div><p className="eyebrow"><span className="tiny-sun" />KHÔNG GIAN CÁ NHÂN</p><h1>Lịch trình của bạn<span className="heading-period">.</span></h1><p className="page-subtitle">Một chút sắp xếp, nhiều khoảng thở hơn.</p></div><div className="header-right"><span className="today-label"><Sun size={17} strokeWidth={1.3} />{capital(weekday(parseDateKey(today)!))}, {shortDate(parseDateKey(today)!)}</span><button ref={addRef} className="primary-button add-task-button" onClick={() => openForm()} aria-label="Thêm công việc"><Plus size={17} /><span>Thêm công việc</span></button></div></header>
      {isDemo && <div className="demo-banner"><span><Sparkles size={15} /><strong>Một chút cảm hứng.</strong><span>Bạn đang xem lịch mẫu.</span></span><button onClick={startPersonal}>Tạo lịch của bạn <ArrowRight size={15} /></button></div>}
      {storageWarning && <div className="warning-banner" role="alert"><span>{storageWarning} Các thay đổi hiện được giữ trong phiên này.</span><button onClick={download}><ArrowDownToLine size={16} />Tải bản sao</button></div>}
      {importError && <div className="warning-banner" role="alert"><span>{importError}</span><button onClick={() => setImportError(null)}>Đóng</button></div>}
      {helpOpen && <div className="help-panel"><div><p className="eyebrow">LÊN KẾ HOẠCH THEO CÁCH CỦA BẠN</p><p>Chọn ngày để xem công việc theo giờ. Việc mới có viền nét đứt; bấm <Check size={14} /> <strong>Duyệt</strong> để xác nhận. Chỉnh sửa sẽ đưa việc về chờ duyệt. “Tuần tới” là thứ Hai đến Chủ nhật của tuần kế tiếp.</p><p>Lịch riêng được lưu trong trình duyệt đang dùng. Bạn có thể tải bản sao JSON từ nút ở cuối trang.</p></div><button className="icon-button" aria-label="Đóng hướng dẫn" onClick={() => setHelpOpen(false)}><X size={17} /></button></div>}
      <div className="overview-row"><p><span className="overview-number">{monthTasks.length.toString().padStart(2, '0')}</span> công việc trong tháng <span className="overview-separator">/</span><span className="pending-summary"><span />{monthTasks.filter(task => task.status === 'pending').length} chờ duyệt</span></p><div className="quick-links"><button onClick={() => { selectDate(dateKey(addDays(new Date(), 1)), true); setView('month') }}>Ngày mai<ArrowUpRight size={13} /></button><button onClick={goNextWeek}>Tuần tới<ArrowUpRight size={13} /></button></div></div>
      <div className="planner-layout">
        <section className="calendar-panel" aria-label="Lịch trình tổng quan">
          <div className="calendar-toolbar"><div className="month-title"><h2>{view === 'month' ? `Tháng ${monthNames[month.getMonth()]}` : 'Một tuần của bạn'}</h2><span className="year-label">{view === 'month' ? month.getFullYear() : `${shortDate(weekStart)} — ${shortDate(weekEnd)} · ${weekEnd.getFullYear()}`}</span></div><div className="calendar-controls"><button className="today-button" onClick={goToday}>Hôm nay</button><button className="icon-button" aria-label={view === 'month' ? 'Tháng trước' : 'Tuần trước'} onClick={() => move(-1)}><ChevronLeft size={18} /></button><button className="icon-button" aria-label={view === 'month' ? 'Tháng tiếp theo' : 'Tuần tiếp theo'} onClick={() => move(1)}><ChevronRight size={18} /></button></div></div>
          <div className="view-toolbar"><div className="view-switch" aria-label="Chế độ xem"><button className={view === 'month' ? 'active' : ''} aria-pressed={view === 'month'} onClick={() => setView('month')}>Tháng</button><button className={view === 'week' ? 'active' : ''} aria-pressed={view === 'week'} onClick={() => setView('week')}>Tuần</button></div><span className="calendar-hint"><SlidersHorizontal size={13} />{hasFilters ? 'Đang lọc công việc' : 'Mỗi việc, một khoảng riêng'}</span></div>
          <div className="mobile-categories">{categories.map(item => <button key={item.id} aria-pressed={category === item.id} className={category === item.id ? 'active' : ''} onClick={() => setCategory(category === item.id ? null : item.id)}><span className="category-dot" style={{ background: item.color }} />{item.label}</button>)}</div>
          {hasFilters && <div className="filter-summary"><span>{category && categories.find(item => item.id === category)?.label}{category && pendingOnly && ' · '}{pendingOnly && 'Chờ duyệt'}</span><button onClick={() => { setCategory(null); setPendingOnly(false) }}>Bỏ bộ lọc <X size={12} /></button></div>}
          {view === 'month' ? <MonthCalendar month={month} selectedDate={selectedDate} today={today} tasks={filtered} onSelect={key => selectDate(key, true)} onAdd={key => openForm(key)} /> : <div className="week-view"><div className="week-strip">{weekDays.map(day => { const key = dateKey(day); const count = filtered.filter(task => task.date === key).length; return <button key={key} className={`week-day ${key === selectedDate ? 'active' : ''} ${key === today ? 'today' : ''}`} aria-pressed={key === selectedDate} aria-label={`Xem ngày ${shortDate(day)}`} onClick={() => selectDate(key)}><span>{day.getDay() === 0 ? 'CN' : `T${day.getDay() + 1}`}</span><strong>{day.getDate()}</strong><span className="week-day-dots">{Array.from({ length: Math.min(count, 3) }, (_, i) => <i key={i} />)}</span></button> })}</div><div className="week-agenda">{weekDays.map(day => { const key = dateKey(day); const daily = filtered.filter(task => task.date === key); return <div className={`week-agenda-row ${key === selectedDate ? 'selected' : ''}`} key={key}><button className="week-agenda-date" onClick={() => selectDate(key)}><strong>{day.getDate().toString().padStart(2, '0')}</strong><span>{capital(weekday(day))}</span></button><div>{daily.length ? daily.map(task => <button className={`week-event category-${task.category} ${task.status === 'pending' ? 'is-pending' : ''}`} key={task.id} onClick={() => selectDate(key, true)}><time>{task.time}</time><span>{task.title}</span></button>) : <button className="week-empty" onClick={() => openForm(key)}>Một khoảng trống cho bạn <Plus size={13} /></button>}</div></div> })}</div></div>}
          <div className="calendar-footer"><div className="legend"><span><i className="legend-approved" />Chính thức</span><span><i className="legend-pending" />Chờ duyệt</span></div><span className="calendar-footer-note">Chọn một ngày để xem chi tiết <ArrowRight size={13} /></span></div>
        </section>
        <aside className="detail-panel" ref={detailRef} aria-label={formOpen ? 'Biểu mẫu công việc' : 'Timeline công việc'}>
          {formOpen ? <TaskForm key={`${editingTask?.id ?? 'new'}-${selectedDate}`} date={selectedDate} editingTask={editingTask} onSave={save} onCancel={closeForm} /> : <><div className="detail-eyebrow"><span className="eyebrow">{view === 'week' ? 'NHÌN VỀ PHÍA TRƯỚC' : selectedDate === today ? 'HÔM NAY CỦA BẠN' : 'MỘT NGÀY CỦA BẠN'}</span><span className="detail-count">{detailTasks.length} việc</span></div><div className="detail-date"><span>{selected.getDate().toString().padStart(2, '0')}</span><div><h3>{capital(weekday(selected))}</h3><p>Tháng {selected.getMonth() + 1}, {selected.getFullYear()}</p></div><Flower2 size={31} strokeWidth={1} /></div>{view === 'week' && <p className="week-range">Cả tuần · {shortDate(weekStart)} — {shortDate(weekEnd)}</p>}<div className="detail-rule" /><Timeline tasks={detailTasks} selectedDate={selectedDate} isWeek={view === 'week'} onApprove={approve} onEdit={task => openForm(task.date, task)} onDelete={remove} onAdd={() => openForm()} hasFilters={hasFilters} onClearFilters={() => { setCategory(null); setPendingOnly(false) }} /></>}
        </aside>
      </div>
      <footer className="page-footer"><span><span className="saved-dot" />{isDemo ? 'Lịch mẫu · để bạn khám phá' : storageWarning ? 'Lịch đang lưu tạm trong phiên này' : 'Lịch riêng · lưu trên trình duyệt này'}</span><span className="footer-signature">Less rush. More rhythm.</span><div className="backup-actions"><input ref={importRef} type="file" accept=".json,application/json" className="sr-only" aria-label="Nhập bản sao từ tệp JSON" onChange={importBackup} /><button onClick={() => importRef.current?.click()}><Upload size={14} />Nhập bản sao JSON</button><button onClick={download}><ArrowDownToLine size={14} />Tải bản sao JSON</button></div></footer>
    </main>
    {notice && <div className="toast" role="status"><span className="toast-icon"><Check size={15} /></span><span>{notice.message}</span>{notice.deletedTask && <button onClick={undoDelete}><RotateCcw size={13} />Hoàn tác</button>}<button aria-label="Đóng thông báo" onClick={() => setNotice(null)}><X size={14} /></button></div>}
  </div>
}
