import { describe, it, expect, beforeEach } from 'vitest';
import { migrateLegacyPayload } from '../../src/lib/progress';

describe('migration helper', () => {
  it('migrates boolean map to today sessions', () => {
    const legacy = { drillA: true, drillB: false };
    const out = migrateLegacyPayload(legacy);
    const keys = Object.keys(out.byDate || {});
    expect(keys.length).toBe(1);
    const day = out.byDate![keys[0]];
    expect(day['drillA'].setsCompleted).toBe(1);
    expect(day['drillB']).toBeUndefined();
  });
  it('migrates numeric map to sessions', () => {
    const legacy = { drillX: 3 };
    const out = migrateLegacyPayload(legacy);
    const keys = Object.keys(out.byDate || {});
    const day = out.byDate![keys[0]];
    expect(day['drillX'].setsCompleted).toBe(3);
    expect(day['drillX'].sessions.length).toBe(1);
  });
});
