export function buildDeepLink(id: string): string {
  // Prefer canonical link if set
  try {
    const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (link && link.href) {
      try {
        const u = new URL(link.href);
        u.searchParams.set('id', id);
        return u.toString();
      } catch (e) {
        // fallthrough
      }
    }
  } catch (e) {}

  // Fallback: derive from location.origin and normalize path
  try {
    const origin = location && (location as any).origin ? (location as any).origin : '';
    let path = location && location.pathname ? location.pathname : '/';
    // Normalize common dev/server paths that include /site or /site/index.html
    try {
      // keep only origin + '/' to avoid long IDE-serving paths like /project/site/index.html
      if (/\/site(\/index\.html)?$/i.test(path) || path.match(/\/site\//i)) {
        path = '/';
      }
      // If path contains /site/ anywhere, reduce to '/'
      if (/\/site\//i.test(path)) path = '/';
    } catch (e) {}
    if (!origin || origin === 'null') {
      // Last resort
      return `http://localhost/?id=${encodeURIComponent(id)}`;
    }
    const base = origin + path;
    try {
      const u = new URL(base);
      u.searchParams.set('id', id);
      return u.toString();
    } catch (e) {
      return `${origin}/?id=${encodeURIComponent(id)}`;
    }
  } catch (e) {
    return `http://localhost/?id=${encodeURIComponent(id)}`;
  }
}
