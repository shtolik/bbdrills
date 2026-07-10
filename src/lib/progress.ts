// Progress storage helpers for bbdrills (v3 schema)
// Schema: top-level object { meta, byDate: { 'YYYY-MM-DD': { [drillId]: DrillDay } } }

export type SessionEntry = { timestamp: string; sets: number; reps?: number; note?: string };
export type DrillDay = {
  targetSets: number; // planned sets for the day (may be 0)
  repsPerSet?: number;
  sessions: SessionEntry[];
  setsCompleted: number; // derived, stored for quick reads
  lastUpdated?: string;
};

const STORAGE_KEY = 'bbdrills_progress_v3';

// Fallback in-memory storage for non-browser test environments
const fallbackStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
  };
})();

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const storage: StorageLike =
  typeof localStorage !== 'undefined' ? (localStorage as unknown as StorageLike) : fallbackStorage;

function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type RawStore = {
  meta?: { version: number; createdAt?: string };
  byDate?: Record<string, Record<string, DrillDay>>;
};

const LEGACY_KEY = 'bbdrills_progress_v1';

function readAll(): RawStore {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { byDate: {} };
  try {
    return JSON.parse(raw) as RawStore;
  } catch (e) {
    console.warn('bbdrills: failed to parse progress storage', e);
    return { byDate: {} };
  }
}

function writeAll(data: RawStore) {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Convert legacy payloads into v3 RawStore. Supports legacy shapes:
 * - map of drillId -> boolean (true means completed once)
 * - map of drillId -> number (setsDone)
 * - map of drillId -> { setsDone, setsTotal }
 */
export function migrateLegacyPayload(legacy: any): RawStore {
  const now = new Date().toISOString();
  const result: RawStore = { meta: { version: 3, createdAt: now }, byDate: {} };
  const key = todayKey();
  result.byDate![key] = {};
  if (!legacy || typeof legacy !== 'object') return result;
  Object.keys(legacy).forEach(drillId => {
    const v = legacy[drillId];
    if (v === false || v == null) return; // skip
    if (v === true) {
      result.byDate![key][drillId] = {
        targetSets: 1,
        sessions: [{ timestamp: now, sets: 1 }],
        setsCompleted: 1,
        lastUpdated: now,
      };
    } else if (typeof v === 'number') {
      const setsDone = Math.max(0, Math.floor(v));
      result.byDate![key][drillId] = {
        targetSets: setsDone || 1,
        sessions: setsDone ? [{ timestamp: now, sets: setsDone }] : [],
        setsCompleted: setsDone,
        lastUpdated: now,
      };
    } else if (typeof v === 'object') {
      const setsDone = Math.max(0, Math.floor(Number(v.setsDone ?? v.done ?? 0)));
      const setsTotal = Math.max(0, Math.floor(Number(v.setsTotal ?? v.total ?? setsDone ?? 0)));
      const sessions = setsDone ? [{ timestamp: now, sets: setsDone }] : [];
      result.byDate![key][drillId] = {
        targetSets: setsTotal,
        repsPerSet: v.reps || undefined,
        sessions,
        setsCompleted: setsDone,
        lastUpdated: now,
      };
    }
  });
  return result;
}

export function migrateLegacyIfNeeded(): boolean {
  try {
    const rawLegacy = storage.getItem(LEGACY_KEY);
    if (!rawLegacy) return false;
    // Don't clobber existing v3 progress; only migrate when v3 doesn't exist yet.
    if (storage.getItem(STORAGE_KEY)) {
      return false;
    }
    const parsed = JSON.parse(rawLegacy);
    const migrated = migrateLegacyPayload(parsed);
    writeAll(migrated);
    storage.removeItem(LEGACY_KEY);
    return true;
  } catch (e) {
    console.warn('bbdrills: migration failed', e);
    return false;
  }
}

export function getDay(drillId: string, date = new Date()): DrillDay {
  const key = todayKey(date);
  const all = readAll();
  const byDate = all.byDate || {};
  const day = (byDate[key] && byDate[key][drillId]) || {
    targetSets: 0,
    sessions: [],
    setsCompleted: 0,
  };
  return day;
}

export function persistDayForTest(drillId: string, day: DrillDay, date = new Date()) {
  const key = todayKey(date);
  const all = readAll();
  all.byDate = all.byDate || {};
  all.byDate[key] = all.byDate[key] || {};
  all.byDate[key][drillId] = day;
  writeAll(all);
}

export function markSetComplete(
  drillId: string,
  date = new Date(),
  opts: { sets?: number; reps?: number; note?: string } = {}
): DrillDay {
  const key = todayKey(date);
  const all = readAll();
  all.byDate = all.byDate || {};
  all.byDate[key] = all.byDate[key] || {};
  const nowIso = new Date().toISOString();
  const day =
    all.byDate[key][drillId] || ({ targetSets: 0, sessions: [], setsCompleted: 0 } as DrillDay);
  const sets = Math.max(1, Math.floor(opts.sets ?? 1));
  day.sessions = day.sessions || [];
  day.sessions.push({ timestamp: nowIso, sets, reps: opts.reps, note: opts.note });
  day.setsCompleted = (day.setsCompleted || 0) + sets;
  day.lastUpdated = nowIso;
  all.byDate[key][drillId] = day;
  if (!all.meta) all.meta = { version: 3, createdAt: new Date().toISOString() };
  writeAll(all);
  return day;
}

export function addTargetSets(drillId: string, amount = 1, date = new Date()): DrillDay {
  const key = todayKey(date);
  const all = readAll();
  all.byDate = all.byDate || {};
  all.byDate[key] = all.byDate[key] || {};
  const nowIso = new Date().toISOString();
  const day =
    all.byDate[key][drillId] || ({ targetSets: 0, sessions: [], setsCompleted: 0 } as DrillDay);
  day.targetSets = Math.max(0, (day.targetSets || 0) + amount);
  day.lastUpdated = nowIso;
  all.byDate[key][drillId] = day;
  if (!all.meta) all.meta = { version: 3, createdAt: new Date().toISOString() };
  writeAll(all);
  return day;
}

export function undoLastSession(drillId: string, date = new Date()): DrillDay | null {
  const key = todayKey(date);
  const all = readAll();
  if (!all.byDate || !all.byDate[key] || !all.byDate[key][drillId]) return null;
  const day = all.byDate[key][drillId];
  if (!day.sessions || day.sessions.length === 0) return day;
  const last = day.sessions.pop() as SessionEntry;
  day.setsCompleted = Math.max(0, (day.setsCompleted || 0) - (last.sets || 0));
  day.lastUpdated = new Date().toISOString();
  all.byDate[key][drillId] = day;
  writeAll(all);
  return day;
}

export function getWeeklySummary(drillId: string, days = 7, reference = new Date()) {
  const all = readAll();
  const results: Array<{
    date: string;
    setsCompleted: number;
    targetSets: number;
    completedFull: boolean;
  }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(reference);
    d.setDate(reference.getDate() - i);
    const key = todayKey(d);
    const day =
      (all.byDate && all.byDate[key] && all.byDate[key][drillId]) ||
      ({ targetSets: 0, sessions: [], setsCompleted: 0 } as DrillDay);
    const completedFull = day.targetSets > 0 && day.setsCompleted >= day.targetSets;
    results.push({
      date: key,
      setsCompleted: day.setsCompleted || 0,
      targetSets: day.targetSets || 0,
      completedFull,
    });
  }
  return results;
}

export function clearAllForTest() {
  storage.removeItem(STORAGE_KEY);
}

export function readRaw() {
  return readAll();
}
