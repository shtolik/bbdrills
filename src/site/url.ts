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

  // Fallback: derive from location and prefer preserving dev-server paths when present
  try {
    const loc = typeof location !== 'undefined' ? location : ({} as Location);
    const origin = (loc as any).origin || '';
    const pathname = loc && loc.pathname ? loc.pathname : '/';

    // If the current path ends with index.html, use the directory that contains it.
    // This preserves IDE server paths like /user/project/site/index.html → /user/project/site/
    let basePath = '/';
    try {
      if (/\/index\.html$/i.test(pathname)) {
        basePath = pathname.replace(/\/index\.html$/i, '/');
      } else if (/\/site\//i.test(pathname)) {
        // If path contains /site/:
        // - When served from repo root (pathname starts with "/site/"), strip it so links match production "/".
        // - When "/site/" appears deeper (IDE/server prefix), preserve the prefix so links still resolve.
        const idx = pathname.toLowerCase().indexOf('/site/');
        if (idx === 0) {
          basePath = '/';
        } else if (idx > 0) {
          basePath = pathname.substring(0, idx + '/site/'.length);
          if (!basePath.endsWith('/')) basePath += '/';
        } else {
          basePath = '/';
        }

        // Use the current directory to be conservative on weird server setups
        basePath = pathname;
        if (!basePath.endsWith('/')) basePath += '/';
      } else {
        basePath = '/';
      }
    } catch (e) {
      basePath = '/';
    }

    if (!origin || origin === 'null') {
      return `http://localhost${basePath}?id=${encodeURIComponent(id)}`;
    }

    // Prefer a dedicated drill page under the same directory (drill.html)
    let pathWithDrill = basePath;
    try {
      if (!/drill\.html$/i.test(pathWithDrill)) {
        if (!pathWithDrill.endsWith('/')) pathWithDrill += '/';
        pathWithDrill += 'drill.html';
      }
    } catch (e) {
      pathWithDrill = basePath;
    }

    const candidate = origin + pathWithDrill;
    try {
      const u = new URL(candidate);
      u.searchParams.set('id', id);
      return u.toString();
    } catch (e) {
      return `${origin}${pathWithDrill}?id=${encodeURIComponent(id)}`;
    }
  } catch (e) {
    return `http://localhost/?id=${encodeURIComponent(id)}`;
  }
}
