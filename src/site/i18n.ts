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

export function localizedField(item: any, field: string, lang: string) {
  if (!item) return '';
  // nested object e.g. name: { en: '', fi: '' }
  const nested = item[field];
  if (nested && typeof nested === 'object') {
    if (nested[lang]) return nested[lang];
    if (nested['en']) return nested['en'];
  }
  // flat fields: name_en / name_fi
  const flat = item[field + '_' + lang];
  if (flat) return flat;
  const flatEn = item[field + '_en'];
  if (flatEn) return flatEn;
  return item[field] || '';
}
