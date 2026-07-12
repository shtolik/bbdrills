/** @vitest-environment jsdom */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { h, render } from 'preact';

function makeStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  } as any;
}

describe('App (Preact) basic wiring', () => {
  let cleanup = () => {};

  beforeEach(async () => {
    vi.resetModules();
    // provide a fresh localStorage implementation
    (globalThis as any).localStorage = makeStorage();

    // mock fetch to return a tiny manifest
    (globalThis as any).fetch = vi.fn(async () => ({ json: async () => [{ id: 'd1', name_en: 'Drill 1', group_en: 'G' }] }));

    // prepare DOM expected by App (header buttons and content area + modal)
    document.body.innerHTML = `
      <div class="container">
        <header>
          <div class="brand">Basketball Off-Season Drills</div>
          <div class="controls">
            <button id="btn-en">English</button>
            <button id="btn-fi">Suomi</button>
            <button id="theme-btn">Theme</button>
            <button id="filter-btn">Show: All</button>
            <button id="clear-progress">Clear progress</button>
          </div>
        </header>
        <main id="content"><p>Loading…</p></main>
        <div id="modal" class="modal" aria-hidden="true"><div id="modal-box"></div></div>
      </div>
    `;

    // polyfill IntersectionObserver used by App
    (globalThis as any).IntersectionObserver = class {
      constructor(cb: any) {}
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;

    // import App and render
    const mod = await import('../../src/site/App');
    const App = mod.default;
    // render via JSX so hooks are initialized correctly
    render(<App />, document.getElementById('content')!);

    cleanup = () => {
      try { render(null, document.getElementById('content')!); } catch (_) {}
      document.body.innerHTML = '';
      vi.resetAllMocks();
    };

    // Allow microtasks to complete (fetch resolution/useEffect)
    await new Promise(r => setTimeout(r, 20));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders cards from manifest and wires header buttons', async () => {
    // card should be rendered from the mocked manifest
    const card = document.querySelector('.card');
    expect(card).toBeTruthy();

    // theme button should update localStorage (bbdrills_ui_v1)
    const themeBtn = document.getElementById('theme-btn') as HTMLButtonElement | null;
    expect(themeBtn).toBeTruthy();
    themeBtn!.click();

    const uiRaw = (globalThis as any).localStorage.getItem('bbdrills_ui_v1');
    expect(uiRaw).toBeTruthy();
    expect(uiRaw).toContain('"theme"');

    // language toggle persisted
    const btnFi = document.getElementById('btn-fi') as HTMLButtonElement | null;
    const btnEn = document.getElementById('btn-en') as HTMLButtonElement | null;
    btnFi!.click();
    btnEn!.click();
    const ui = JSON.parse((globalThis as any).localStorage.getItem('bbdrills_ui_v1') || '{}');
    expect(ui.lang).toBe('en');
  });
});
