/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildDeepLink } from '../../src/site/url';

describe('buildDeepLink', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // ensure clean head
    document.head.innerHTML = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses canonical link when present', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', 'https://drills.my/');
    document.head.appendChild(link);
    const url = buildDeepLink('hip-airplane');
    expect(url).toBe('https://drills.my/drill.html?id=hip-airplane');
  });

  it('falls back to origin and strips /site/ path', () => {
    Object.defineProperty(global, 'location', {
      value: {
        origin: 'http://localhost:8000',
        pathname: '/site/',
      },
      writable: true,
      configurable: true,
    });
    const url = buildDeepLink('a-skip');
    expect(url).toBe('http://localhost:8000/drill.html?id=a-skip');
  });

  it('falls back to localhost when origin missing', () => {
    Object.defineProperty(global, 'location', {
      value: {
        origin: 'null',
        pathname: '/whatever',
      },
      writable: true,
      configurable: true,
    });
    const url = buildDeepLink('pogo-jumps');
    expect(url).toBe('http://localhost/drill.html?id=pogo-jumps');
  });
});
