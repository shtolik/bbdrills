/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildDeepLink } from '../../src/site/url';
import { JSDOM } from 'jsdom';

describe('buildDeepLink', () => {
  let origLocation: any;
  let dom: JSDOM | null = null;
  beforeEach(() => {
    // ensure a DOM is present (Vitest may run in node env)
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
        url: 'http://localhost/',
      });
      // @ts-ignore - attach to global for tests
      global.window = dom.window;
      // @ts-ignore
      global.document = dom.window.document;
    }
    // preserve real location if present
    origLocation = (global as any).location;
    // ensure clean head
    document.head.innerHTML = '';
  });
  afterEach(() => {
    // restore location
    try {
      Object.defineProperty(global, 'location', { value: origLocation, writable: true });
    } catch (e) {}
    // cleanup DOM if created
    if (dom) {
      dom.window.close();
      dom = null;
      // @ts-ignore
      delete (global as any).window;
      // @ts-ignore
      delete (global as any).document;
    }
  });

  it('uses canonical link when present', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', 'https://drills.my/');
    document.head.appendChild(link);
    const url = buildDeepLink('hip-airplane');
    expect(url).toBe('https://drills.my/?id=hip-airplane');
  });

  it('falls back to origin and strips /site/ path', () => {
    Object.defineProperty(global, 'location', {
      value: {
        origin: 'http://localhost:8000',
        pathname: '/site/',
      },
      writable: true,
    });
    const url = buildDeepLink('a-skip');
    expect(url).toBe('http://localhost:8000/?id=a-skip');
  });

  it('falls back to localhost when origin missing', () => {
    Object.defineProperty(global, 'location', {
      value: {
        origin: 'null',
        pathname: '/whatever',
      },
      writable: true,
    });
    const url = buildDeepLink('pogo-jumps');
    expect(url).toBe('http://localhost/?id=pogo-jumps');
  });
});
