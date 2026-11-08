import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY, addDays, approveTask, createDemoTasks, createTask, dateKey,
  getMonthDays, getNextWeek, groupTasksByDate, loadTasks, parseDateKey,
  saveTasks, sortTasks, startOfWeek, type Task, type TaskInput,
} from './schedule';

const input: TaskInput = {
  title: 'Ôn tập', date: '2026-11-08', time: '09:00', endTime: '10:00', category: 'study',
};
const task = (overrides: Partial<Task> = {}): Task => ({
  ...input, id: 'task-1', status: 'pending', createdAt: 1, ...overrides,
});
const read = (raw: string | null) => ({ getItem: () => raw });
const envelope = (tasks: unknown) => JSON.stringify({ version: 1, tasks });

describe('local calendar dates', () => {
  it('round-trips local components without changing the date or input', () => {
    const original = new Date(2026, 10, 8, 23, 50);
    expect(dateKey(original)).toBe('2026-11-08');
    expect(dateKey(parseDateKey('2026-11-08')!)).toBe('2026-11-08');
    expect(dateKey(addDays(original, 1))).toBe('2026-11-09');
    expect(original.getHours()).toBe(23);
  });

  it('rejects malformed and overflowing dates, with leap years handled correctly', () => {
    expect(parseDateKey('2026-02-29')).toBeNull();
    expect(parseDateKey('2026-04-31')).toBeNull();
    expect(parseDateKey('2026-13-01')).toBeNull();
    expect(parseDateKey('2026-1-08')).toBeNull();
    expect(dateKey(parseDateKey('2028-02-29')!)).toBe('2028-02-29');
  });

  it('calculates the next Monday–Sunday week from Sunday, November 8, 2026', () => {
    const sunday = new Date(2026, 10, 8);
    expect(dateKey(startOfWeek(sunday))).toBe('2026-11-02');
    const next = getNextWeek(sunday);
    expect(dateKey(next.start)).toBe('2026-11-09');
    expect(dateKey(next.end)).toBe('2026-11-15');
    expect(dateKey(getNextWeek(new Date(2026, 10, 9)).start)).toBe('2026-11-16');
  });

  it('handles next weeks and day arithmetic across a year boundary', () => {
    const next = getNextWeek(new Date(2026, 11, 31));
    expect(dateKey(next.start)).toBe('2027-01-04');
    expect(dateKey(next.end)).toBe('2027-01-10');
    expect(dateKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
  });

  it('builds complete Monday-first month grids including neighboring dates', () => {
    const november = getMonthDays(new Date(2026, 10, 18));
    expect(november).toHaveLength(42);
    expect(dateKey(november[0])).toBe('2026-10-26');
    expect(dateKey(november[41])).toBe('2026-12-06');
    expect(november.filter(day => day.getMonth() === 10)).toHaveLength(30);
    expect(november.every((day, index) => day.getDay() === (index + 1) % 7)).toBe(true);
    const leap = getMonthDays(new Date(2028, 1, 1));
    expect(leap.filter(day => day.getMonth() === 1)).toHaveLength(29);
  });
});

describe('tasks and approval', () => {
  it('creates pending tasks and ignores any injected status or identity', () => {
    const created = createTask({ ...input, title: '  Ôn tập  ', status: 'approved', id: 'injected' } as TaskInput);
    expect(created.title).toBe('Ôn tập');
    expect(created.status).toBe('pending');
    expect(created.id).not.toBe('injected');
  });

  it.each([
    { title: '  ' }, { date: '2026-02-30' }, { time: '9:00' },
    { time: '24:00' }, { endTime: '09:00' }, { endTime: '08:00' },
    { category: 'unknown' },
  ])('rejects invalid task values: %j', override => {
    expect(() => createTask({ ...input, ...override } as TaskInput)).toThrow();
  });

  it('approves only the chosen task, preserves input and supports repeat approval', () => {
    const original = [task(), task({ id: 'task-2' })];
    const approved = approveTask(original, 'task-1');
    expect(approved.map(item => item.status)).toEqual(['approved', 'pending']);
    expect(original[0].status).toBe('pending');
    expect(approveTask(approved, 'task-1')).toEqual(approved);
  });

  it('groups by ascending date and time without mutating the original list', () => {
    const original = [
      task({ id: 'later-day', date: '2026-11-09', time: '07:00' }),
      task({ id: 'late', time: '10:00', endTime: '11:00' }),
      task({ id: 'tie-b', time: '09:05', createdAt: 3 }),
      task({ id: 'early', time: '08:00' }),
      task({ id: 'tie-a', time: '09:05', createdAt: 2 }),
    ];
    expect(sortTasks(original).map(item => item.id)).toEqual(['early', 'tie-a', 'tie-b', 'late', 'later-day']);
    expect(original[0].id).toBe('later-day');
    const groups = groupTasksByDate(original);
    expect([...groups.keys()]).toEqual(['2026-11-08', '2026-11-09']);
    expect(groups.get('2026-11-08')!.map(item => item.id)).toEqual(['early', 'tie-a', 'tie-b', 'late']);
  });

  it('generates clearly separable demos from today into the next calendar week', () => {
    const today = new Date(2026, 10, 8);
    const demos = createDemoTasks(today);
    const week = getNextWeek(today);
    expect(demos.some(item => item.date === dateKey(today))).toBe(true);
    expect(demos.some(item => item.date >= dateKey(week.start) && item.date <= dateKey(week.end))).toBe(true);
    expect(demos.every(item => item.id.startsWith('demo-'))).toBe(true);
    expect(loadTasks(read(envelope(demos))).canSave).toBe(true);
  });
});

describe('validated browser storage', () => {
  it('distinguishes the first visit from a deliberately saved empty calendar', () => {
    expect(loadTasks(read(null))).toEqual({ tasks: [], canSave: true, hasSavedData: false });
    expect(loadTasks(read(envelope([])))).toEqual({ tasks: [], canSave: true, hasSavedData: true });
  });

  it('round-trips tasks and approvals in the versioned envelope', () => {
    let stored: string | null = null;
    const storage = {
      getItem: (key: string) => { expect(key).toBe(STORAGE_KEY); return stored; },
      setItem: (key: string, value: string) => { expect(key).toBe(STORAGE_KEY); stored = value; },
    };
    const approved = approveTask([task()], 'task-1');
    expect(saveTasks(approved, storage)).toBe(true);
    expect(loadTasks(storage)).toEqual({ tasks: approved, canSave: true, hasSavedData: true });
  });

  it.each([
    '{ broken', 'null', '[]', JSON.stringify({ version: 2, tasks: [] }),
    envelope([task({ date: '2026-02-30' })]),
    envelope([task({ status: 'unknown' as Task['status'] })]),
    envelope([task(), task()]),
    envelope([task({ category: 'unknown' as Task['category'] })]),
    envelope([task({ createdAt: -1 })]),
  ])('preserves corrupted or incompatible saved data: %s', raw => {
    const storage = read(raw);
    const result = loadTasks(storage);
    expect(result.tasks).toEqual([]);
    expect(result.canSave).toBe(false);
    expect(result.hasSavedData).toBe(true);
    expect(result.warning).toBeTruthy();
    expect(storage.getItem()).toBe(raw);
  });

  it('handles blocked storage and quota errors without crashing', () => {
    const loaded = loadTasks({ getItem: () => { throw new Error('blocked'); } });
    expect(loaded.canSave).toBe(false);
    expect(loaded.warning).toBeTruthy();
    expect(saveTasks([task()], { setItem: () => { throw new Error('quota'); } })).toBe(false);
  });

  it('refuses to save invalid records', () => {
    let writes = 0;
    expect(saveTasks([task({ title: '' })], { setItem: () => { writes += 1; } })).toBe(false);
    expect(writes).toBe(0);
  });
});
