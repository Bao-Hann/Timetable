export type Category = 'study' | 'club' | 'startup' | 'personal';
export type TaskStatus = 'pending' | 'approved';

export const categories: { id: Category; label: string; color: string }[] = [
  { id: 'study', label: 'Học tập', color: '#78917e' },
  { id: 'club', label: 'Câu lạc bộ', color: '#a093b1' },
  { id: 'startup', label: 'Khởi nghiệp', color: '#c3a17d' },
  { id: 'personal', label: 'Cá nhân', color: '#ba9095' },
];

export interface TaskInput {
  title: string;
  date: string;
  time: string;
  endTime: string;
  category: Category;
  notes?: string;
  location?: string;
}

export interface Task extends TaskInput {
  id: string;
  status: TaskStatus;
  createdAt: number;
}

export const STORAGE_KEY = 'nhip.timetable.v1';
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const pad = (value: number) => String(value).padStart(2, '0');

/** Calendar dates use local components, never UTC conversion. */
export function dateKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(2000, 0, 1, 12);
  date.setFullYear(year, month - 1, day);
  return dateKey(date) === value ? date : null;
}

/** Local noon avoids daylight-saving gaps around midnight. */
export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() + amount);
  return result;
}

export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** Next calendar week, Monday through Sunday inclusive. */
export function getNextWeek(today: Date): { start: Date; end: Date } {
  const start = addDays(startOfWeek(today), 7);
  return { start, end: addDays(start, 6) };
}

export function getMonthDays(month: Date): Date[] {
  const first = new Date(month);
  first.setHours(12, 0, 0, 0);
  first.setDate(1);
  const offset = (first.getDay() + 6) % 7;
  const last = new Date(first);
  last.setMonth(last.getMonth() + 1, 0);
  const count = Math.max(35, Math.ceil((offset + last.getDate()) / 7) * 7);
  const start = addDays(first, -offset);
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.time.localeCompare(b.time) ||
    a.createdAt - b.createdAt ||
    a.id.localeCompare(b.id),
  );
}

export function groupTasksByDate(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const task of sortTasks(tasks)) {
    const group = groups.get(task.date);
    if (group) group.push(task);
    else groups.set(task.date, [task]);
  }
  return groups;
}

function validateInput(input: TaskInput): void {
  if (typeof input.title !== 'string' || !input.title.trim()) {
    throw new Error('Bạn hãy nhập tên công việc.');
  }
  if (input.title.trim().length > 160) {
    throw new Error('Tên công việc cần ngắn hơn hoặc bằng 160 ký tự.');
  }
  if (typeof input.date !== 'string' || !parseDateKey(input.date)) {
    throw new Error('Bạn hãy chọn một ngày hợp lệ.');
  }
  if (typeof input.time !== 'string' || !timePattern.test(input.time) ||
      typeof input.endTime !== 'string' || !timePattern.test(input.endTime)) {
    throw new Error('Bạn hãy nhập giờ bắt đầu và kết thúc hợp lệ.');
  }
  if (input.endTime <= input.time) {
    throw new Error('Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.');
  }
  if (!categories.some(category => category.id === input.category)) {
    throw new Error('Bạn hãy chọn một nhóm công việc hợp lệ.');
  }
  if (input.notes !== undefined &&
      (typeof input.notes !== 'string' || input.notes.length > 2000)) {
    throw new Error('Ghi chú cần ngắn hơn hoặc bằng 2.000 ký tự.');
  }
  if (input.location !== undefined &&
      (typeof input.location !== 'string' || input.location.length > 200)) {
    throw new Error('Địa điểm cần ngắn hơn hoặc bằng 200 ký tự.');
  }
}

export function createTask(input: TaskInput): Task {
  validateInput(input);
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    endTime: input.endTime,
    category: input.category,
    notes: input.notes?.trim() || undefined,
    location: input.location?.trim() || undefined,
    status: 'pending',
    createdAt: Date.now(),
  };
}

export function approveTask(tasks: Task[], id: string): Task[] {
  return tasks.map(task => task.id === id && task.status === 'pending'
    ? { ...task, status: 'approved' }
    : task);
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const task = value as Task;
  if (typeof task.id !== 'string' || !task.id.trim() || task.id.length > 200 ||
      !['pending', 'approved'].includes(task.status) ||
      typeof task.createdAt !== 'number' || !Number.isFinite(task.createdAt) ||
      task.createdAt < 0) return false;
  try {
    validateInput(task);
    return true;
  } catch {
    return false;
  }
}

function validTasks(value: unknown): value is Task[] {
  if (!Array.isArray(value) || !value.every(isTask)) return false;
  return new Set(value.map(task => task.id)).size === value.length;
}

export interface LoadTasksResult {
  tasks: Task[];
  warning?: string;
  canSave: boolean;
  hasSavedData: boolean;
}

export function loadTasks(storage?: Pick<Storage, 'getItem'>): LoadTasksResult {
  let raw: string | null;
  try {
    raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
  } catch {
    return {
      tasks: [], canSave: false, hasSavedData: false,
      warning: 'Trình duyệt chưa cho phép lưu lịch. Công việc sẽ chỉ được giữ trong phiên này.',
    };
  }
  if (raw === null) return { tasks: [], canSave: true, hasSavedData: false };
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    const envelope = data as { version?: unknown; tasks?: unknown };
    if (envelope.version !== 1 || !validTasks(envelope.tasks)) throw new Error();
    return { tasks: sortTasks(envelope.tasks), canSave: true, hasSavedData: true };
  } catch {
    return {
      tasks: [], canSave: false, hasSavedData: true,
      warning: 'Dữ liệu lịch đã lưu không hợp lệ. Bản gốc được giữ nguyên và chưa bị ghi đè.',
    };
  }
}

export function saveTasks(tasks: Task[], storage?: Pick<Storage, 'setItem'>): boolean {
  if (!validTasks(tasks)) return false;
  try {
    (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks }));
    return true;
  } catch {
    return false;
  }
}

/** Only for the explicitly labelled, in-memory first-visit preview. */
export function createDemoTasks(today: Date): Task[] {
  const nextWeek = getNextWeek(today).start;
  const entries: (TaskInput & { status: TaskStatus })[] = [
    { title: 'Một khoảng lặng cho bản thân', date: dateKey(today), time: '07:00', endTime: '07:30', category: 'personal', status: 'approved', notes: 'Đọc vài trang sách, viết đôi dòng trước khi bắt đầu ngày mới.' },
    { title: 'Ôn tập & ghi chú ý tưởng', date: dateKey(today), time: '09:00', endTime: '10:30', category: 'study', status: 'approved', location: 'Góc học tập' },
    { title: 'Cà phê cùng những ý tưởng mới', date: dateKey(addDays(today, 1)), time: '14:00', endTime: '15:00', category: 'startup', status: 'pending', location: 'Quán cà phê quen' },
    { title: 'Lên kế hoạch dự án nhỏ', date: dateKey(addDays(nextWeek, 1)), time: '09:30', endTime: '11:00', category: 'startup', status: 'approved' },
    { title: 'Gặp gỡ câu lạc bộ', date: dateKey(addDays(nextWeek, 2)), time: '17:30', endTime: '19:00', category: 'club', status: 'pending', location: 'Không gian sinh hoạt chung' },
    { title: 'Học một điều mới', date: dateKey(addDays(nextWeek, 4)), time: '08:30', endTime: '10:00', category: 'study', status: 'approved' },
    { title: 'Dạo bước cuối tuần', date: dateKey(addDays(nextWeek, 5)), time: '16:00', endTime: '17:00', category: 'personal', status: 'pending', notes: 'Để dành một chút thời gian cho những điều thật chậm.' },
  ];
  return sortTasks(entries.map((entry, index) => ({
    ...entry, id: `demo-${index + 1}`, createdAt: index,
  })));
}
