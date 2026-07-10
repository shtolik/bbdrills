import { beforeEach, describe, it, expect, vi } from 'vitest';

function makeStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  } as any;
}

let mod: any;

beforeEach(async () => {
  // Ensure module picks up a browser-like localStorage
  (globalThis as any).localStorage = makeStorage();
  // import fresh module each test to pick up storage binding
  vi.resetModules();
  mod = await import('../../src/lib/progress?test=' + Date.now());
  mod.clearAllForTest();
});

describe('progress storage helpers (v3)', () => {
  it('markSetComplete appends a session and increases setsCompleted (can exceed target)', () => {
    const { persistDayForTest, markSetComplete, getDay } = mod;
    persistDayForTest('d1', { targetSets: 3, repsPerSet: 12, sessions: [], setsCompleted: 0 });
    expect(getDay('d1').setsCompleted).toBe(0);
    markSetComplete('d1');
    expect(getDay('d1').setsCompleted).toBe(1);
    markSetComplete('d1');
    markSetComplete('d1');
    expect(getDay('d1').setsCompleted).toBe(3);
    // further calls may exceed target (user allowed to do extra sets)
    markSetComplete('d1');
    expect(getDay('d1').setsCompleted).toBe(4);
    const day = getDay('d1');
    expect(day.sessions.length).toBe(4);
  });

  it('addTargetSets adjusts the targetSets but does not reduce setsCompleted', () => {
    const { persistDayForTest, addTargetSets, getDay } = mod;
    persistDayForTest('d2', { targetSets: 2, sessions: [{ timestamp: new Date().toISOString(), sets: 1 }], setsCompleted: 1 });
    const after = addTargetSets('d2', 1);
    expect(after.targetSets).toBe(3);
    expect(after.setsCompleted).toBe(1);
    // reducing target below completed should still keep setsCompleted as-is
    const after2 = addTargetSets('d2', -5);
    expect(after2.targetSets).toBe(0);
    expect(after2.setsCompleted).toBe(1);
  });

  it('weekly summary returns 7 entries and marks full completion', () => {
    const { persistDayForTest, getWeeklySummary } = mod;
    const today = new Date('2026-07-10T00:00:00Z');
    // Day -2 full, Day -1 partial, today none
    persistDayForTest('drillA', { targetSets: 2, sessions: [{ timestamp: '2026-07-08T09:00:00Z', sets: 2 }], setsCompleted: 2 }, new Date(2026, 6, 8));
    persistDayForTest('drillA', { targetSets: 2, sessions: [{ timestamp: '2026-07-09T09:00:00Z', sets: 1 }], setsCompleted: 1 }, new Date(2026, 6, 9));
    persistDayForTest('drillA', { targetSets: 2, sessions: [], setsCompleted: 0 }, today);
    const weekly = getWeeklySummary('drillA', 7, today);
    expect(weekly.length).toBe(7);
    const found = weekly.find((r: any) => r.date === '2026-07-08');
    expect(found).toBeTruthy();
    expect(found.completedFull).toBe(true);
    const foundPartial = weekly.find((r: any) => r.date === '2026-07-09');
    expect(foundPartial.completedFull).toBe(false);
  });
});
