import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight,
  Clock3, Coffee, Download, Flower2, Leaf, NotebookPen, Plus, RotateCcw, Sparkles, Trash2,
  WandSparkles, Wind, X,
} from 'lucide-react';

/**
 * NHỊP — Lịch trình cá nhân · Editorial / Zen
 * Toàn bộ giao diện, trạng thái, lưu trữ và bộ xếp lịch đều nằm trong App.jsx.
 * Cần React, lucide-react và Tailwind CSS. Không cần API hay máy chủ.
 * "Auto arrange" là thuật toán xếp lịch dựa trên quy tắc, không gọi mô hình AI.
 */

export const THEMES = {
  zen: {
    name: 'Zen & Earthy', short: 'Tĩnh tại', page: '#FDFCF8', panel: '#F8F5EF',
    text: '#2D2B2A', muted: '#84827F', line: '#EAE7E0', accent: '#B57E65',
    subtle: '#F1ECE4', academic: '#7A8B99', leadership: '#B57E65',
    research: '#889C76', art: '#D5BCA4', school: '#758CA0',
  },
  midnight: {
    name: 'Midnight Focus', short: 'Đêm tĩnh', page: '#121212', panel: '#1B1C21',
    text: '#E0E0E0', muted: '#A5A4AC', line: '#36373E', accent: '#87ABD5',
    subtle: '#262932', academic: '#87ABD5', leadership: '#B29BC8',
    research: '#88AFAB', art: '#CAA6BF', school: '#9AB5D4',
  },
  eclat: {
    name: 'Éclat / High Fashion', short: 'Éclat', page: '#FFFFFF', panel: '#FBF8F6',
    text: '#000000', muted: '#77706D', line: '#EAE3E1', accent: '#762B43',
    subtle: '#F8F0F1', academic: '#8A7B90', leadership: '#762B43',
    research: '#9B8773', art: '#BE9A57', school: '#7F8299',
  },
  botanical: {
    name: 'Botanical / Eco-Green', short: 'Thảo mộc', page: '#F4F7F4', panel: '#EAF1EA',
    text: '#1C331E', muted: '#748576', line: '#D9E4D8', accent: '#60855D',
    subtle: '#E4EEE3', academic: '#72949A', leadership: '#A38D73',
    research: '#638460', art: '#A7C17C', school: '#6F9690',
  },
  academia: {
    name: 'Academia / The Library', short: 'Thư viện', page: '#F5F2E9', panel: '#EEEAE0',
    text: '#2C3E50', muted: '#807F78', line: '#DED8CA', accent: '#617A94',
    subtle: '#E9E6DD', academic: '#617A94', leadership: '#B16E5A',
    research: '#788A79', art: '#B79D7A', school: '#677C96',
  },
  vado: {
    name: 'Sunrise Motion', short: 'Nắng mai', page: '#FAFAFA', panel: '#F0F2F5',
    text: '#111111', muted: '#74767B', line: '#E2E4E8', accent: '#ED874D',
    subtle: '#FFF1E6', academic: '#4E85CB', leadership: '#EC8955',
    research: '#68A58C', art: '#AF9BBA', school: '#528FC6',
  },
};

const GROUPS = [
  { id: 'academic', label: 'Học thuật & Ngôn ngữ', hint: 'IELTS · Tiếng Trung' },
  { id: 'school', label: 'Đi học', hint: 'Lặp vào cùng thứ trong 8 tuần' },
  { id: 'leadership', label: 'Lãnh đạo & Điều hành', hint: 'UISC · HanaLeatherSG · Houzz Uni' },
  { id: 'research', label: 'Nghiên cứu & Dự án', hint: 'EcoPlant · Agri-Spray' },
  { id: 'art', label: 'Nghệ thuật & Bản thân', hint: 'Piano · Guitar · Model' },
];
const STORAGE_KEY = 'nhip.smart-planner.v1';
const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
const REST_BUFFER = 15;
const SCHOOL_WEEKS = 8;
const MAX_SKILL_SESSIONS = 7;
const PRIORITY = { high: 0, normal: 1, low: 2 };
const inputBase = 'w-full min-w-0 rounded-none border-0 border-b bg-transparent pb-2 pt-2 text-[13px] outline-none transition-colors duration-300 focus:border-[var(--accent)]';
const displayDate = (d) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const shortDate = (d) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(d);
const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthHeading = (date) => new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(date);
const weekdayInitials = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Lưới tháng: bắt đầu thứ Hai, 35 hoặc 42 ô tùy tháng. */
export function getMonthGrid(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const count = Math.max(35, Math.ceil((offset + lastDay) / 7) * 7);
  return Array.from({ length: count }, (_, index) =>
    new Date(first.getFullYear(), first.getMonth(), 1 - offset + index, 12));
}

/** Thống kê công việc đã xếp theo từng ngày, chỉ tính tháng đang xem. */
export function summarizeMonth(tasks, month) {
  const monthKey = isoDate(new Date(month.getFullYear(), month.getMonth(), 1, 12)).slice(0, 7);
  const byDate = new Map();
  let total = 0;
  let approved = 0;
  let pending = 0;
  const occupied = new Set();
  for (const task of tasks) {
    if (!task || typeof task.date !== 'string') continue;
    if (!byDate.has(task.date)) byDate.set(task.date, []);
    byDate.get(task.date).push(task);
    if (task.date.startsWith(monthKey + '-')) {
      total++;
      occupied.add(task.date);
      if (task.status === 'approved') approved++;
      if (task.status === 'pending') pending++;
    }
  }
  for (const items of byDate.values()) items.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
  return { byDate, total, approved, pending, daysWithTasks: occupied.size };
}

const fromIso = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
/** Tạo ngày học cách nhau đúng 7 ngày, tính cả buổi đầu tiên. */
export function weeklyClassDates(date, weeks = SCHOOL_WEEKS) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error('Ngày bắt đầu không hợp lệ.');
  const first = fromIso(date);
  if (isoDate(first) !== date) throw new Error('Ngày bắt đầu không tồn tại.');
  return Array.from({ length: weeks }, (_, week) => {
    const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + week * 7, 12);
    return isoDate(day);
  });
}

/** Trả về trọn vẹn 8 buổi hoặc báo trùng, không bao giờ thêm từng phần. */
export function createWeeklyClassSeries(input, scheduledTasks, createId = makeId) {
  const dates = weeklyClassDates(input.date);
  const start = toMinutes(input.startTime);
  const end = toMinutes(input.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('Giờ bắt đầu hoặc kết thúc buổi học không hợp lệ.');
  }
  const overlap = dates.find((date) => scheduledTasks.some((task) =>
    task.date === date && start < toMinutes(task.endTime) && end > toMinutes(task.startTime)));
  if (overlap) {
    throw new Error(`Buổi học ngày ${overlap.split('-').reverse().join('/')} bị trùng giờ với lịch đã có. Chưa thêm buổi nào; hãy đổi ngày hoặc khung giờ.`);
  }
  const repeatGroupId = createId();
  return dates.map((date, index) => ({
    id: createId(), repeatGroupId, repeatIndex: index + 1, repeatTotal: SCHOOL_WEEKS,
    date, startTime: input.startTime, endTime: input.endTime,
    title: input.title, note: input.note || '', category: 'school', origin: 'fixed', status: 'approved',
  }));
}

/** Thứ Hai của tuần chứa ngày được chọn, không kéo dài sang tuần tiếp theo. */
export function startOfWeekKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey ?? '')) throw new Error('Ngày trong tuần không hợp lệ.');
  const day = fromIso(dateKey);
  if (isoDate(day) !== dateKey) throw new Error('Ngày trong tuần không tồn tại.');
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return isoDate(day);
}

/** Số buổi luyện tập được ghi vào Waiting List của duy nhất một tuần. */
export function createSkillSessions(input, createId = makeId) {
  const times = Number(input.timesPerWeek);
  const duration = Number(input.duration);
  if (!Number.isInteger(times) || times < 1 || times > MAX_SKILL_SESSIONS) {
    throw new Error('Số buổi luyện kỹ năng phải từ 1 đến 7 buổi mỗi tuần.');
  }
  if (!Number.isInteger(duration) || duration < 5 || duration > 600) {
    throw new Error('Thời lượng mỗi buổi phải từ 5 đến 600 phút.');
  }
  const weekStart = startOfWeekKey(input.date);
  const skillSeriesId = createId();
  return Array.from({ length: times }, (_, index) => ({
    id: createId(), title: input.title, note: input.note || '',
    category: input.category === 'school' ? 'academic' : input.category,
    estimatedDuration: duration, priority: input.priority,
    skillWeekStart: weekStart, skillSeriesId, skillIndex: index + 1, skillTotal: times,
  }));
}

const toMinutes = (value) => { if (!/^\d{2}:\d{2}$/.test(value ?? '')) return NaN; const [h, m] = value.split(':').map(Number); return h <= 23 && m <= 59 ? h * 60 + m : NaN; };
const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const rgba = (hex, opacity) => { const raw = hex.replace('#', ''); const n = Number.parseInt(raw, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`; };
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createExamples = () => {
  const date = isoDate(new Date());
  const fixedTasks = [
    { id: 'example-fixed-1', date, startTime: '09:00', endTime: '10:30', title: 'Nghiên cứu EcoPlant', category: 'research', origin: 'fixed', status: 'approved' },
    { id: 'example-fixed-2', date, startTime: '11:30', endTime: '12:30', title: 'Họp ban điều hành UISC', category: 'leadership', origin: 'fixed', status: 'approved' },
    { id: 'example-fixed-3', date, startTime: '17:00', endTime: '18:30', title: 'Lớp học trên trường', category: 'academic', origin: 'fixed', status: 'approved' },
  ];
  const floatingTasks = [
    { id: 'example-float-1', title: 'Ôn 30 từ vựng tiếng Trung', category: 'academic', estimatedDuration: 30, priority: 'high' },
    { id: 'example-float-2', title: 'Lên kế hoạch Agri-Spray', category: 'research', estimatedDuration: 90, priority: 'high' },
    { id: 'example-float-3', title: 'Luyện đàn Piano', category: 'art', estimatedDuration: 45, priority: 'normal' },
    { id: 'example-float-4', title: 'Đọc tài liệu nghiên cứu', category: 'academic', estimatedDuration: 60, priority: 'normal' },
  ];
  return { fixedTasks, floatingTasks, scheduledTasks: [...fixedTasks], futurePlans: [], currentTheme: 'zen' };
};
function readSaved() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.fixedTasks) && Array.isArray(parsed.floatingTasks) && Array.isArray(parsed.scheduledTasks)) {
        return { ...parsed, futurePlans: Array.isArray(parsed.futurePlans) ? parsed.futurePlans : [], currentTheme: THEMES[parsed.currentTheme] ? parsed.currentTheme : 'zen' };
      }
    }
  } catch { /* Không để lỗi trình duyệt chặn giao diện. */ }
  return createExamples();
}

/**
 * Bộ xếp lịch thuần túy để có thể kiểm thử độc lập.
 * - Không di chuyển sự kiện đã chốt hay gợi ý đang chờ duyệt.
 * - Ưu tiên việc quan trọng, sau đó theo thứ tự thêm.
 * - Ưu tiên đệm 15 phút hai phía; chỉ bỏ đệm khi không còn chỗ phù hợp.
 * - Việc chưa vừa vẫn nằm trong danh sách chờ.
 */
export function autoScheduleTasks(floatingTasks, scheduledTasks, selectedDate, start = DAY_START, end = DAY_END, buffer = REST_BUFFER) {
  const reserved = scheduledTasks
    .filter((item) => item.date === selectedDate)
    .map((item) => ({ start: toMinutes(item.startTime), end: toMinutes(item.endTime) }))
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start);

  const selectedWeek = startOfWeekKey(selectedDate);
  const reservedSkillGroups = new Set(scheduledTasks.filter((item) => item.date === selectedDate && item.skillSeriesId).map((item) => item.skillSeriesId));
  const ordered = floatingTasks
    .filter((item) => !item.skillWeekStart || item.skillWeekStart === selectedWeek)
    .sort((a, b) => (PRIORITY[a.priority] ?? 1) - (PRIORITY[b.priority] ?? 1));
  const placed = [];
  const placedIds = new Set();

  function nextSlot(duration, rest) {
    const blocks = [...reserved].sort((a, b) => a.start - b.start || a.end - b.end);
    let cursor = start;
    let hasPrevious = false;
    for (const block of blocks) {
      if (block.end <= start || block.start >= end) continue;
      const nextStart = Math.min(end, block.start);
      const candidate = cursor + (hasPrevious ? rest : 0);
      if (candidate + duration + rest <= nextStart) return candidate;
      cursor = Math.max(cursor, Math.min(end, block.end));
      hasPrevious = true;
    }
    const lastCandidate = cursor + (hasPrevious ? rest : 0);
    return lastCandidate + duration <= end ? lastCandidate : null;
  }

  for (const task of ordered) {
    if (task.skillSeriesId && reservedSkillGroups.has(task.skillSeriesId)) continue;
    const duration = Number(task.estimatedDuration);
    if (!Number.isInteger(duration) || duration <= 0 || duration > end - start) continue;
    let position = nextSlot(duration, buffer);
    if (position === null) position = nextSlot(duration, 0);
    if (position === null) continue;
    const next = {
      ...task, date: selectedDate, startTime: toTime(position),
      endTime: toTime(position + duration), origin: 'floating', status: 'pending',
    };
    placed.push(next);
    placedIds.add(task.id);
    if (task.skillSeriesId) reservedSkillGroups.add(task.skillSeriesId);
    reserved.push({ start: position, end: position + duration });
  }
  return { placed, remaining: floatingTasks.filter((task) => !placedIds.has(task.id)) };
}

/** Tìm chỗ cho các buổi kỹ năng trong DUY NHẤT tuần đã chọn, ưu tiên trải đều ngày. */
export function autoArrangeSkillWeek(floatingTasks, scheduledTasks, dayInWeek) {
  const start = startOfWeekKey(dayInWeek);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = fromIso(start);
    day.setDate(day.getDate() + index);
    return isoDate(day);
  });
  const eligible = floatingTasks
    .filter((task) => task.skillSeriesId && task.skillWeekStart === start)
    .sort((a, b) => (PRIORITY[a.priority] ?? 1) - (PRIORITY[b.priority] ?? 1) || a.skillIndex - b.skillIndex);
  const placed = [];
  const placedIds = new Set();
  for (const task of eligible) {
    const ideal = Math.round((task.skillIndex * 8 / (task.skillTotal + 1)) - 1);
    const dayOrder = weekDays
      .map((date, index) => ({ date, index }))
      .sort((a, b) => Math.abs(a.index - ideal) - Math.abs(b.index - ideal) || a.index - b.index);
    for (const candidate of dayOrder) {
      const result = autoScheduleTasks([task], [...scheduledTasks, ...placed], candidate.date);
      if (!result.placed.length) continue;
      placed.push(...result.placed);
      placedIds.add(task.id);
      break;
    }
  }
  return { placed, remaining: floatingTasks.filter((task) => !placedIds.has(task.id)) };
}

function buildTimeline(tasks) {
  const rows = [];
  const ordered = [...tasks].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  let cursor = DAY_START;
  for (const task of ordered) {
    const start = toMinutes(task.startTime);
    const end = toMinutes(task.endTime);
    const gapEnd = Math.min(start, DAY_END);
    if (gapEnd - cursor > 60) rows.push({ type: 'zen', start: cursor, end: gapEnd, key: `zen-${cursor}` });
    rows.push({ type: 'task', task, key: task.id });
    cursor = Math.max(cursor, end);
  }
  if (DAY_END - cursor > 60) rows.push({ type: 'zen', start: cursor, end: DAY_END, key: `zen-${cursor}` });
  return rows;
}

function MonthOverview({ month, selectedDate, onSelectDate, onMoveMonth, scheduledTasks, theme }) {
  const days = useMemo(() => getMonthGrid(month), [month]);
  const summary = useMemo(() => summarizeMonth(scheduledTasks, month), [scheduledTasks, month]);
  const today = isoDate(new Date());
  return <section className="mb-10 rounded-2xl border px-3 py-6 shadow-[0_14px_55px_-48px_rgba(25,25,25,.22)] sm:px-6 sm:py-7" style={{ borderColor: theme.line, backgroundColor: theme.panel }} aria-label="Lịch tổng quan tháng">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 px-1 sm:px-2">
      <div>
        <p className="text-[9px] uppercase tracking-[.22em]" style={{ color: theme.muted }}>Toàn cảnh tháng này</p>
        <h2 className="mt-2 font-serif text-[clamp(25px,3vw,35px)] capitalize tracking-[-.045em]" aria-label={`Lịch ${monthHeading(month)}`}>{monthHeading(month)}</h2>
        <p className="mt-2 text-[10px] leading-relaxed sm:text-[11px]" style={{ color: theme.muted }}>
          {summary.total} công việc · {summary.approved} đã chốt · {summary.pending} chờ duyệt · {summary.daysWithTasks} ngày có lịch
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onMoveMonth(-1)} aria-label="Tháng trước" className="grid h-9 w-9 place-items-center rounded-lg border transition-colors duration-300 hover:opacity-65" style={{ borderColor: theme.line }}><ChevronLeft size={16}/></button>
        <button type="button" onClick={() => onMoveMonth(1)} aria-label="Tháng tiếp theo" className="grid h-9 w-9 place-items-center rounded-lg border transition-colors duration-300 hover:opacity-65" style={{ borderColor: theme.line }}><ChevronRight size={16}/></button>
      </div>
    </div>
    <div className="grid grid-cols-7 gap-1 border-b pb-2 sm:gap-2" style={{ borderColor: theme.line }}>
      {weekdayInitials.map((day, index) => <div key={day} className="py-1 text-center text-[10px] font-medium" style={{ color: index > 4 ? theme.accent : theme.muted }}>{day}</div>)}
    </div>
    <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
      {days.map((date) => {
        const key = isoDate(date);
        const tasks = summary.byDate.get(key) ?? [];
        const approved = tasks.filter((task) => task.status === 'approved').length;
        const pending = tasks.length - approved;
        const outside = date.getMonth() !== month.getMonth();
        const chosen = key === selectedDate;
        const isToday = key === today;
        return <button key={key} type="button" onClick={() => onSelectDate(key)}
          aria-label={`Xem ngày ${shortDate(date)}/${date.getFullYear()}: ${tasks.length} công việc, ${pending} chờ duyệt`}
          aria-pressed={chosen} aria-current={isToday ? 'date' : undefined}
          className="group relative flex min-h-[70px] min-w-0 flex-col items-start rounded-lg border px-1.5 py-2 text-left transition-colors duration-300 hover:brightness-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-[110px] sm:px-2.5 sm:py-2.5"
          style={{ borderColor: chosen ? theme.accent : theme.line, backgroundColor: chosen ? rgba(theme.accent, .1) : theme.page, opacity: outside ? .48 : 1 }}>
          <div className="flex w-full items-start justify-between gap-0.5">
            <span className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-full font-serif text-[13px] sm:h-7 sm:w-7 sm:text-[15px]" style={{ backgroundColor: isToday ? theme.accent : 'transparent', color: isToday ? theme.page : theme.text }}>{date.getDate()}</span>
            {tasks.length > 0 && <span className="mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] tabular-nums sm:text-[10px]" style={{ color: theme.text, backgroundColor: theme.subtle }}>{tasks.length}</span>}
          </div>
          {tasks.length > 0 && <div className="mt-auto flex w-full min-w-0 flex-col gap-1 pt-1.5">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {approved > 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.research }} />}
              {pending > 0 && <span className="h-1.5 w-1.5 rounded-full border border-dashed" style={{ borderColor: theme.accent }} />}
              <span className="text-[9px] tabular-nums" style={{ color: theme.muted }}>{approved}/{tasks.length} đã chốt</span>
            </div>
            <span className="hidden truncate text-[10px] leading-relaxed md:block" style={{ color: theme.muted }}>{tasks[0]?.startTime} · {tasks[0]?.title}</span>
          </div>}
        </button>;
      })}
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[10px]" style={{ color: theme.muted }}>
      <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.research }}/>Đã chốt</span>
      <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full border border-dashed" style={{ borderColor: theme.accent }}/>Chờ duyệt</span>
      <span className="ml-auto">Chọn một ngày để xem dòng thời gian <ArrowRight size={12} className="inline" /></span>
    </div>
  </section>;
}

function GroupBadge({ category, theme }) {
  const group = GROUPS.find((item) => item.id === category) ?? GROUPS[0];
  const color = theme[category] ?? theme.accent;
  return <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ color, backgroundColor: rgba(color, .12) }}>
    <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: color }} />{group.label}
  </span>;
}

function TaskCard({ task, theme, onApprove, onRemove, onRequeue, onRemoveSeries, onEditNote }) {
  const pending = task.status === 'pending';
  const accent = theme[task.category] ?? theme.accent;
  return <div className="group grid grid-cols-[51px_12px_minmax(0,1fr)] gap-3 pb-4 sm:grid-cols-[70px_14px_minmax(0,1fr)] sm:gap-4">
    <time className="pt-4 text-right text-[11px] font-medium tabular-nums" style={{ color: theme.muted }}>{task.startTime}</time>
    <div className="relative z-10 flex justify-center pt-5"><span className="h-[8px] w-[8px] rounded-full ring-[5px]" style={{ backgroundColor: pending ? theme.page : accent, border: pending ? `1px solid ${theme.muted}` : 'none', '--tw-ring-color': theme.page }} /></div>
    <article className={`min-w-0 rounded-xl border px-4 py-4 transition-all duration-300 sm:px-5 ${pending ? 'border-dashed opacity-65' : 'shadow-[0_10px_35px_-28px_rgba(20,20,20,0.35)] hover:-translate-y-0.5'}`}
      style={{ borderColor: pending ? theme.muted : rgba(accent, .42), backgroundColor: pending ? 'transparent' : rgba(accent, .09) }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <GroupBadge category={task.category} theme={theme} />
        <div className="flex items-center gap-1.5">
          {pending ? <button type="button" aria-label={`Duyệt ${task.title}`} title="Duyệt công việc" onClick={() => onApprove(task.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-[var(--soft)]" style={{ borderColor: theme.line, color: theme.accent }}><Check size={15} /></button>
            : <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: theme.muted }}><CheckCheck size={13} /> Đã chốt</span>}
          <button type="button" onClick={() => onEditNote(task)} title="Xem hoặc sửa ghi chú" aria-label={`Ghi chú ${task.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--soft)]" style={{ color: theme.muted }}><NotebookPen size={14} /></button>
          {task.repeatGroupId && <button type="button" onClick={() => onRemoveSeries(task.repeatGroupId)} aria-label={`Xóa cả 8 buổi: ${task.title}`} title="Xóa toàn bộ chuỗi 8 buổi" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed transition-colors hover:bg-[var(--soft)]" style={{ color: theme.muted, borderColor: theme.line }}><Trash2 size={14} /></button>}
          {task.origin === 'floating' && <button type="button" onClick={() => onRequeue(task.id)} aria-label={`Trả lại danh sách chờ: ${task.title}`} title="Trả lại danh sách chờ" className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--soft)]" style={{ color: theme.muted }}><RotateCcw size={14} /></button>}
          <button type="button" onClick={() => onRemove(task.id)} aria-label={`Xóa ${task.title}`} title="Xóa công việc" className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--soft)]" style={{ color: theme.muted }}><Trash2 size={14} /></button>
        </div>
      </div>
      <h3 className="mt-3 text-[13px] font-medium leading-relaxed sm:text-[14px]" style={{ color: theme.text }}>{task.title}</h3>
      {task.note && <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed" style={{ color: theme.muted }}>{task.note}</p>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px]" style={{ color: theme.muted }}>
        <span className="inline-flex items-center gap-1.5 tabular-nums"><Clock3 size={12} /> {task.startTime} — {task.endTime}</span>
        <span>{task.skillSeriesId ? `Luyện kỹ năng · buổi ${task.skillIndex}/${task.skillTotal}` : task.repeatGroupId ? `Đi học · buổi ${task.repeatIndex}/${task.repeatTotal}` : pending ? 'Gợi ý · chờ duyệt' : task.origin === 'fixed' ? 'Lịch cố định' : 'Đã xếp tự động'}</span>
      </div>
    </article>
  </div>;
}

function ZenSpace({ row, theme }) {
  return <div className="relative grid min-h-[130px] grid-cols-[51px_12px_minmax(0,1fr)] items-center gap-3 py-5 sm:min-h-[150px] sm:grid-cols-[70px_14px_minmax(0,1fr)] sm:gap-4">
    <span className="text-right text-[10px] tabular-nums" style={{ color: theme.muted }}>{toTime(row.start)}</span>
    <div className="relative z-10 flex justify-center"><div className="-ml-0.5 flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: theme.page, color: theme.art }}><Wind size={17} strokeWidth={1.3} /></div></div>
    <div className="pl-4 sm:pl-9"><p className="text-[9px] uppercase tracking-[.24em]" style={{ color: theme.muted }}>Một khoảng không</p><p className="mt-2 font-serif text-[15px] italic sm:text-[18px]" style={{ color: theme.text }}>Tĩnh tâm một chút, nhé.</p><p className="mt-2 text-[10px]" style={{ color: theme.muted }}>{toTime(row.start)} – {toTime(row.end)} · {row.end - row.start} phút dành riêng cho mình</p></div>
  </div>;
}

export default function App() {
  const [initial] = useState(readSaved);
  const [fixedTasks, setFixedTasks] = useState(initial.fixedTasks);
  const [floatingTasks, setFloatingTasks] = useState(initial.floatingTasks);
  const [scheduledTasks, setScheduledTasks] = useState(initial.scheduledTasks);
  const [currentTheme, setCurrentTheme] = useState(initial.currentTheme);
  const [futurePlans, setFuturePlans] = useState(initial.futurePlans);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => { const now = new Date(); return isoDate(new Date(now.getFullYear(), now.getMonth(), 1, 12)); });
  const [arrangeFeedback, setArrangeFeedback] = useState('');
  const timelineRef = useRef(null);
  const [mode, setMode] = useState('floating');
  const [planDraft, setPlanDraft] = useState({ title: '', note: '', targetDate: '' });
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingNoteTask, setEditingNoteTask] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [draft, setDraft] = useState({ title: '', note: '', category: 'academic', duration: '45', timesPerWeek: '3', priority: 'normal', date: isoDate(new Date()), startTime: '09:00', endTime: '10:00' });
  const [message, setMessage] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [formFeedback, setFormFeedback] = useState(null);
  const theme = THEMES[currentTheme];
  const displayedMonth = useMemo(() => fromIso(visibleMonth), [visibleMonth]);
  const day = fromIso(selectedDate);
  const allToday = useMemo(() => scheduledTasks.filter((item) => item.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)), [scheduledTasks, selectedDate]);
  const timeline = useMemo(() => buildTimeline(allToday), [allToday]);
  const pendingCount = allToday.filter((item) => item.status === 'pending').length;
  const approvedCount = allToday.filter((item) => item.status === 'approved').length;

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ fixedTasks, floatingTasks, scheduledTasks, futurePlans, currentTheme })); setStorageError(false); }
    catch { setStorageError(true); }
  }, [fixedTasks, floatingTasks, scheduledTasks, futurePlans, currentTheme]);

  const say = (text, error = false) => { setMessage(text); setNoticeIsError(error); };
  const reportForm = (text, error = false) => {
    setFormFeedback({ text, error });
    say(text, error);
  };
  const selectDate = (key, scroll = false) => {
    const next = fromIso(key);
    setSelectedDate(key);
    setVisibleMonth(isoDate(new Date(next.getFullYear(), next.getMonth(), 1, 12)));
    setDraft((prev) => ({ ...prev, date: key }));
    if (scroll && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => timelineRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    }
  };
  const advanceDate = (delta) => { const next = fromIso(selectedDate); next.setDate(next.getDate() + delta); selectDate(isoDate(next)); };
  const moveMonth = (delta) => {
    const next = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + delta, 1, 12);
    const currentDay = fromIso(selectedDate).getDate();
    const cappedDay = Math.min(currentDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
    selectDate(isoDate(new Date(next.getFullYear(), next.getMonth(), cappedDay, 12)));
  };
  const updateDraft = (key, value) => { setFormFeedback(null); setDraft((prev) => ({ ...prev, [key]: value })); };
  function editNote(task) {
    setEditingNoteTask({ id: task.id, title: task.title, floating: !task.date });
    setNoteText(task.note || '');
  }
  function saveNote() {
    if (!editingNoteTask) return;
    const note = noteText.slice(0, 5000);
    if (editingNoteTask.floating) {
      setFloatingTasks((prev) => prev.map((task) => task.id === editingNoteTask.id ? { ...task, note } : task));
    } else {
      setScheduledTasks((prev) => prev.map((task) => task.id === editingNoteTask.id ? { ...task, note } : task));
      setFixedTasks((prev) => prev.map((task) => task.id === editingNoteTask.id ? { ...task, note } : task));
    }
    setEditingNoteTask(null);
    say('Đã lưu ghi chú công việc.');
  }
  function saveFuturePlan(event) {
    event.preventDefault();
    const title = planDraft.title.trim();
    if (!title) return;
    const details = { title, note: planDraft.note.slice(0, 5000), targetDate: planDraft.targetDate };
    if (editingPlan) {
      setFuturePlans((prev) => prev.map((plan) => plan.id === editingPlan ? { ...plan, ...details } : plan));
    } else {
      setFuturePlans((prev) => [...prev, { id: makeId(), ...details }]);
    }
    setPlanDraft({ title: '', note: '', targetDate: '' });
    setEditingPlan(null);
    say('Đã lưu dự định tương lai.');
  }
  function startEditPlan(plan) {
    setEditingPlan(plan.id);
    setPlanDraft({ title: plan.title, note: plan.note || '', targetDate: plan.targetDate || '' });
  }
  function downloadBackup() {
    try {
      const payload = { version: 2, exportedAt: new Date().toISOString(), fixedTasks, floatingTasks, scheduledTasks, futurePlans, currentTheme };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'nhip-sao-luu-' + isoDate(new Date()) + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      say('Đã tạo bản sao lịch và ghi chú. Hãy lưu tệp ở nơi an toàn.');
    } catch {
      say('Không thể tải bản sao trên trình duyệt này.', true);
    }
  }

  function addTask(event) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return reportForm('Hãy nhập tên công việc để thêm vào lịch.', true);
    if (mode === 'skill') {
      try {
        const skills = createSkillSessions({ ...draft, title });
        setFloatingTasks((prev) => [...prev, ...skills]);
        reportForm(`Đã tạo ${skills.length} buổi luyện kỹ năng trong tuần bắt đầu ${skills[0].skillWeekStart.split('-').reverse().join('/')}. Bấm Auto arrange tuần để xếp lịch.`);
        setDraft((prev) => ({ ...prev, title: '', note: '' }));
      } catch (error) { reportForm(error instanceof Error ? error.message : 'Lịch kỹ năng không hợp lệ.', true); }
      return;
    }
    if (mode === 'floating') {
      // Không dùng ràng buộc bước 5 phút của trình duyệt: người dùng có thể nhập 17, 23... phút.
      const estimatedDuration = draft.duration.trim() === '' ? NaN : Number(draft.duration);
      if (!Number.isInteger(estimatedDuration) || estimatedDuration < 5 || estimatedDuration > 600) {
        return reportForm('Hãy nhập thời lượng từ 5 đến 600 phút (ví dụ: 30, 45 hoặc 60).', true);
      }
      setFloatingTasks((prev) => [...prev, { id: makeId(), title, note: draft.note || '', category: draft.category, estimatedDuration, priority: draft.priority }]);
      reportForm(`Đã thêm “${title}” vào Waiting List. Chọn Auto arrange khi muốn xếp lịch.`);
    } else {
      if (draft.category === 'school') {
        try {
          const series = createWeeklyClassSeries({ ...draft, title }, scheduledTasks);
          setFixedTasks((prev) => [...prev, ...series]);
          setScheduledTasks((prev) => [...prev, ...series]);
          selectDate(draft.date);
          reportForm(`Đã thêm đủ 8 buổi “${title}” vào lịch, từ ${series[0].date.split('-').reverse().join('/')} đến ${series[7].date.split('-').reverse().join('/')}.`);
          setDraft((prev) => ({ ...prev, title: '', note: '' }));
        } catch (error) {
          reportForm(error instanceof Error ? error.message : 'Không thể thêm lịch học.', true);
        }
        return;
      }
      const start = toMinutes(draft.startTime);
      const end = toMinutes(draft.endTime);
      if (!draft.date || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return reportForm('Hãy kiểm tra ngày, giờ bắt đầu và giờ kết thúc.', true);
      }
      if (scheduledTasks.some((task) => task.date === draft.date && start < toMinutes(task.endTime) && end > toMinutes(task.startTime))) {
        return reportForm('Khoảng giờ này đã có công việc. Hãy chọn giờ khác.', true);
      }
      const item = { id: makeId(), date: draft.date, startTime: draft.startTime, endTime: draft.endTime, title, note: draft.note || '', category: draft.category, origin: 'fixed', status: 'approved' };
      setFixedTasks((prev) => [...prev, item]);
      setScheduledTasks((prev) => [...prev, item]);
      selectDate(draft.date);
      reportForm(`Đã cố định “${title}” vào lịch ngày ${draft.date}.`);
    }
    setDraft((prev) => ({ ...prev, title: '', note: '' }));
  }

  function handleAutoSchedule() {
    if (!floatingTasks.length) {
      const feedback = 'Chưa có việc linh hoạt. Hãy thêm một việc vào danh sách chờ trước.';
      setArrangeFeedback(feedback);
      return say(feedback, true);
    }
    const { placed, remaining } = autoScheduleTasks(floatingTasks, scheduledTasks, selectedDate);
    if (!placed.length) {
      const feedback = `Không tìm được khoảng trống cho ngày ${shortDate(day)} trong khung 08:00–22:00. Thử ngày khác hoặc giảm thời lượng.`;
      setArrangeFeedback(feedback);
      return say(feedback, true);
    }
    setScheduledTasks((prev) => [...prev, ...placed]);
    setFloatingTasks(remaining);
    const feedback = `Đã tự xếp ${placed.length} công việc vào ngày ${shortDate(day)}; ${remaining.length} việc vẫn trong danh sách chờ. Bấm dấu ✓ trên dòng thời gian để duyệt.`;
    setArrangeFeedback(feedback);
    say(feedback);
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => timelineRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    }
  }

  function arrangeSelectedWeek() {
    const result = autoArrangeSkillWeek(floatingTasks, scheduledTasks, selectedDate);
    if (!result.placed.length) {
      return say('Tuần đang chọn không còn buổi kỹ năng phù hợp để xếp. Hãy kiểm tra tuần hoặc thời lượng.', true);
    }
    setScheduledTasks((prev) => [...prev, ...result.placed]);
    setFloatingTasks(result.remaining);
    selectDate(result.placed[0].date, true);
    say(`Đã đề xuất ${result.placed.length} buổi luyện kỹ năng trong một tuần. Hãy duyệt từng buổi.`);
  }

  function approveTask(id) {
    setScheduledTasks((prev) => prev.map((item) => item.id === id ? { ...item, status: 'approved' } : item));
    say('Đã duyệt. Công việc được giữ cố định trong lịch.');
  }
  function removeScheduled(id) {
    const item = scheduledTasks.find((task) => task.id === id);
    setScheduledTasks((prev) => prev.filter((task) => task.id !== id));
    if (item?.origin === 'fixed') setFixedTasks((prev) => prev.filter((task) => task.id !== id));
    say('Đã xóa công việc khỏi lịch.');
  }
  function removeSeries(groupId) {
    const count = scheduledTasks.filter((task) => task.repeatGroupId === groupId).length;
    if (!count) return;
    if (!window.confirm(`Xóa toàn bộ ${count} buổi học còn trong lịch? Các buổi khác và công việc khác sẽ được giữ nguyên.`)) return;
    setScheduledTasks((prev) => prev.filter((task) => task.repeatGroupId !== groupId));
    setFixedTasks((prev) => prev.filter((task) => task.repeatGroupId !== groupId));
    say(`Đã xóa ${count} buổi học thuộc cùng một lịch.`);
  }
  function requeue(id) {
    const item = scheduledTasks.find((task) => task.id === id);
    if (!item || item.origin !== 'floating') return;
    const { date, startTime, endTime, origin, status, ...floating } = item;
    setScheduledTasks((prev) => prev.filter((task) => task.id !== id));
    setFloatingTasks((prev) => [...prev, floating]);
    say('Đã trả công việc về danh sách chờ.');
  }
  function removeFloating(id) { setFloatingTasks((prev) => prev.filter((item) => item.id !== id)); say('Đã xóa khỏi danh sách chờ.'); }
  function clearAll() {
    if (!window.confirm('Xóa toàn bộ lịch, danh sách chờ và gợi ý đã xếp? Thao tác này không thể hoàn tác.')) return;
    setFixedTasks([]); setFloatingTasks([]); setScheduledTasks([]); say('Đã làm trống lịch. Một trang giấy mới dành cho bạn.');
  }
  const commonStyles = { '--page': theme.page, '--panel': theme.panel, '--ink': theme.text, '--muted': theme.muted, '--line': theme.line, '--accent': theme.accent, '--soft': theme.subtle, color: theme.text, backgroundColor: theme.page };

  return <div className="min-h-screen font-sans antialiased transition-colors duration-500" style={commonStyles}>
    <div className="mx-auto max-w-[1530px] px-5 pb-16 pt-7 sm:px-9 lg:px-14 lg:pt-10">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b pb-6" style={{ borderColor: theme.line }}>
        <div className="flex items-center gap-3">
          <Flower2 size={26} strokeWidth={1.1} style={{ color: theme.research }} />
          <div><div className="font-serif text-[35px] leading-none tracking-[-.075em]">nhịp<span style={{ color: theme.accent }}>.</span></div><div className="mt-2 text-[9px] uppercase tracking-[.2em]" style={{ color: theme.muted }}>The art of living in rhythm</div></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="theme" className="text-[10px]" style={{ color: theme.muted }}>Không gian</label>
          <select id="theme" aria-label="Đổi giao diện" value={currentTheme} onChange={(e) => setCurrentTheme(e.target.value)} className="max-w-[210px] cursor-pointer rounded-lg border px-3 py-2.5 text-[11px] outline-none transition-colors duration-300" style={{ color: theme.text, backgroundColor: theme.panel, borderColor: theme.line }}>
            {Object.entries(THEMES).map(([key, option]) => <option key={key} value={key}>{option.name}</option>)}
          </select>
          <button type="button" onClick={() => selectDate(isoDate(new Date()))} className="rounded-lg border px-3 py-2.5 text-[11px] transition-colors duration-300 hover:opacity-70" style={{ borderColor: theme.line }}>Hôm nay</button>
        </div>
      </header>

      <section className="relative overflow-hidden py-10 md:py-14">
        <div className="relative z-10"><p className="flex items-center gap-2 text-[9px] uppercase tracking-[.25em]" style={{ color: theme.muted }}><Leaf size={12} /> A gentler way to plan</p>
          <h1 className="mt-5 max-w-[850px] font-serif text-[clamp(37px,4.9vw,69px)] font-normal leading-[1.14] tracking-[-.055em]">Một khoảng thở<br /><em style={{ color: theme.accent }}>giữa những lịch hẹn.</em></h1>
          <p className="mt-5 max-w-[650px] text-[12px] leading-[1.9]" style={{ color: theme.muted }}>Dành năng lượng cho những điều quan trọng. Phần sắp xếp, cứ để Nhịp giúp bạn.</p>
        </div>
        <span className="pointer-events-none absolute -bottom-8 right-2 hidden select-none font-serif text-[230px] leading-none opacity-[0.055] lg:block" aria-hidden="true">{String(day.getDate()).padStart(2, '0')}</span>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 border-b pb-8 sm:grid-cols-4" style={{ borderColor: theme.line }}>
        {[
          { label: 'Đã chốt hôm nay', value: String(approvedCount).padStart(2, '0') },
          { label: 'Đang chờ duyệt', value: String(pendingCount).padStart(2, '0') },
          { label: 'Đợi được sắp xếp', value: String(floatingTasks.length).padStart(2, '0') },
          { label: 'Khung giờ xếp lịch', value: '08–22' },
        ].map((info) => <div key={info.label} className="px-2 py-2 sm:px-5"><div className="font-serif text-[33px] leading-none tracking-[-.06em] sm:text-[39px]" style={{ color: theme.accent }}>{info.value}</div><p className="mt-3 text-[10px]" style={{ color: theme.muted }}>{info.label}</p></div>)}
      </div>

      <MonthOverview month={displayedMonth} selectedDate={selectedDate} onSelectDate={(key) => selectDate(key, true)} onMoveMonth={moveMonth} scheduledTasks={scheduledTasks} theme={theme} />

      <div className="grid grid-cols-1 items-start gap-9 lg:grid-cols-[minmax(315px,385px)_minmax(0,1fr)] lg:gap-14 xl:gap-20">
        <aside className="min-w-0 space-y-7 lg:sticky lg:top-7">
          <section className="rounded-2xl border px-5 py-6 sm:px-7" style={{ borderColor: theme.line, backgroundColor: theme.panel }}>
            <div className="mb-6 flex items-start justify-between gap-3"><div><p className="text-[9px] uppercase tracking-[.2em]" style={{ color: theme.muted }}>Ghi một điều cần làm</p><h2 className="mt-2 font-serif text-[27px] tracking-[-.045em]">Một dự định mới.</h2></div><Plus size={18} strokeWidth={1.5} style={{ color: theme.accent }} /></div>
            <div className="mb-5 flex rounded-lg p-1 text-[11px]" style={{ backgroundColor: theme.subtle }}>
              {[['floating', 'Linh hoạt'], ['fixed', 'Cố định giờ'], ['skill', 'Luyện kỹ năng']].map(([key, label]) => <button type="button" key={key} onClick={() => { setMode(key); if (key !== 'fixed' && draft.category === 'school') setDraft((prev) => ({ ...prev, category: 'academic' })); setFormFeedback(null); }} className="flex-1 rounded-md px-2 py-2.5 transition-colors duration-300" style={{ backgroundColor: mode === key ? theme.page : 'transparent', color: mode === key ? theme.text : theme.muted }}>{label}</button>)}
            </div>
            <form onSubmit={addTask} noValidate aria-label="Thêm công việc" className="space-y-5">
              <label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Tên công việc</span><input required maxLength={160} value={draft.title} onChange={(e) => updateDraft('title', e.target.value)} placeholder="Bạn muốn làm điều gì?" className={inputBase} style={{ color: theme.text, borderColor: theme.line }} /></label>
              <label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Nhóm</span><select value={draft.category} onChange={(e) => { updateDraft('category', e.target.value); if (e.target.value === 'school') setMode('fixed'); }} className={inputBase} style={{ color: theme.text, backgroundColor: theme.panel, borderColor: theme.line }}>{GROUPS.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label>
              <label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Ghi chú (không bắt buộc)</span><textarea maxLength={5000} rows={2} value={draft.note} onChange={(e) => updateDraft('note', e.target.value)} placeholder="Thông tin cần nhớ, mục tiêu, đường dẫn tài liệu..." className={inputBase + ' resize-y'} style={{ color: theme.text, borderColor: theme.line }} /></label>
              {mode === 'skill' ? <>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Số buổi trong tuần</span><input type="number" min="1" max="7" step="1" value={draft.timesPerWeek} onChange={(e) => updateDraft('timesPerWeek', e.target.value)} className={inputBase} style={{ color: theme.text, borderColor: theme.line }} /></label>
                  <label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Phút mỗi buổi</span><input type="number" min="5" max="600" step="1" value={draft.duration} onChange={(e) => updateDraft('duration', e.target.value)} className={inputBase} style={{ color: theme.text, borderColor: theme.line }} /></label>
                </div>
                <label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Chọn một ngày thuộc tuần muốn luyện tập</span><input type="date" value={draft.date} onChange={(e) => updateDraft('date', e.target.value)} className={inputBase} style={{ color: theme.text, borderColor: theme.line, colorScheme: currentTheme === 'midnight' ? 'dark' : 'light' }} /></label>
                <div className="rounded-lg border border-dashed px-4 py-3 text-[11px] leading-relaxed" style={{ borderColor: theme.line, color: theme.muted }}>
                  Chỉ tạo buổi luyện cho tuần đang chọn. Tuần sau có thể thay đổi số buổi hoặc lịch học tùy ý. Sử dụng “Auto arrange tuần” để tìm giờ trống trong 7 ngày.
                </div>
              </> : mode === 'floating' ? <div className="grid grid-cols-2 gap-4">
                <label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Ước tính (phút)</span><input type="number" min={5} max={600} step={1} required value={draft.duration} onChange={(e) => updateDraft('duration', e.target.value)} className={inputBase} style={{ color: theme.text, borderColor: theme.line }} /></label>
                <label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Ưu tiên</span><select value={draft.priority} onChange={(e) => updateDraft('priority', e.target.value)} className={inputBase} style={{ color: theme.text, backgroundColor: theme.panel, borderColor: theme.line }}><option value="high">Quan trọng</option><option value="normal">Bình thường</option><option value="low">Có thể để sau</option></select></label>
              </div> : <><label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Ngày thực hiện</span><input type="date" required value={draft.date} onChange={(e) => updateDraft('date', e.target.value)} className={inputBase} style={{ color: theme.text, borderColor: theme.line, colorScheme: currentTheme === 'midnight' ? 'dark' : 'light' }} /></label>
                <div className="grid grid-cols-2 gap-4"><label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Bắt đầu</span><input type="time" value={draft.startTime} onChange={(e) => updateDraft('startTime', e.target.value)} className={inputBase} style={{ color: theme.text, borderColor: theme.line, colorScheme: currentTheme === 'midnight' ? 'dark' : 'light' }} /></label><label className="block"><span className="text-[10px]" style={{ color: theme.muted }}>Kết thúc</span><input type="time" value={draft.endTime} onChange={(e) => updateDraft('endTime', e.target.value)} className={inputBase} style={{ color: theme.text, borderColor: theme.line, colorScheme: currentTheme === 'midnight' ? 'dark' : 'light' }} /></label></div>
                {draft.category === 'school' && <div className="rounded-lg border border-dashed px-4 py-3 text-[11px] leading-[1.9]" style={{ borderColor: theme.school, color: theme.text, backgroundColor: rgba(theme.school, .07) }}>
                  <p className="font-medium">Lịch học cố định · 8 tuần liên tiếp</p>
                  <p style={{ color: theme.muted }}>Chọn ngày học đầu tiên và khung giờ. Nhịp sẽ tạo đủ 8 buổi cùng thứ, cùng giờ; tự kiểm tra trùng lịch ở cả 8 tuần.</p>
                  <p className="mt-1 tabular-nums" style={{ color: theme.school }}>{draft.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? `${weeklyClassDates(draft.date)[0].split('-').reverse().join('/')} → ${weeklyClassDates(draft.date)[7].split('-').reverse().join('/')}` : 'Hãy chọn ngày bắt đầu hợp lệ.'}</p>
                </div>}
              </>}
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3.5 text-[12px] font-medium transition-opacity duration-300 hover:opacity-85" style={{ backgroundColor: theme.accent, color: currentTheme === 'midnight' || currentTheme === 'botanical' ? '#121212' : '#FFFFFF' }}><Plus size={16} /> {mode === 'skill' ? 'Thêm buổi luyện tuần này' : mode === 'floating' ? 'Thêm vào danh sách chờ' : draft.category === 'school' ? 'Thêm 8 buổi đi học' : 'Cố định vào lịch'} <ArrowRight size={14} /></button>
              {formFeedback && <p role={formFeedback.error ? 'alert' : 'status'} className="rounded-lg px-3 py-2.5 text-[11px] leading-relaxed" style={{ backgroundColor: rgba(formFeedback.error ? theme.leadership : theme.research, .1), color: formFeedback.error ? theme.leadership : theme.text }}>{formFeedback.text}</p>}
            </form>
          </section>

          <section className="rounded-2xl border px-5 py-6 sm:px-7" style={{ borderColor: theme.line }}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[9px] uppercase tracking-[.2em]" style={{ color: theme.muted }}>Waiting list</p><h2 className="mt-2 font-serif text-[26px] tracking-[-.04em]">Những việc đang đợi <span style={{ color: theme.accent }}>{floatingTasks.length.toString().padStart(2, '0')}</span></h2></div><Coffee size={18} strokeWidth={1.4} style={{ color: theme.art }} /></div>
            <div className="mt-5 max-h-[250px] space-y-1 overflow-y-auto pr-1">
              {floatingTasks.length ? floatingTasks.map((task) => <div key={task.id} className="flex items-center gap-3 border-b py-3 last:border-b-0" style={{ borderColor: theme.line }}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: theme[task.category] }} />
                <div className="min-w-0 flex-1"><p className="break-words text-[12px] leading-relaxed">{task.title}</p><p className="mt-1 text-[10px]" style={{ color: theme.muted }}>{task.estimatedDuration} phút · {task.priority === 'high' ? 'Ưu tiên cao' : task.priority === 'low' ? 'Có thể để sau' : 'Bình thường'}</p>
                  {task.skillWeekStart && <p className="mt-1 text-[10px]" style={{ color: theme.muted }}>Buổi {task.skillIndex}/{task.skillTotal} · tuần từ {task.skillWeekStart.split('-').reverse().join('/')}</p>}
                  {task.note && <p className="mt-1 whitespace-pre-wrap break-words text-[10px]" style={{ color: theme.muted }}>{task.note}</p>}
                </div>
                <button type="button" onClick={() => editNote(task)} aria-label={`Ghi chú ${task.title}`} title="Xem hoặc sửa ghi chú" className="rounded-md p-2 transition-colors hover:bg-[var(--soft)]" style={{ color: theme.muted }}><NotebookPen size={14}/></button>
                <button type="button" onClick={() => removeFloating(task.id)} className="rounded-md p-2 transition-colors hover:bg-[var(--soft)]" aria-label={`Xóa khỏi danh sách chờ: ${task.title}`} style={{ color: theme.muted }}><X size={14} /></button>
              </div>) : <p className="py-7 text-center font-serif text-[17px] italic" style={{ color: theme.muted }}>Mọi dự định đều đã có chỗ.</p>}
            </div>
            <button type="button" onClick={handleAutoSchedule} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3.5 text-[12px] font-medium transition-all duration-300 hover:-translate-y-0.5" style={{ borderColor: theme.accent, color: theme.accent, backgroundColor: rgba(theme.accent, .08) }}><Sparkles size={17} /> Auto arrange · Tự xếp lịch</button>
            <button type="button" onClick={arrangeSelectedWeek} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3.5 text-[12px] font-medium transition-colors duration-300 hover:opacity-70" style={{ borderColor: theme.line, color: theme.text }}><CalendarDays size={16} /> Auto arrange tuần · Luyện kỹ năng</button>
            {arrangeFeedback && <p aria-live="polite" className="mt-3 rounded-lg px-3 py-2.5 text-[11px] leading-[1.8]" style={{ color: theme.text, backgroundColor: theme.subtle }}>{arrangeFeedback}</p>}
            <p className="mt-3 text-[10px] leading-[1.8]" style={{ color: theme.muted }}>Ưu tiên công việc quan trọng, tránh trùng lịch và chừa 15 phút nghỉ khi có thể. Gợi ý sẽ chờ bạn duyệt.</p>
          </section>
          <button type="button" onClick={clearAll} className="inline-flex items-center gap-2 px-1 text-[10px] underline underline-offset-4 transition-opacity hover:opacity-60" style={{ color: theme.muted }}><Trash2 size={12} /> Làm trống toàn bộ lịch</button>
        </aside>

        <main ref={timelineRef} className="min-w-0 scroll-mt-6" aria-labelledby="timeline-heading">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: theme.line }}>
            <div><p className="text-[9px] uppercase tracking-[.2em]" style={{ color: theme.muted }}>Lịch trình / Daily flow</p><h2 id="timeline-heading" className="mt-3 font-serif text-[clamp(27px,3vw,43px)] capitalize tracking-[-.05em]">{displayDate(day)}</h2><p className="mt-3 text-[11px]" style={{ color: theme.muted }}>Có {approvedCount} việc đã chốt · {pendingCount} việc đang chờ duyệt</p></div>
            <div className="flex items-center gap-2"><button type="button" aria-label="Ngày trước" onClick={() => advanceDate(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--soft)]" style={{ borderColor: theme.line }}><ChevronLeft size={16} /></button><input type="date" aria-label="Chọn ngày xem lịch" value={selectedDate} onChange={(e) => e.target.value && selectDate(e.target.value)} className="min-w-0 max-w-[139px] rounded-lg border px-2 py-2 text-[11px]" style={{ backgroundColor: theme.panel, color: theme.text, borderColor: theme.line, colorScheme: currentTheme === 'midnight' ? 'dark' : 'light' }} /><button type="button" aria-label="Ngày tiếp theo" onClick={() => advanceDate(1)} className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--soft)]" style={{ borderColor: theme.line }}><ChevronRight size={16} /></button></div>
          </div>
          {message && <div role={noticeIsError ? 'alert' : 'status'} className="my-5 flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-[11px] leading-relaxed" style={{ borderColor: noticeIsError ? theme.leadership : theme.line, backgroundColor: theme.subtle }}><div className="flex items-start gap-2"><WandSparkles size={16} className="mt-0.5 shrink-0" style={{ color: theme.accent }} />{message}</div><button onClick={() => setMessage('')} aria-label="Đóng thông báo"><X size={15} /></button></div>}
          {storageError && <p role="alert" className="mt-4 text-[11px]" style={{ color: theme.leadership }}>Trình duyệt chưa lưu được dữ liệu. Thay đổi có thể mất khi tải lại trang.</p>}
          <div className="relative mt-8">
            <div className="pointer-events-none absolute bottom-8 left-[70px] top-6 w-px sm:left-[94px]" style={{ backgroundColor: theme.line }} aria-hidden="true" />
            {timeline.length ? timeline.map((row) => row.type === 'task' ? <TaskCard key={row.key} task={row.task} theme={theme} onApprove={approveTask} onRemove={removeScheduled} onRequeue={requeue} onRemoveSeries={removeSeries} onEditNote={editNote} /> : <ZenSpace key={row.key} row={row} theme={theme} />) : <div className="py-24 text-center"><Wind size={26} className="mx-auto" style={{ color: theme.art }} /><h3 className="mt-5 font-serif text-[25px] italic">Một trang ngày còn trắng.</h3><p className="mt-3 text-[12px]" style={{ color: theme.muted }}>Thêm một công việc hoặc chọn Auto arrange để bắt đầu.</p></div>}
          </div>
          <div className="mt-8 flex items-center gap-3 border-t pt-6 text-[11px]" style={{ borderColor: theme.line, color: theme.muted }}><Coffee size={15} /> Đủ đầy, nhưng không cần vội vàng.</div>
        </main>
      </div>
      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-[10px]" style={{ borderColor: theme.line, color: theme.muted }}><span className="inline-flex items-center gap-2"><Flower2 size={14} /> Nhịp — sống chậm giữa những điều quan trọng.</span><span>Gợi ý xếp lịch dựa trên quy tắc · Dữ liệu lưu trên thiết bị này</span></footer>
    </div>
  </div>;
}