export async function loadLocale(lang: string) {
  try {
    const res = await fetch('./locales/' + lang + '.json').catch(() => fetch('./locales/en.json'));
    const loc = await res.json();
    (window as any)._bbdrills_loc = loc;
    return loc;
  } catch (e) {
    (window as any)._bbdrills_loc = {};
    return {};
  }
}

export function t(key: string, fallback?: string) {
  try {
    const loc = (window as any)._bbdrills_loc || {};
    return (loc[key] as string) || fallback || key;
  } catch (e) {
    return fallback || key;
  }
}
